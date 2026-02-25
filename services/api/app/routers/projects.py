from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse, RedirectResponse
from sqlalchemy.orm import Session

from ..config import settings
from ..db import get_db
from ..models import Commitment, EvidencePackage, Project, User
from ..schemas.projects import ProjectCreateRequest, ProjectResponse
from ..utils.storage import storage

router = APIRouter()
LOCAL_OWNER_WALLET = "local-dev-owner"


def _get_or_create_local_owner(db: Session) -> User:
    user = db.query(User).filter(User.wallet_address == LOCAL_OWNER_WALLET).one_or_none()
    if user is None:
        user = User(wallet_address=LOCAL_OWNER_WALLET)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


@router.get("", response_model=list[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return [ProjectResponse(id=p.id, name=p.name, description=p.description) for p in projects]


@router.post("", response_model=ProjectResponse)
def create_project(payload: ProjectCreateRequest, db: Session = Depends(get_db)):
    if not payload.name:
        raise HTTPException(status_code=400, detail="Project name required")
    owner = _get_or_create_local_owner(db)
    project = Project(name=payload.name, description=payload.description, owner_id=owner.id)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ProjectResponse(id=project.id, name=project.name, description=project.description)


@router.get("/{project_id}/packages")
def list_packages(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    packages = (
        db.query(EvidencePackage)
        .filter(EvidencePackage.project_id == project_id)
        .order_by(EvidencePackage.created_at.desc())
        .all()
    )
    return [
        {
            "id": pkg.id,
            "commitment_id": pkg.commitment_id,
            "snapshot_id": pkg.snapshot_id,
            "snapshot_name": pkg.snapshot_name,
            "created_at": pkg.created_at.isoformat() if pkg.created_at else None,
            "download_url": f"{settings.api_base_url}/api/projects/{project_id}/packages/{pkg.id}",
        }
        for pkg in packages
    ]


@router.post("/{project_id}/packages")
async def upload_package(
    project_id: str,
    commitment_id: str = Form(...),
    snapshot_id: str | None = Form(None),
    snapshot_name: str | None = Form(None),
    package_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).one_or_none()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    commitment = db.query(Commitment).filter(Commitment.id == commitment_id).one_or_none()
    if commitment is None:
        raise HTTPException(status_code=404, detail="Commitment not found")
    if commitment.project_id and commitment.project_id != project_id:
        raise HTTPException(status_code=400, detail="Commitment project mismatch")

    pkg = EvidencePackage(
        project_id=project_id,
        commitment_id=commitment_id,
        snapshot_id=snapshot_id,
        snapshot_name=snapshot_name,
        package_path="",
    )
    db.add(pkg)
    db.commit()
    db.refresh(pkg)

    contents = await package_file.read()
    key = f"packages/{project_id}/{pkg.id}.zip"
    pkg.package_path = storage.upload_bytes(key, contents, content_type="application/zip", upsert=True)
    db.commit()

    return {
        "id": pkg.id,
        "download_url": f"{settings.api_base_url}/api/projects/{project_id}/packages/{pkg.id}",
    }


@router.get("/{project_id}/packages/{package_id}")
def download_package(project_id: str, package_id: str, db: Session = Depends(get_db)):
    pkg = (
        db.query(EvidencePackage)
        .filter(EvidencePackage.id == package_id, EvidencePackage.project_id == project_id)
        .one_or_none()
    )
    if pkg is None:
        raise HTTPException(status_code=404, detail="Package not found")
    if storage.is_remote():
        signed_url = storage.create_signed_url(pkg.package_path)
        if not signed_url:
            raise HTTPException(status_code=500, detail="Failed to create signed URL")
        return RedirectResponse(signed_url)
    return FileResponse(
        storage.resolve_local_path(pkg.package_path),
        filename=f"{package_id}.zip",
        media_type="application/zip",
    )
