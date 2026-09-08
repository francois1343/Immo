const INSTALL_STATE_KEY = "martin-immo-install-state";

const installBanner = document.querySelector("#install-banner");
const installButton = document.querySelector("#install-app");
const dismissButton = document.querySelector("#dismiss-install");

let deferredInstallPrompt = null;

function readInstallState() {
  try {
    return window.localStorage.getItem(INSTALL_STATE_KEY);
  } catch {
    return null;
  }
}

function saveInstallState(state) {
  try {
    window.localStorage.setItem(INSTALL_STATE_KEY, state);
  } catch {
    // L'interface reste fonctionnelle si le stockage est désactivé.
  }
}

function hideInstallBanner() {
  installBanner.hidden = true;
}

const isStandalone =
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

if (isStandalone) {
  saveInstallState("installed");
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;

  if (!isStandalone && readInstallState() === null) {
    installBanner.hidden = false;
  }
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  saveInstallState(outcome === "accepted" ? "installed" : "dismissed");
  deferredInstallPrompt = null;
  hideInstallBanner();
});

dismissButton.addEventListener("click", () => {
  saveInstallState("dismissed");
  hideInstallBanner();
});

window.addEventListener("appinstalled", () => {
  saveInstallState("installed");
  deferredInstallPrompt = null;
  hideInstallBanner();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Le site reste utilisable si l'enregistrement hors ligne échoue.
    });
  });
}
