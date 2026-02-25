import { useMemo, useState } from "react";

export default function App() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [unlockFile, setUnlockFile] = useState<File | null>(null);
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [snapshotBundle, setSnapshotBundle] = useState<File | null>(null);
  const [result, setResult] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const apiBase = useMemo(
    () => (import.meta.env.VITE_API_BASE_URL as string) || "http://localhost:8000",
    []
  );

  async function handleVerify() {
    setError("");
    setStatus("Verifying...");
    setResult(null);

    if (!unlockFile || !bundleFile) {
      setError("请上传 unlock_material.json 和证据包 ZIP");
      setStatus("");
      return;
    }

    const form = new FormData();
    form.append("unlock_material", unlockFile);
    form.append("bundle", bundleFile);
    if (snapshotBundle) {
      form.append("snapshot_bundle", snapshotBundle);
    }
    if (originalFile) {
      form.append("original_file", originalFile);
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
      setResult(data);
      setStatus("验证完成");
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证失败");
      setStatus("");
    }
  }

  return (
    <div className="page">
      <h1>IdeaLock Verify (M4)</h1>
      <p>上传证据包 + 解锁材料，再选择原文文件或快照包。</p>

      <div className="card">
        <h2>1. 原文文件（可选）</h2>
        <input type="file" onChange={(e) => setOriginalFile(e.target.files?.[0] || null)} />
      </div>

      <div className="card">
        <h2>2. 解锁材料（unlock_material.json）</h2>
        <input type="file" onChange={(e) => setUnlockFile(e.target.files?.[0] || null)} />
      </div>

      <div className="card">
        <h2>3. 证据包 ZIP</h2>
        <input type="file" onChange={(e) => setBundleFile(e.target.files?.[0] || null)} />
      </div>

      <div className="card">
        <h2>4. 快照包 ZIP（可选，替代原文文件夹）</h2>
        <input type="file" onChange={(e) => setSnapshotBundle(e.target.files?.[0] || null)} />
      </div>

      <button onClick={handleVerify}>开始验证</button>

      {status && <p className="status">{status}</p>}
      {error && <p className="error">{error}</p>}

      {result && (
        <div className="card">
          <h3>验证结果</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
