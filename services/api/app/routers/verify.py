import hashlib
import io
import json
import zipfile

from fastapi import APIRouter, File, HTTPException, UploadFile

from opentimestamps.core.notary import BitcoinBlockHeaderAttestation
from opentimestamps.core.serialize import StreamDeserializationContext
from opentimestamps.core.timestamp import DetachedTimestampFile

from ..utils.security import verify_wallet_signature
from ..utils.vault import canonical_manifest

router = APIRouter()


def _compute_commitment(content: bytes, salt_hex: str, nonce_hex: str) -> str:
    salt = bytes.fromhex(salt_hex)
    nonce = bytes.fromhex(nonce_hex)
    combined = content + salt + nonce
    return hashlib.sha256(combined).hexdigest()


def _read_manifest_and_proof(bundle_bytes: bytes) -> tuple[dict, bytes, dict | None]:
    with zipfile.ZipFile(io.BytesIO(bundle_bytes)) as zf:
        if "manifest.json" not in zf.namelist():
            raise HTTPException(status_code=400, detail="manifest.json missing")
        if "proof.ots" not in zf.namelist():
            raise HTTPException(status_code=400, detail="proof.ots missing")
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        proof_bytes = zf.read("proof.ots")
        snapshot_manifest = None
        if "snapshot_manifest.json" in zf.namelist():
            snapshot_manifest = json.loads(zf.read("snapshot_manifest.json").decode("utf-8"))
    return manifest, proof_bytes, snapshot_manifest


def _verify_ots(commitment_hash: str, proof_bytes: bytes) -> tuple[bool, bool]:
    ctx = StreamDeserializationContext(io.BytesIO(proof_bytes))
    detached = DetachedTimestampFile.deserialize(ctx)

    algo = getattr(detached.file_hash_op, "TAG_NAME", "sha256").lower()
    if algo != "sha256":
        raise HTTPException(status_code=400, detail=f"Unsupported hash algorithm: {algo}")

    digest = hashlib.sha256(commitment_hash.encode("utf-8")).digest()
    matches = digest == detached.file_digest

    complete = False
    for _, att in detached.timestamp.all_attestations():
        if isinstance(att, BitcoinBlockHeaderAttestation):
            complete = True
            break

    return matches, complete


def _normalize_zip_path(path_value: str) -> str:
    value = path_value.replace("\\", "/")
    value = value.lstrip("/")
    while "../" in value:
        value = value.replace("../", "")
    return value


def _verify_snapshot_bundle(
    snapshot_bundle_bytes: bytes,
    commitment: str,
    salt: str,
    nonce: str,
    bundle_snapshot_manifest: dict | None,
) -> tuple[bool, bool, bool, bool | None]:
    with zipfile.ZipFile(io.BytesIO(snapshot_bundle_bytes)) as zf:
        names = set(zf.namelist())
        if "snapshot_manifest.json" not in names:
            raise HTTPException(status_code=400, detail="snapshot_manifest.json missing in snapshot bundle")
        snapshot_manifest = json.loads(zf.read("snapshot_manifest.json").decode("utf-8"))

        files = snapshot_manifest.get("files", [])
        if not isinstance(files, list):
            raise HTTPException(status_code=400, detail="snapshot_manifest files invalid")

        files_match = True
        for item in files:
            rel_path = item.get("path")
            expected_hash = item.get("hash")
            if not rel_path or not expected_hash:
                files_match = False
                continue
            entry_name = _normalize_zip_path(str(rel_path))
            if entry_name not in names:
                files_match = False
                continue
            data = zf.read(entry_name)
            actual_hash = hashlib.sha256(data).hexdigest()
            if actual_hash != expected_hash:
                files_match = False

    snapshot_canonical = canonical_manifest(snapshot_manifest)
    snapshot_commitment = _compute_commitment(snapshot_canonical.encode("utf-8"), salt, nonce)
    commitment_match = snapshot_commitment == commitment

    manifest_match = None
    if bundle_snapshot_manifest is not None:
        manifest_match = canonical_manifest(bundle_snapshot_manifest) == snapshot_canonical

    snapshot_match = files_match and commitment_match and (manifest_match is None or manifest_match)
    return snapshot_match, files_match, commitment_match, manifest_match


@router.post("/verify")
async def verify(
    bundle: UploadFile = File(...),
    unlock_material: UploadFile = File(...),
    original_file: UploadFile | None = File(None),
    snapshot_bundle: UploadFile | None = File(None),
):
    try:
        unlock = json.loads((await unlock_material.read()).decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid unlock_material JSON")

    commitment = unlock.get("commitment")
    salt = unlock.get("salt")
    nonce = unlock.get("nonce")
    hash_alg = unlock.get("hash_alg", "sha256")

    if not commitment or not salt or not nonce:
        raise HTTPException(status_code=400, detail="unlock_material missing fields")
    if hash_alg.lower() != "sha256":
        raise HTTPException(status_code=400, detail="Only sha256 is supported")

    file_match = None
    if original_file is not None:
        content = await original_file.read()
        computed = _compute_commitment(content, salt, nonce)
        file_match = computed == commitment

    manifest, proof_bytes, bundle_snapshot_manifest = _read_manifest_and_proof(await bundle.read())

    manifest_commitment = manifest.get("commitment_hash")
    commitment_match = manifest_commitment == commitment

    wallet_address = manifest.get("wallet_address")
    message = manifest.get("message")
    signature = manifest.get("signature")
    signature_valid = False
    if wallet_address and message and signature:
        signature_valid = verify_wallet_signature(wallet_address, message, signature)

    ots_match, ots_complete = _verify_ots(commitment, proof_bytes)

    snapshot_match = None
    snapshot_files_match = None
    snapshot_commitment_match = None
    snapshot_manifest_match = None
    if snapshot_bundle is not None:
        snapshot_match, snapshot_files_match, snapshot_commitment_match, snapshot_manifest_match = (
            _verify_snapshot_bundle(
                await snapshot_bundle.read(),
                commitment,
                salt,
                nonce,
                bundle_snapshot_manifest,
            )
        )

    valid = commitment_match and signature_valid and ots_match
    if file_match is not None:
        valid = valid and file_match
    if snapshot_match is not None:
        valid = valid and snapshot_match

    return {
        "valid": valid,
        "details": {
            "commitment_match": commitment_match,
            "file_match": file_match,
            "signature": signature_valid,
            "ots": ots_match,
            "ots_complete": ots_complete,
            "snapshot_match": snapshot_match,
            "snapshot_files_match": snapshot_files_match,
            "snapshot_commitment_match": snapshot_commitment_match,
            "snapshot_manifest_match": snapshot_manifest_match,
        },
    }
