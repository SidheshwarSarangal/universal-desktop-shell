const status = document.querySelector("#status");
const bridge = window.universalDesktopShell;

if (!bridge) {
  status.textContent = "The restricted host bridge is unavailable.";
} else {
  bridge.ready();
  bridge
    .invoke("app.describe", {})
    .then((result) => {
      status.textContent = result.message;
    })
    .catch((error) => {
      status.textContent = `${error.code ?? "ERROR"}: ${error.message}`;
    });
}

