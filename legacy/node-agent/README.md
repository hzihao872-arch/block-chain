# Legacy Node Agent (EVM PoC)

This folder contains the early Node.js CLI that writes file hashes into an
Ethereum transaction (self-transfer). It is kept for reference only.

Why legacy:
- Requires private key and gas.
- Not integrated with OpenTimestamps evidence packs.
- Desktop UI is built on the Python agent.

If you still want to run it (not recommended):
1) npm install
2) node src/cli.js init --dir <path>
3) node src/cli.js watch
4) node src/cli.js stamp <file>
