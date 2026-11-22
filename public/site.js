(() => {
  "use strict";
  if (location.pathname === "/" || location.pathname === "/index.html") {
    if (location.hash === "#formulaire-estimation")
      location.replace("/estimation/");
  }
  const form = document.querySelector("#project-form");
  let dirty = false;
  if (form) {
    const groups = [...form.querySelectorAll("[data-step]")],
      status = document.querySelector("#form-status");
    let step = 0;
    const val = (n) => form.elements[n].value.trim();
    function show(n) {
      step = n;
      groups.forEach((g, i) => {
        g.hidden = i !== n;
        g.disabled = i !== n;
      });
      document.querySelectorAll(".steps li").forEach((li, i) => {
        if (i === n) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });
      status.textContent = "";
      groups[n].querySelector("legend").tabIndex = -1;
      groups[n].querySelector("legend").focus();
    }
    form.addEventListener("input", () => {
      dirty = true;
    });
    form.addEventListener("change", () => {
      dirty = true;
    });
    form.elements.canal.addEventListener("change", () => {
      const input = form.elements.contact,
        phone = val("canal") === "telephone";
      input.type = phone ? "tel" : "email";
      input.autocomplete = phone ? "tel" : "email";
      input.value = "";
      input.parentNode.firstChild.textContent = phone
        ? "Votre téléphone"
        : "Votre adresse e-mail";
    });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const controls = [
        ...groups[step].querySelectorAll("input,select,textarea"),
      ];
      const bad = controls.find(
        (x) => !x.checkValidity() || (x.required && !x.value.trim()),
      );
      if (bad) {
        status.textContent = "Complétez les champs indiqués pour continuer.";
        bad.reportValidity();
        bad.focus();
        return;
      }
      if (
        step === 1 &&
        val("canal") === "telephone" &&
        !/^[+() 0-9.\-]{6,30}$/.test(val("contact"))
      ) {
        status.textContent = "Vérifiez le numéro de téléphone.";
        form.elements.contact.focus();
        return;
      }
      if (step === 0) {
        show(1);
        return;
      }
      if (step === 1) {
        const message = [
          "Bonjour Martin,",
          "",
          `Je souhaite échanger au sujet d’un bien à ${val("commune")}.`,
          `Type : ${val("type")}`,
          `Calendrier : ${val("delai")}`,
          `Prénom : ${val("prenom")}`,
          `Contact (${val("canal")}) : ${val("contact")}`,
          val("message") ? "Précision : " + val("message") : "",
          "",
          "Merci.",
        ]
          .filter((x) => x !== undefined)
          .join("\n");
        document.querySelector("#message-preview").textContent = message;
        document.querySelector("#send-mail").href =
          "mailto:martin.s@connexionimmo.be?subject=" +
          encodeURIComponent("Mon projet immobilier") +
          "&body=" +
          encodeURIComponent(message);
        show(2);
      }
    });
    form
      .querySelectorAll("[data-back]")
      .forEach((b) => (b.onclick = () => show(step - 1)));
    document.querySelector("#copy-message").onclick = async () => {
      try {
        await navigator.clipboard.writeText(
          document.querySelector("#message-preview").textContent,
        );
        status.textContent =
          "Message copié. Vous pouvez le coller dans votre messagerie.";
      } catch {
        status.textContent = "Sélectionnez le texte du message pour le copier.";
        const r = document.createRange();
        r.selectNodeContents(document.querySelector("#message-preview"));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      }
    };
    document.querySelector("#send-mail").onclick = () => {
      dirty = false;
      status.textContent =
        "Vérifiez votre messagerie puis envoyez le message. Ce site ne peut pas confirmer son envoi.";
    };
    window.addEventListener("beforeunload", (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
  }
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("/service-worker.js").catch(() => {}),
    );
})();
