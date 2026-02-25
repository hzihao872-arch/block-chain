import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { get, set } from "idb-keyval";

function toHex(buffer: Uint8Array) {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildMessage(commitment: string, hashAlg: string, clientNonce: string, timestamp: string) {
  return [
    "IdeaLock Commitment",
    `commitment:${commitment}`,
    `hash_alg:${hashAlg}`,
    `client_nonce:${clientNonce}`,
    `timestamp:${timestamp}`,
  ].join("\n");
}

async function sha256(data: Uint8Array) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(hashBuffer));
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function App() {
  const [snapshotName, setSnapshotName] = useState("");
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [snapshotId, setSnapshotId] = useState("");
  const [snapshotManifest, setSnapshotManifest] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [projectPackages, setProjectPackages] = useState<any[]>([]);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginInput, setLoginInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [packageSearch, setPackageSearch] = useState("");
  const [packageDateFrom, setPackageDateFrom] = useState("");
  const [packageDateTo, setPackageDateTo] = useState("");

  const [commitment, setCommitment] = useState("");
  const [saltHex, setSaltHex] = useState("");
  const [nonceHex, setNonceHex] = useState("");
  const [timestamp, setTimestamp] = useState("");
  const [message, setMessage] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [signature, setSignature] = useState("");
  const [commitmentId, setCommitmentId] = useState("");
  const [email, setEmail] = useState("");

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [emailConfirmMessage, setEmailConfirmMessage] = useState("");
  const [emailConfirmStatus, setEmailConfirmStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [confirmCommitmentId, setConfirmCommitmentId] = useState("");
  const [packageStatus, setPackageStatus] = useState("");
  const [packageError, setPackageError] = useState("");

  const [verifyOriginalFile, setVerifyOriginalFile] = useState<File | null>(null);
  const [verifyUnlockFile, setVerifyUnlockFile] = useState<File | null>(null);
  const [verifyBundleFile, setVerifyBundleFile] = useState<File | null>(null);
  const [verifySnapshotBundle, setVerifySnapshotBundle] = useState<File | null>(null);
  const [verifyResult, setVerifyResult] = useState<any>(null);
  const [verifyStatus, setVerifyStatus] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const apiBase = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000",
    []
  );
  const isEmailConfirmPage = useMemo(
    () => window.location.pathname.startsWith("/email/confirm"),
    []
  );
  const packageTriggeredRef = useRef(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("idelock_login_email");
    if (saved) {
      setLoginEmail(saved);
      setEmail(saved);
    }
  }, []);

  useEffect(() => {
    if (loginEmail) {
      setEmail(loginEmail);
    }
  }, [loginEmail]);
  const filteredPackages = useMemo(() => {
    const keyword = packageSearch.trim().toLowerCase();
    const fromDate = packageDateFrom ? new Date(`${packageDateFrom}T00:00:00`) : null;
    const toDate = packageDateTo ? new Date(`${packageDateTo}T23:59:59`) : null;

    return projectPackages.filter((pkg) => {
      if (keyword) {
        const haystack = [
          pkg.snapshot_name,
          pkg.snapshot_id,
          pkg.commitment_id,
          pkg.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) {
          return false;
        }
      }

      if (fromDate || toDate) {
        if (!pkg.created_at) {
          return false;
        }
        const created = new Date(pkg.created_at);
        if (Number.isNaN(created.getTime())) {
          return false;
        }
        if (fromDate && created < fromDate) {
          return false;
        }
        if (toDate && created > toDate) {
          return false;
        }
      }

      return true;
    });
  }, [packageSearch, packageDateFrom, packageDateTo, projectPackages]);

  useEffect(() => {
    if (!isEmailConfirmPage) {
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setEmailConfirmStatus("error");
      setEmailConfirmMessage("缺少验证 token");
      return;
    }
    setEmailConfirmStatus("loading");
    setEmailConfirmMessage("正在验证邮箱...");

    fetch(`${apiBase}/api/auth/email/confirm?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail || "验证失败");
        }
        return res.json();
      })
      .then(async (data) => {
        const commitmentIdValue = String(data.commitment_id || "");
        setConfirmCommitmentId(commitmentIdValue);
        setEmailConfirmStatus("success");
        setEmailConfirmMessage(`验证成功，commitment_id: ${commitmentIdValue || "-"}`);
        if (!packageTriggeredRef.current && commitmentIdValue) {
          packageTriggeredRef.current = true;
          await buildFinalPackage(commitmentIdValue);
        }
      })
      .catch((err) => {
        setEmailConfirmStatus("error");
        setEmailConfirmMessage(err instanceof Error ? err.message : "验证失败");
      });
  }, [apiBase, isEmailConfirmPage]);

  useEffect(() => {
    fetch(`${apiBase}/api/projects`)
      .then((res) => res.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .catch(() => setProjects([]));
  }, [apiBase]);

  useEffect(() => {
    setSnapshotId("");
    setSnapshotManifest(null);
  }, [directoryHandle]);

  useEffect(() => {
    if (!activeProject) {
      setProjectPackages([]);
      return;
    }
    fetch(`${apiBase}/api/projects/${activeProject.id}/packages`)
      .then((res) => res.json())
      .then((data) => setProjectPackages(Array.isArray(data) ? data : []))
      .catch(() => setProjectPackages([]));
  }, [apiBase, activeProject]);

  async function ensureDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
    if (directoryHandle) {
      const permission = await directoryHandle.queryPermission({ mode: "read" });
      if (permission === "granted") {
        return directoryHandle;
      }
      const requested = await directoryHandle.requestPermission({ mode: "read" });
      if (requested === "granted") {
        return directoryHandle;
      }
    }
    throw new Error("需要重新选择项目文件夹");
  }

  async function collectFilesFromHandle(
    handle: FileSystemDirectoryHandle,
    prefix = ""
  ): Promise<{ file: File; path: string }[]> {
    const entries: { file: File; path: string }[] = [];
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === "file") {
        const file = await entry.getFile();
        entries.push({ file, path: `${prefix}${name}` });
      } else if (entry.kind === "directory") {
        const child = await collectFilesFromHandle(entry, `${prefix}${name}/`);
        entries.push(...child);
      }
    }
    return entries;
  }

  async function createSnapshotInternal() {
    if (!activeProject) {
      throw new Error("请先选择项目");
    }
    const handle = await ensureDirectoryHandle();
    const filesWithPath = await collectFilesFromHandle(handle);
    if (!filesWithPath.length) {
      throw new Error("项目文件夹为空");
    }
    if (!snapshotName) {
      throw new Error("请填写快照名称");
    }

    const meta = filesWithPath.map((item) => ({
      path: item.path,
      size: item.file.size,
      last_modified: item.file.lastModified,
    }));

    const form = new FormData();
    form.append("snapshot_name", snapshotName || "");
    form.append("project_id", activeProject.id);
    form.append("file_meta", JSON.stringify(meta));
    filesWithPath.forEach((item) => form.append("files", item.file, item.file.name));

    const response = await fetch(`${apiBase}/api/snapshots`, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || "快照生成失败");
    }

    const data = await response.json();
    setSnapshotId(data.snapshot_id);
    setSnapshotManifest(data.manifest);
    window.localStorage.setItem("idelock_last_snapshot_id", data.snapshot_id);
    return data;
  }

  async function generateCommitmentFromCanonical(canonical: string) {
    const contentBytes = new TextEncoder().encode(canonical);
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const combined = new Uint8Array(contentBytes.length + salt.length + nonce.length);
    combined.set(contentBytes, 0);
    combined.set(salt, contentBytes.length);
    combined.set(nonce, contentBytes.length + salt.length);

    const hash = await sha256(combined);
    const saltHexValue = toHex(salt);
    const nonceHexValue = toHex(nonce);
    const now = new Date().toISOString();
    const msg = buildMessage(hash, "sha256", nonceHexValue, now);

    return {
      commitment: hash,
      saltHex: saltHexValue,
      nonceHex: nonceHexValue,
      timestamp: now,
      message: msg,
    };
  }

  async function signWithMetamask(msg: string) {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error("未检测到 MetaMask，请先安装");
    }

    const accounts = await ethereum.request({ method: "eth_requestAccounts" });
    const account = accounts?.[0];
    if (!account) {
      throw new Error("未获取到钱包地址");
    }

    const sig = await ethereum.request({
      method: "personal_sign",
      params: [msg, account],
    });

    return { account, sig };
  }

  async function submitCommitment(payload: {
    project_id: string | null;
    snapshot_id: string | null;
    snapshot_name: string | null;
    wallet_address: string;
    commitment_hash: string;
    hash_alg: string;
    message: string;
    wallet_signature: string;
  }) {
    const response = await fetch(`${apiBase}/api/commitments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || "提交失败");
    }

    const data = await response.json();
    return data.id as string;
  }

  async function requestEmailVerification(commitmentIdValue: string, walletAddressValue: string) {
    if (!email) {
      throw new Error("请输入邮箱");
    }
    const response = await fetch(`${apiBase}/api/auth/email/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        wallet_address: walletAddressValue,
        commitment_id: commitmentIdValue,
      }),
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || "邮件发送失败");
    }
  }

  async function handleOneClick() {
    setError("");
    setStatus("一键存证：准备中...");
    try {
      if (!email) {
        throw new Error("请输入邮箱");
      }
      if (!snapshotName) {
        throw new Error("请填写快照名称");
      }
      if (!activeProject) {
        throw new Error("请先选择项目");
      }
      await ensureDirectoryHandle();

      setStatus("一键存证：生成科研快照...");
      const snapshotData = await createSnapshotInternal();

      setStatus("一键存证：生成承诺...");
      const data = await generateCommitmentFromCanonical(snapshotData.manifest_canonical);
      const snapshotIdValue = snapshotData.snapshot_id || null;
      const snapshotNameValue = snapshotName || null;
      setCommitment(data.commitment);
      setSaltHex(data.saltHex);
      setNonceHex(data.nonceHex);
      setTimestamp(data.timestamp);
      setMessage(data.message);

      const unlockPayload = {
        commitment: data.commitment,
        hash_alg: "sha256",
        salt: data.saltHex,
        nonce: data.nonceHex,
        created_at: data.timestamp,
        snapshot_id: snapshotIdValue,
        snapshot_name: snapshotNameValue,
      };

      downloadJson("unlock_material.json", unlockPayload);

      setStatus("一键存证：等待 MetaMask 签名...");
      const { account, sig } = await signWithMetamask(data.message);
      setWalletAddress(account);
      setSignature(sig);

      setStatus("一键存证：提交 API...");
      const id = await submitCommitment({
        project_id: activeProject.id,
        snapshot_id: snapshotIdValue,
        snapshot_name: snapshotNameValue,
        wallet_address: account,
        commitment_hash: data.commitment,
        hash_alg: "sha256",
        message: data.message,
        wallet_signature: sig,
      });
      setCommitmentId(id);
      window.localStorage.setItem(`idelock_unlock_material_${id}`, JSON.stringify(unlockPayload));

      setStatus("一键存证：发送邮箱验证...");
      await requestEmailVerification(id, account);
      setStatus("一键存证完成：请在邮箱点击验证链接，系统将自动保存证据包。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "一键存证失败");
      setStatus("");
    }
  }

  async function fetchBundleWithRetry(commitmentIdValue: string) {
    const url = `${apiBase}/api/commitments/${commitmentIdValue}/bundle`;
    for (let i = 0; i < 10; i += 1) {
      const res = await fetch(url);
      if (res.ok) {
        return res;
      }
      if (res.status !== 404) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "证据包获取失败");
      }
      setPackageStatus("证据包生成中，请稍候...");
      await sleep(3000);
    }
    throw new Error("证据包尚未生成，请稍后再试");
  }

  async function buildFinalPackage(commitmentIdValue: string) {
    setPackageError("");
    setPackageStatus("正在打包证据...");
    try {
      const bundleRes = await fetchBundleWithRetry(commitmentIdValue);
      const bundleBuffer = await bundleRes.arrayBuffer();

      const bundleZip = await JSZip.loadAsync(bundleBuffer);
      const manifestFile = bundleZip.file("manifest.json");
      if (!manifestFile) {
        throw new Error("证据包缺少 manifest.json");
      }
      const manifestText = await manifestFile.async("string");
      const manifest = JSON.parse(manifestText);
      const snapshotIdValue = manifest.snapshot_id;
      const projectIdValue = manifest.project_id;
      if (!snapshotIdValue) {
        throw new Error("证据包缺少 snapshot_id");
      }
      if (!projectIdValue) {
        throw new Error("证据包缺少 project_id");
      }

      const unlockKey = `idelock_unlock_material_${commitmentIdValue}`;
      const unlockJson = window.localStorage.getItem(unlockKey);
      const snapshotExportUrl = `${apiBase}/api/snapshots/${snapshotIdValue}/export`;

      const finalZip = new JSZip();
      finalZip.file("evidence_bundle.zip", bundleBuffer);
      if (unlockJson) {
        finalZip.file("unlock_material.json", unlockJson);
      } else {
        finalZip.file(
          "unlock_material_missing.txt",
          "未在本机找到 unlock_material.json，请使用当时下载的解锁材料补充。"
        );
      }
      finalZip.file(
        "snapshot_export_url.txt",
        `快照包下载链接：\n${snapshotExportUrl}\n\n` +
          "说明：为了减少包体积，本包不包含快照包本体。\n" +
          "如需取证，可通过上述链接下载快照包 ZIP。\n"
      );
      finalZip.file(
        "README.txt",
        "此包包含：evidence_bundle.zip（证据包）、unlock_material.json、以及快照包下载链接。\n"
      );

      const blob = await finalZip.generateAsync({ type: "blob" });
      const form = new FormData();
      form.append("package_file", blob, `evidence_package_${commitmentIdValue}.zip`);
      form.append("commitment_id", commitmentIdValue);
      form.append("snapshot_id", snapshotIdValue);
      form.append("snapshot_name", manifest.snapshot_name || snapshotName || "");
      const uploadRes = await fetch(`${apiBase}/api/projects/${projectIdValue}/packages`, {
        method: "POST",
        body: form,
      });
      if (!uploadRes.ok) {
        const detail = await uploadRes.json().catch(() => ({}));
        throw new Error(detail.detail || "证据包保存失败");
      }

      setPackageStatus("打包完成，已保存到项目。");
      if (activeProject && activeProject.id === projectIdValue) {
        const listRes = await fetch(`${apiBase}/api/projects/${projectIdValue}/packages`);
        if (listRes.ok) {
          const data = await listRes.json().catch(() => []);
          setProjectPackages(Array.isArray(data) ? data : []);
        }
      }
    } catch (err) {
      setPackageError(err instanceof Error ? err.message : "打包失败");
      setPackageStatus("");
    }
  }

  async function handleVerify() {
    setVerifyError("");
    setVerifyStatus("Verifying...");
    setVerifyResult(null);

    if (!verifyUnlockFile || !verifyBundleFile) {
      setVerifyError("请上传 unlock_material.json 和证据包 ZIP");
      setVerifyStatus("");
      return;
    }

    const form = new FormData();
    form.append("unlock_material", verifyUnlockFile);
    form.append("bundle", verifyBundleFile);
    if (verifySnapshotBundle) {
      form.append("snapshot_bundle", verifySnapshotBundle);
    }
    if (verifyOriginalFile) {
      form.append("original_file", verifyOriginalFile);
    }

    try {
      const response = await fetch(`${apiBase}/api/verify`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || "验证失败");
      }
      const data = await response.json();
      setVerifyResult(data);
      setVerifyStatus("验证完成");
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "验证失败");
      setVerifyStatus("");
    }
  }

  if (isEmailConfirmPage) {
    return (
      <div className="page">
        <h1>邮箱验证</h1>
        <p>{emailConfirmMessage || "处理中..."}</p>
        {packageStatus && <p className="status">{packageStatus}</p>}
        {packageError && <p className="error">{packageError}</p>}
        {emailConfirmStatus === "success" && packageError && (
          <button onClick={() => buildFinalPackage(confirmCommitmentId)}>
            重新打包下载
          </button>
        )}
        {emailConfirmStatus === "success" && (
          <a href="/">返回首页</a>
        )}
      </div>
    );
  }

  if (!loginEmail) {
    return (
      <div className="page">
        <h1>Gmail 登录</h1>
        <p>请先使用 Gmail 登录，系统会将验证邮件发送到该邮箱。</p>
        <input
          type="email"
          value={loginInput}
          onChange={(e) => setLoginInput(e.target.value)}
          placeholder="name@gmail.com"
        />
        <button onClick={handleLogin}>登录</button>
        {loginError && <p className="error">{loginError}</p>}
      </div>
    );
  }

  async function handleCreateProject() {
    setError("");
    try {
      if (!newProjectName.trim()) {
        throw new Error("请填写项目名称");
      }
      if (!(window as any).showDirectoryPicker) {
        throw new Error("当前浏览器不支持目录选择，请使用 Chrome");
      }
      const dirHandle = await (window as any).showDirectoryPicker();
      const res = await fetch(`${apiBase}/api/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName.trim() }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail || "创建项目失败");
      }
      const project = await res.json();
      setProjects((prev) => [project, ...prev]);
      setActiveProject(project);
      setDirectoryHandle(dirHandle);
      await set(`idelock_project_handle_${project.id}`, dirHandle);
      setNewProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建项目失败");
    }
  }

  async function handleSelectProject(project: any) {
    setActiveProject(project);
    const handle = await get(`idelock_project_handle_${project.id}`);
    if (handle) {
      setDirectoryHandle(handle as FileSystemDirectoryHandle);
    } else {
      setDirectoryHandle(null);
    }
  }

  
  function handleLogin() {
    setLoginError("");
    const value = loginInput.trim();
    if (!value) {
      setLoginError("请输入 Gmail 邮箱");
      return;
    }
    if (!/^[^@]+@gmail\.com$/i.test(value)) {
      setLoginError("请使用 @gmail.com 邮箱");
      return;
    }
    window.localStorage.setItem("idelock_login_email", value);
    setLoginEmail(value);
    setEmail(value);
    setLoginInput("");
  }

  function handleLogout() {
    window.localStorage.removeItem("idelock_login_email");
    setLoginEmail("");
    setEmail("");
    setLoginInput("");
  }

  async function handleLinkFolder() {
    setError("");
    try {
      if (!activeProject) {
        throw new Error("请先选择项目");
      }
      if (!(window as any).showDirectoryPicker) {
        throw new Error("当前浏览器不支持目录选择，请使用 Chrome");
      }
      const dirHandle = await (window as any).showDirectoryPicker();
      setDirectoryHandle(dirHandle);
      await set(`idelock_project_handle_${activeProject.id}`, dirHandle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "关联文件夹失败");
    }
  }

  return (
    <div className="page">
      <h1>IdeaLock（科研存证一体化）</h1>
      <p>进入项目后，只需一键存证。</p>

      <details className="card" open>
        <summary>项目选择</summary>
        <div className="row">
          <input
            type="text"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="新项目名称"
          />
          <button onClick={handleCreateProject}>新建项目并选择文件夹</button>
        </div>
        <div className="row">
          {projects.map((project) => (
            <button
              key={project.id}
              onClick={() => handleSelectProject(project)}
              style={{ background: activeProject?.id === project.id ? "#16a34a" : undefined }}
            >
              {project.name}
            </button>
          ))}
        </div>
      </details>

      <div className="card">
        <h2>一键存证</h2>
        {activeProject ? (
          <p><strong>当前项目:</strong> {activeProject.name}</p>
        ) : (
          <p className="error">请先选择或创建项目</p>
        )}
        {!directoryHandle && activeProject && (
          <button onClick={handleLinkFolder}>选择项目文件夹</button>
        )}
        <input
          type="text"
          value={snapshotName}
          onChange={(e) => setSnapshotName(e.target.value)}
          placeholder="快照名称（例如：统计好了数据）"
        />
        {snapshotId && (
          <p><strong>snapshot_id:</strong> {snapshotId}</p>
        )}
        {snapshotManifest && (
          <p><strong>文件数:</strong> {snapshotManifest.file_count}，<strong>总大小:</strong> {snapshotManifest.total_size} bytes</p>
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="输入邮箱（用于验证）"
        />
        <button onClick={handleOneClick}>一键存证（快照→承诺→签名→提交→邮件）</button>
      </div>

      {activeProject && (
        <div className="card">
          <h2>历史证据包</h2>
                    <div className="row">
            <input
              type="text"
              value={packageSearch}
              onChange={(e) => setPackageSearch(e.target.value)}
              placeholder="搜索：名称 / snapshot / commitment"
            />
            <input
              type="date"
              value={packageDateFrom}
              onChange={(e) => setPackageDateFrom(e.target.value)}
            />
            <input
              type="date"
              value={packageDateTo}
              onChange={(e) => setPackageDateTo(e.target.value)}
            />
          </div>
          {filteredPackages.length === 0 && <p>?????</p>}
          {filteredPackages.map((pkg) => (
            <div key={pkg.id} className="row">
              <span>{pkg.snapshot_name || "(?????)"}</span>
              <a href={pkg.download_url} target="_blank" rel="noreferrer">下载</a>
            </div>
          ))}
        </div>
      )}

      <details className="card">
        <summary>验证（可选）</summary>
        <p>上传证据包 + 解锁材料，再选择原文文件或快照包。</p>
        <div className="row">
          <label>
            原文文件（可选）
            <input type="file" onChange={(e) => setVerifyOriginalFile(e.target.files?.[0] || null)} />
          </label>
          <label>
            解锁材料（unlock_material.json）
            <input type="file" onChange={(e) => setVerifyUnlockFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="row">
          <label>
            证据包 ZIP
            <input type="file" onChange={(e) => setVerifyBundleFile(e.target.files?.[0] || null)} />
          </label>
          <label>
            快照包 ZIP（可选）
            <input type="file" onChange={(e) => setVerifySnapshotBundle(e.target.files?.[0] || null)} />
          </label>
        </div>
        <button onClick={handleVerify}>开始验证</button>
        {verifyStatus && <p className="status">{verifyStatus}</p>}
        {verifyError && <p className="error">{verifyError}</p>}
        {verifyResult && (
          <div className="card">
            <h3>验证结果</h3>
            <pre>{JSON.stringify(verifyResult, null, 2)}</pre>
          </div>
        )}
      </details>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
