const { existsSync, readdirSync, statSync } = require("node:fs");

const budgets = [
  ["dist/index.js", 1024 * 1024],
  ["dist/preload.js", 150 * 1024],
  ["dist/renderer.js", 50 * 1024]
];

let failed = false;
for (const [file, maximum] of budgets) {
  const bytes = statSync(file).size;
  console.log(`budget: ${file} ${bytes} / ${maximum} bytes`);
  if (bytes > maximum) {
    console.error(`budget exceeded: ${file}`);
    failed = true;
  }
}

if (existsSync("dist")) {
  const sourceMaps = readdirSync("dist").filter((file) => file.endsWith(".map"));
  if (sourceMaps.length > 0) {
    console.error(`unexpected production source maps: ${sourceMaps.join(", ")}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;
