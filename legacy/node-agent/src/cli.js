#!/usr/bin/env node
/* IdeaLock Agent - workflow plugin for academic evidence stamping */
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const { execSync } = require("child_process");

let chokidar;
try {
  chokidar = require("chokidar");
} catch {
  // Optional dependency; watch command will fail with a clear message.
}

const { ethers } = require("ethers");

const CONFIG_NAME = "idealock.config.json";
const STATE_DIR = ".idealock";
const RECORDS_FILE = "records.jsonl";

function nowIso() {
  return new Date().toISOString();
}

function randomId() {
  return crypto.randomBytes(6).toString("hex");
}

function getConfigPath(rootDir) {
  return path.join(rootDir, CONFIG_NAME);
}

function getStateDir(rootDir) {
  return path.join(rootDir, STATE_DIR);
}

function getRecordsPath(rootDir) {
  return path.join(getStateDir(rootDir), RECORDS_FILE);
}

function parseArgs(argv) {
  const opts = { _: [], dirs: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (key === "dir") {
        const val = argv[i + 1];
        if (val) {
          opts.dirs.push(val);
          i += 1;
        }
      } else if (key === "password" || key === "repo" || key === "cli") {
        const val = argv[i + 1];
        if (val) {
          opts[key] = val;
          i += 1;
        }
      } else if (key === "submit" || key === "encrypt" || key === "quiet" || key === "staged") {
        opts[key] = true;
      } else if (key === "no-submit") {
        opts.submit = false;
      } else if (key === "no-encrypt") {
        opts.encrypt = false;
      } else {
        opts[key] = true;
      }
    } else {
      opts._.push(arg);
    }
  }
  return opts;
}

function log(message, quiet) {
  if (!quiet) {
    process.stdout.write(`${message}${os.EOL}`);
  }
}

function warn(message) {
  process.stderr.write(`WARN: ${message}${os.EOL}`);
}

