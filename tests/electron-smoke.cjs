const { join } = require("node:path");
const { app } = require("electron");
const { z } = require("zod");
const { runDesktopShellApp } = require("../dist");

let controller;
let invoked = false;
let finishing = false;

async function finish(exitCode) {
  if (finishing) return;
  finishing = true;
  clearTimeout(timeout);
  if (controller) await controller.stop();
  process.exitCode = exitCode;
  app.quit();
}

function maybeFinish() {
  if (invoked && controller && !finishing) {
    console.log("electron-smoke: bridge action invoked successfully");
    void finish(0);
  }
}

const timeout = setTimeout(() => {
  console.error("electron-smoke: timed out before the renderer invoked the host action");
  void finish(1);
}, 15_000);

void runDesktopShellApp({
  shell: {
    stateAdapter: {
      load: async () => undefined,
      save: async () => undefined
    },
    actions: {
      "app.describe": {
        capability: "app.basic",
        input: z.object({}),
        output: z.object({ name: z.string(), message: z.string() }),
        handler: () => {
          invoked = true;
          setImmediate(maybeFinish);
          return { name: "Smoke", message: "Bridge verified" };
        }
      }
    }
  },
  createPrimary: (desktopShell) =>
    desktopShell.createWindow("main", {
      title: "Universal Desktop Shell Smoke Test",
      showOnReady: false,
      capabilities: ["app.basic"],
      frontend: {
        mode: "production",
        indexPath: join(__dirname, "..", "examples", "basic", "frontend", "index.html")
      }
    })
}).then((result) => {
  if (!result) {
    console.error("electron-smoke: could not acquire the application instance lock");
    process.exitCode = 1;
    return;
  }
  controller = result;
  maybeFinish();
});
