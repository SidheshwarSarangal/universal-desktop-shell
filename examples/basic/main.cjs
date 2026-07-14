const { join } = require("node:path");
const { shell } = require("electron");
const { z } = require("zod");
const { runDesktopShellApp } = require("../..");

void runDesktopShellApp({
  shell: {
    actions: {
      "app.describe": {
        capability: "app.basic",
        input: z.object({}),
        output: z.object({ name: z.string(), message: z.string() }),
        handler: () => ({
          name: "Universal Desktop Shell",
          message: "A plain HTML frontend is talking through a validated host capability."
        })
      }
    },
    onExternalLink: (url) => shell.openExternal(url.href)
  },
  createPrimary: (desktopShell) =>
    desktopShell.createWindow("main", {
      title: "Universal Desktop Shell Example",
      size: { width: 960, height: 640 },
      minimumSize: { width: 640, height: 480 },
      restoreState: true,
      capabilities: ["app.basic"],
      frontend: {
        mode: "production",
        indexPath: join(__dirname, "frontend", "index.html")
      }
    })
});

