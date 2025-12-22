const fs = require("fs");
const path = require("path");

// Source and destination directories for staking assets (IDLs, keypairs, etc.)
const srcDir = path.join(__dirname, "..", "src", "staking");
const destDir = path.join(__dirname, "..", "dist", "staking");

// If source staking folder doesn't exist, nothing to do
if (!fs.existsSync(srcDir)) {
  process.exit(0);
}

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy all JSON files (IDLs, wallet keypairs, etc.) from src/staking to dist/staking
for (const file of fs.readdirSync(srcDir)) {
  if (!file.toLowerCase().endsWith(".json")) continue;

  const from = path.join(srcDir, file);
  const to = path.join(destDir, file);

  try {
    fs.copyFileSync(from, to);
    // eslint-disable-next-line no-console
    console.log(`[copy-staking-assets] Copied ${file} -> dist/staking`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`[copy-staking-assets] Failed to copy ${file}:`, err);
    process.exitCode = 1;
  }
}


