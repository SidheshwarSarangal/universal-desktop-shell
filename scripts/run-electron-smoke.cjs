const { spawnSync } = require("node:child_process");
const electron = require("electron");

const environment = { ...process.env };
delete environment.ELECTRON_RUN_AS_NODE;

const result = spawnSync(
  electron,
  ["--headless", "--disable-gpu", "tests/electron-smoke.cjs"],
  { cwd: process.cwd(), env: environment, stdio: "inherit" }
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

