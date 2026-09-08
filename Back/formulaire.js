document.addEventListener("DOMContentLoaded", () => {
  let currentStep = 1;
  const totalSteps = 3;

  const steps = document.querySelectorAll(".form-step");
  const progressBar = document.getElementById("progressBar");
  const btnNext = document.getElementById("btnNext");
  const btnPrev = document.getElementById("btnPrev");
  const btnSubmit = document.getElementById("btnSubmit");
  const navButtons = document.getElementById("navButtons");
  const form = document.getElementById("conversationalForm");

  const messageInput = document.getElementById("message");
  const charCountDisplay = document.getElementById("charCount");

  if (messageInput && charCountDisplay) {
    messageInput.addEventListener("input", () => {
      charCountDisplay.textContent = messageInput.value.length;
    });
  }

  function updateStep(step) {
    steps.forEach((s) => {
      if (parseInt(s.dataset.step) === step) {
        s.classList.add("active");
      } else {
        s.classList.remove("active");
      }
    });

    const progressPercent = (step / totalSteps) * 100;
    progressBar.style.width = `${Math.min(progressPercent, 100)}%`;

    btnPrev.style.display = step > 1 && step <= totalSteps ? "block" : "none";

    if (step === totalSteps) {
      btnNext.style.display = "none";
      btnSubmit.style.display = "block";
    } else if (step > totalSteps) {
      navButtons.style.display = "none";
    } else {
      btnNext.style.display = "block";
      btnSubmit.style.display = "none";
    }
  }

  function validateCurrentStep() {
    const activeStepElement = document.querySelector(
      `.form-step[data-step="${currentStep}"]`,
    );

    // Vérification des radios
    const radios = activeStepElement.querySelectorAll('input[type="radio"]');
    if (radios.length > 0) {
      const hasChecked = Array.from(radios).some((r) => r.checked);
      if (!hasChecked) {
        alert("Veuillez sélectionner une option pour continuer.");
        return false;
      }
      return true;
    }

    // Vérification des inputs textes requis
    const inputs = activeStepElement.querySelectorAll("input:required");
    for (let input of inputs) {
      if (!input.checkValidity()) {
        input.reportValidity();
        return false;
      }
    }
    return true;
  }

  // Passage automatique fluide à la sélection d'une carte
  document
    .querySelectorAll('.card-option input[type="radio"]')
    .forEach((radio) => {
      radio.addEventListener("change", () => {
        setTimeout(() => {
          if (currentStep < totalSteps) {
            currentStep++;
            updateStep(currentStep);
          }
        }, 300);
      });
    });

  btnNext.addEventListener("click", () => {
    if (validateCurrentStep() && currentStep < totalSteps) {
      currentStep++;
      updateStep(currentStep);
    }
  });

  btnPrev.addEventListener("click", () => {
    if (currentStep > 1) {
      currentStep--;
      updateStep(currentStep);
    }
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (validateCurrentStep()) {
      const formData = new FormData(form);
      const data = Object.fromEntries(formData.entries());

      console.log("Données capturées :", data);

      currentStep = 4;
      updateStep(currentStep);
    }
  });
});