function die(message) {
  process.stderr.write(`ERROR: ${message}${os.EOL}`);
  process.exit(1);
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function loadConfig(rootDir) {
  const configPath = getConfigPath(rootDir);
  if (!fs.existsSync(configPath)) {
    die(`Config not found. Run "node src/cli.js init --dir <path>" in ${rootDir}`);
  }
  const raw = await fsp.readFile(configPath, "utf8");
  return JSON.parse(raw);
}

async function initConfig(rootDir, dirs) {
  const configPath = getConfigPath(rootDir);
  if (fs.existsSync(configPath)) {
    die(`Config already exists at ${configPath}`);
  }

  const watchPaths = dirs.length ? dirs : ["."];
  const config = {
    version: 1,
    createdAt: nowIso(),
    agentId: `agent_${randomId()}`,
    evidenceDir: STATE_DIR,
    encryptByDefault: true,
    submitByDefault: false,
    includeExtensions: [
      ".md",
      ".txt",
      ".pdf",
      ".docx",
      ".tex",
      ".ipynb",
      ".csv",
      ".pptx",
      ".xlsx"
    ],
    watchPaths: watchPaths,
    chain: {
      network: "sepolia",
      rpcUrlEnv: "IDEALOCK_RPC_URL",
      privateKeyEnv: "IDEALOCK_PRIVATE_KEY"
    }
  };

  await ensureDir(getStateDir(rootDir));
  await ensureDir(path.join(getStateDir(rootDir), "proofs"));
  await ensureDir(path.join(getStateDir(rootDir), "cipher"));
  await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
  await fsp.writeFile(getRecordsPath(rootDir), "");
  log(`Initialized config at ${configPath}`, false);
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function encryptFile(filePath, outPath, password) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(password, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  await new Promise((resolve, reject) => {
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(outPath);
    input.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolve);
    input.pipe(cipher).pipe(output);
  });

  const tag = cipher.getAuthTag();
  return {
    algo: "AES-256-GCM",
    iv: iv.toString("hex"),
    salt: salt.toString("hex"),
    tag: tag.toString("hex"),
    path: outPath
  };
}

async function appendRecord(rootDir, record) {
  const recordsPath = getRecordsPath(rootDir);
  const line = `${JSON.stringify(record)}${os.EOL}`;
  await fsp.appendFile(recordsPath, line);
}

async function writeEvidence(rootDir, record) {
  const proofsDir = path.join(getStateDir(rootDir), "proofs");
  await ensureDir(proofsDir);
  const jsonPath = path.join(proofsDir, `${record.id}.json`);
  const mdPath = path.join(proofsDir, `${record.id}.md`);

  await fsp.writeFile(jsonPath, JSON.stringify(record, null, 2));
  const md = [
    "# IdeaLock Evidence Pack",
    "",
    `Record ID: ${record.id}`,
    `Created: ${record.createdAt}`,
    `Agent ID: ${record.agentId}`,
    "",
    "## File",
    `Path: ${record.file.path}`,
    `Size: ${record.file.size} bytes`,
    `Modified: ${record.file.mtime}`,
    "",
    "## Hash",
    `SHA-256: ${record.hash}`,
    "",
    "## Encryption",
    `Encrypted: ${record.encrypted ? "yes" : "no"}`,
    record.encrypted ? `Ciphertext: ${record.cipher.path}` : "",
    record.encrypted ? `Algo: ${record.cipher.algo}` : "",
    "",
    "## Chain (optional)",
    record.chain ? `Status: ${record.chain.status}` : "Status: not submitted",
    record.chain && record.chain.txHash ? `Tx: ${record.chain.txHash}` : "",
    record.chain && record.chain.blockNumber ? `Block: ${record.chain.blockNumber}` : "",
    record.chain && record.chain.blockTimestamp ? `Block Time: ${record.chain.blockTimestamp}` : "",
    "",
    "## Verification",
    "1) Compute SHA-256 of the original file.",
    "2) Confirm it matches the hash above.",
    "3) If a tx hash exists, verify the tx data equals the hash (0x + hex)."
  ]
    .filter(Boolean)
    .join(os.EOL);
  await fsp.writeFile(mdPath, md);
}

async function loadRecords(rootDir) {
  const recordsPath = getRecordsPath(rootDir);
  if (!fs.existsSync(recordsPath)) {
    return [];
  }
  const raw = await fsp.readFile(recordsPath, "utf8");
  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function submitToChain(hashHex, config) {
  const rpcUrl = process.env[config.chain.rpcUrlEnv] || "";
  const privateKey = process.env[config.chain.privateKeyEnv] || "";
  if (!rpcUrl || !privateKey) {
    return { status: "skipped", reason: "missing RPC URL or private key" };
  }
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  const tx = await wallet.sendTransaction({
    to: wallet.address,
    data: `0x${hashHex}`,
    value: 0
  });
  const receipt = await tx.wait();
  const block = await provider.getBlock(receipt.blockNumber);
  return {
    status: "confirmed",
    network: config.chain.network,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    blockTimestamp: block ? block.timestamp : null
  };
}

function shouldIncludeFile(filePath, config) {
  const ext = path.extname(filePath).toLowerCase();
  if (!config.includeExtensions || config.includeExtensions.length === 0) {
    return true;
  }
  return config.includeExtensions.includes(ext);
}

async function stampSingleFile(rootDir, filePath, config, opts) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    warn(`File not found: ${absPath}`);
    return null;
  }
  const stat = await fsp.stat(absPath);
  if (!stat.isFile()) {
    return null;
  }
  if (!shouldIncludeFile(absPath, config)) {
    return null;
  }

  const hashHex = await sha256File(absPath);
  const createdAt = nowIso();
  const relPath = path.relative(rootDir, absPath);
  const record = {
    id: `${createdAt.replace(/[:.]/g, "")}_${randomId()}`,
    createdAt,
    agentId: config.agentId,
    file: {
      path: relPath,
      size: stat.size,
      mtime: stat.mtime.toISOString()
    },
    hash: `sha256:${hashHex}`,
    encrypted: false
  };

  const wantsEncrypt = opts.encrypt !== undefined ? opts.encrypt : config.encryptByDefault;
  const password = opts.password || process.env.IDEALOCK_PASSWORD || "";

  if (wantsEncrypt) {
    if (password) {
      const cipherDir = path.join(getStateDir(rootDir), "cipher");
      await ensureDir(cipherDir);
      const cipherPath = path.join(cipherDir, `${hashHex}.bin`);
      const cipher = await encryptFile(absPath, cipherPath, password);
      record.encrypted = true;
      record.cipher = {
        algo: cipher.algo,
        iv: cipher.iv,
        salt: cipher.salt,
        tag: cipher.tag,
        path: path.relative(rootDir, cipher.path)
      };
    } else {
      record.encrypted = false;
      record.warn = "encrypt requested but IDEALOCK_PASSWORD not set";
      warn("Encryption requested but IDEALOCK_PASSWORD not set. Recording hash only.");
    }
  }

  const submitByDefault =
    opts.submit !== undefined
      ? opts.submit
      : process.env.IDEALOCK_AUTO_SUBMIT === "1" || config.submitByDefault;

  if (submitByDefault) {
    try {
      record.chain = await submitToChain(hashHex, config);
    } catch (err) {
      record.chain = { status: "error", error: String(err) };
      warn(`Chain submit failed: ${err}`);
    }
  }

  await appendRecord(rootDir, record);
  await writeEvidence(rootDir, record);
  log(`Stamped: ${relPath} -> ${record.hash}`, opts.quiet);
  return record;
}

