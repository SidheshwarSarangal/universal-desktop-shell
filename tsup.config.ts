import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      renderer: "src/renderer.ts"
    },
    format: ["cjs"],
    platform: "node",
    target: "node22",
    dts: true,
    sourcemap: false,
    clean: true,
    external: ["electron"],
    treeshake: true
  },
  {
    entry: { preload: "src/preload.ts" },
    format: ["cjs"],
    platform: "node",
    target: "node22",
    dts: false,
    sourcemap: false,
    clean: false,
    external: ["electron"],
    treeshake: true
  }
]);
