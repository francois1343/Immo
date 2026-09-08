const INSTALL_STATE_KEY = "martin-immo-install-state";

const installBanner = document.querySelector("#install-banner");
const installButton = document.querySelector("#install-app");
const dismissButton = document.querySelector("#dismiss-install");

let deferredInstallPrompt = null;

const propertyTypeInputs = document.querySelectorAll(
  '#lead-form input[name="type"]'
);
const surfaceFields = document.querySelector("#surface-fields");
const surfaceGrid = document.querySelector("#surface-grid");
const habitableField = document.querySelector("#surface-habitable-field");
const habitableInput = document.querySelector("#surfaceHabitable");
const terrainInput = document.querySelector("#surfaceTerrain");
const estimationSubmitButton = document.querySelector(
  '#lead-form button[type="submit"]'
);

function updateSurfaceFields(type) {
  if (!surfaceFields || !habitableField || !habitableInput || !terrainInput) {
    return;
  }

  const isHouse = type === "maison";
  surfaceFields.hidden = false;
  habitableField.hidden = !isHouse;
  habitableInput.disabled = !isHouse;
  habitableInput.required = isHouse;
  terrainInput.disabled = false;
  terrainInput.required = true;
  surfaceGrid?.classList.toggle("single-column", !isHouse);
}

propertyTypeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (!surfaceFields?.hidden) {
      updateSurfaceFields(input.value);
    }
  });
});

estimationSubmitButton?.addEventListener("click", (event) => {
  if (!surfaceFields?.hidden) {
    return;
  }

  const selectedPropertyType = document.querySelector(
    '#lead-form input[name="type"]:checked'
  );

  if (!selectedPropertyType) {
    return;
  }

  event.preventDefault();
  updateSurfaceFields(selectedPropertyType.value);

  const firstSurfaceInput =
    selectedPropertyType.value === "maison" ? habitableInput : terrainInput;
  firstSurfaceInput?.focus();
});

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