async function stampStagedFiles(rootDir, config, opts) {
  let gitRoot = "";
  try {
    gitRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    die("Not a git repository. Use stamp <file> instead.");
  }
  const output = execSync("git diff --cached --name-only", { encoding: "utf8" });
  const files = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((rel) => path.resolve(gitRoot, rel));

  for (const file of files) {
    await stampSingleFile(rootDir, file, config, opts);
  }
}

async function verifyFile(rootDir, filePath, config) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    die(`File not found: ${absPath}`);
  }
  const hashHex = await sha256File(absPath);
  const records = await loadRecords(rootDir);
  const match = records.find((rec) => rec.hash === `sha256:${hashHex}`);
  if (!match) {
    log("No local record found for this file hash.", false);
    return;
  }
  log(`Found record: ${match.id}`, false);
  log(`Hash: ${match.hash}`, false);

  if (match.chain && match.chain.txHash) {
    const rpcUrl = process.env[config.chain.rpcUrlEnv] || "";
    if (!rpcUrl) {
      warn("RPC URL not set; cannot verify on-chain.");
      return;
    }
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tx = await provider.getTransaction(match.chain.txHash);
    if (!tx) {
      warn("Tx not found on chain.");
      return;
    }
    const data = (tx.data || "").toLowerCase();
    const expect = `0x${hashHex}`.toLowerCase();
    if (data === expect) {
      log("On-chain data matches the hash.", false);
    } else {
      warn("On-chain data does NOT match the hash.");
    }
  }
}

async function watchFiles(rootDir, config, opts) {
  if (!chokidar) {
    die("Missing dependency 'chokidar'. Run: npm install");
  }
  const ignored = [
    /(^|[\/\\])\../,
    /node_modules/,
    new RegExp(`${STATE_DIR.replace(".", "\\.")}([/\\\\]|$)`)
  ];

  const watcher = chokidar.watch(config.watchPaths, {
    ignored,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100
    }
  });

  log(`Watching: ${config.watchPaths.join(", ")}`, false);
  watcher.on("add", (file) => stampSingleFile(rootDir, file, config, opts));
  watcher.on("change", (file) => stampSingleFile(rootDir, file, config, opts));
}

async function installGitHook(rootDir, opts) {
  let repoRoot = opts.repo;
  if (!repoRoot) {
    try {
      repoRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
    } catch {
      die("Not a git repository. Use --repo <path>.");
    }
  }
  const cliPath = opts.cli ? path.resolve(opts.cli) : path.resolve(__dirname, "cli.js");
  const hookPath = path.join(repoRoot, ".git", "hooks", "pre-commit");
  const cliPosix = cliPath.replace(/\\/g, "/");
  const script = [
    "#!/bin/sh",
    `node "${cliPosix}" stamp --staged --quiet || true`,
    ""
  ].join("\n");
  await fsp.writeFile(hookPath, script, { mode: 0o755 });
  log(`Installed git hook at ${hookPath}`, false);
}

function showHelp() {
  const text = [
    "IdeaLock Agent",
    "",
    "Usage:",
    "  idealock init --dir <path>",
    "  idealock stamp <file> [--submit] [--encrypt] [--password <pwd>]",
    "  idealock watch [--submit]",
    "  idealock verify <file>",
    "  idealock git-hook install [--repo <path>] [--cli <path>]",
    ""
  ].join(os.EOL);
  process.stdout.write(text);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help") {
    showHelp();
    return;
  }

  const rootDir = process.cwd();
  const command = argv[0];
  const sub = argv[1];
  const opts = parseArgs(argv.slice(1));

  if (command === "init") {
    await initConfig(rootDir, opts.dirs);
    return;
  }

  const config = await loadConfig(rootDir);

  if (command === "stamp") {
    if (opts.staged) {
      await stampStagedFiles(rootDir, config, opts);
      return;
    }
    const file = argv[1];
    if (!file || file.startsWith("--")) {
      die("Missing file path. Usage: idealock stamp <file>");
    }
    await stampSingleFile(rootDir, file, config, opts);
    return;
  }

  if (command === "watch") {
    await watchFiles(rootDir, config, opts);
    return;
  }

  if (command === "verify") {
    const file = argv[1];
    if (!file) {
      die("Missing file path. Usage: idealock verify <file>");
    }
    await verifyFile(rootDir, file, config);
    return;
  }

  if (command === "git-hook" && sub === "install") {
    await installGitHook(rootDir, opts);
    return;
  }

  showHelp();
}

main().catch((err) => {
  die(err && err.stack ? err.stack : String(err));
});
