const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function sleep(ms) {
  const sab = new SharedArrayBuffer(4);
  const arr = new Int32Array(sab);
  Atomics.wait(arr, 0, 0, ms);
}

function findRcedit() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) {
    throw new Error("LOCALAPPDATA is not set, cannot locate rcedit.");
  }

  const cacheRoot = path.join(localAppData, "electron-builder", "Cache", "winCodeSign");
  if (!fs.existsSync(cacheRoot)) {
    throw new Error(`winCodeSign cache not found: ${cacheRoot}`);
  }

  const dirs = fs
    .readdirSync(cacheRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith("winCodeSign-"))
    .map((d) => d.name)
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));

  for (const dir of dirs) {
    const candidate = path.join(cacheRoot, dir, "rcedit-x64.exe");
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`rcedit-x64.exe not found under ${cacheRoot}`);
}

function runRceditWithRetry(rcedit, args) {
  const maxAttempts = 8;
  const waitMs = 1200;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync(rcedit, args, {
      windowsHide: true,
      encoding: "utf8",
    });

    if (result.status === 0) {
      return;
    }

    const stderr = `${result.stderr || ""}`.trim();
    const stdout = `${result.stdout || ""}`.trim();
    const output = [stdout, stderr].filter(Boolean).join("\n");
    const lockLike = /Unable to commit changes/i.test(output);

    if (attempt < maxAttempts && lockLike) {
      console.warn(`[afterPack:rcedit] attempt ${attempt}/${maxAttempts} failed, retrying in ${waitMs}ms`);
      sleep(waitMs);
      continue;
    }

    throw new Error(
      `rcedit failed with exit code ${result.status ?? "unknown"}${output ? `\n${output}` : ""}`
    );
  }
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "win32") {
    return;
  }

  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);

  if (!fs.existsSync(exePath)) {
    throw new Error(`Executable not found: ${exePath}`);
  }

  const winConfig = context.packager.config.win || {};
  const iconPath = winConfig.icon
    ? path.resolve(context.packager.projectDir, winConfig.icon)
    : null;

  const args = [
    exePath,
    "--set-version-string",
    "FileDescription",
    appInfo.productName,
    "--set-version-string",
    "ProductName",
    appInfo.productName,
    "--set-version-string",
    "LegalCopyright",
    appInfo.copyright,
    "--set-file-version",
    appInfo.shortVersion || appInfo.buildVersion,
    "--set-product-version",
    appInfo.shortVersionWindows || appInfo.getVersionInWeirdWindowsForm(),
    "--set-version-string",
    "InternalName",
    path.basename(exeName, ".exe"),
    "--set-version-string",
    "OriginalFilename",
    exeName,
  ];

  if (appInfo.companyName) {
    args.push("--set-version-string", "CompanyName", appInfo.companyName);
  }

  if (iconPath && fs.existsSync(iconPath)) {
    args.push("--set-icon", iconPath);
  }

  runRceditWithRetry(findRcedit(), args);
};
