/* Estimate request form. Answers live in the page only: nothing is written to
   browser storage, cookies or the service-worker cache.
   Without a configured endpoint the page sends nothing: it prepares a message
   the visitor sends from their own mail app. */
(() => {
  "use strict";
  const form = document.querySelector("#estimate-form");
  const core = window.ImmoInquiry;
  if (!form || !core) return;
  const cfg = window.IMMO_INQUIRY || {};
  const endpoint =
    typeof cfg.endpoint === "string" && cfg.endpoint.startsWith("/")
      ? cfg.endpoint
      : "";
  const $ = (s) => document.querySelector(s);
  const steps = [...form.querySelectorAll("[data-step]")];
  const status = $("#form-status"),
    progress = $("#estimate-progress"),
    result = $("#estimate-result"),
    submit = $("#estimate-submit"),
    phoneHint = $("#hint-telephone");
  const STEP_FIELDS = [
    ["commune", "type", "delai"],
    ["prenom", "telephone", "email", "rappel", "message"],
  ];
  const STEP_NAMES = ["Votre bien", "Vos coordonnées"];
  let step = 0,
    dirty = false,
    busy = false,
    key = "",
    token = "",
    lib = null,
    libRequest = null;

  document.body.dataset.inquiryMode = endpoint ? "api" : "mail";
  for (const el of document.querySelectorAll("[data-when]"))
    el.hidden = el.dataset.when !== document.body.dataset.inquiryMode;
  submit.textContent = endpoint ? "Envoyer ma demande" : "Préparer mon message";

  const field = (name) => form.elements[name];
  const read = (name) => {
    const el = field(name);
    return el ? String(el.value ?? "") : "";
  };
  const values = () =>
    Object.fromEntries(core.FIELDS.map((name) => [name, read(name)]));

  /* The phone library is fetched only when the contact step opens. */
  function loadPhoneLibrary() {
    if (lib) return Promise.resolve(lib);
    if (!libRequest)
      libRequest = new Promise((resolve) => {
        const s = document.createElement("script");
        s.src = "/vendor/libphonenumber-min.js";
        s.onload = () => resolve((lib = window.libphonenumber || null));
        s.onerror = () => resolve(null);
        document.head.append(s);
      });
    return libRequest;
  }

  function setError(name, message) {
    const el = field(name),
      box = $("#err-" + name);
    if (!box) return;
    box.textContent = message || "";
    box.hidden = !message;
    const targets = el instanceof RadioNodeList ? [...el] : [el];
    for (const t of targets) {
      if (message) t.setAttribute("aria-invalid", "true");
      else t.removeAttribute("aria-invalid");
    }
    const group = box.closest("[data-field]");
    if (group) group.classList.toggle("has-error", Boolean(message));
  }
  function focusField(name) {
    const el = field(name);
    const target =
      el instanceof RadioNodeList
        ? [...el].find((r) => r.checked) || el[0]
        : el;
    const details = target.closest("details");
    if (details) details.open = true;
    target.focus();
  }
  function showErrors(errors, names) {
    let first = "";
    for (const name of names) {
      setError(name, errors[name]);
      if (errors[name] && !first) first = name;
    }
    if (first) {
      const count = names.filter((n) => errors[n]).length;
      status.textContent =
        count > 1
          ? `${count} champs sont à vérifier.`
          : "Un champ est à vérifier.";
      focusField(first);
    }
    return !first;
  }

  function recap() {
    const v = values();
    $("#recap-bien").textContent = [v.type, v.commune.trim(), v.delai]
      .filter(Boolean)
      .join(" · ");
  }
  function show(n, focus = true) {
    step = n;
    steps.forEach((g, i) => {
      g.hidden = i !== n;
      g.disabled = i !== n;
    });
    form.hidden = false;
    result.hidden = true;
    progress.textContent = `Étape ${n + 1} sur 2 · ${STEP_NAMES[n]}`;
    progress.dataset.step = String(n + 1);
    status.textContent = "";
    // The status line sits just above the main button of the visible step.
    steps[n].querySelector(".estimate-actions, .estimate-main").before(status);
    if (n === 1) {
      recap();
      loadPhoneLibrary().then(updatePhoneHint);
      startTurnstile();
    }
    if (focus) {
      const legend = steps[n].querySelector("legend");
      legend.tabIndex = -1;
      legend.focus();
    }
  }
  function showResult(name) {
    form.hidden = true;
    result.hidden = false;
    for (const panel of result.querySelectorAll("[data-result]"))
      panel.hidden = panel.dataset.result !== name;
    progress.textContent =
      name === "sent" ? "Demande envoyée" : "Message prêt à envoyer";
    progress.dataset.step = "3";
    const heading = result.querySelector(`[data-result="${name}"] h2`);
    heading.tabIndex = -1;
    heading.focus();
  }

  function updatePhoneHint() {
    const raw = read("telephone").trim();
    if (!raw) {
      phoneHint.textContent = "Numéro belge ou français.";
      return;
    }
    const p = core.parsePhone(raw, lib);
    phoneHint.textContent = p
      ? `Numéro ${p.country === "BE" ? "belge" : "français"} reconnu${p.display ? " : " + p.display : ""}.`
      : "Numéro belge ou français.";
  }

  function mailPanel(v) {
    const text = core.mailText(v);
    $("#message-preview").textContent = text;
    $("#send-mail").href =
      "mailto:martin.s@connexionimmo.be?subject=" +
      encodeURIComponent("Mon projet immobilier") +
      "&body=" +
      encodeURIComponent(text);
    showResult("mail");
  }

  /* Turnstile is loaded only when a site key and an endpoint are configured.
     Its token is checked by the server, never trusted here. */
  function startTurnstile() {
    const slot = $("#turnstile-slot");
    if (!endpoint || !cfg.turnstileSiteKey || slot.dataset.ready) return;
    slot.dataset.ready = "1";
    slot.hidden = false;
    const render = () =>
      window.turnstile.render(slot, {
        sitekey: cfg.turnstileSiteKey,
        callback: (t) => (token = t),
        "expired-callback": () => (token = ""),
        "error-callback": () => (token = ""),
      });
    if (window.turnstile) return render();
    const s = document.createElement("script");
    s.src =
      typeof cfg.turnstileScript === "string" &&
      cfg.turnstileScript.startsWith("/")
        ? cfg.turnstileScript
        : "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = render;
    s.onerror = () => (slot.hidden = true);
    document.head.append(s);
  }

  function failure(message) {
    status.textContent = "";
    const box = $("#send-failure");
    $("#send-failure-text").textContent = message;
    box.hidden = false;
    box.tabIndex = -1;
    box.focus();
  }

  async function send(v) {
    if (cfg.turnstileSiteKey && !token) {
      status.textContent =
        "La vérification anti-robot n’est pas terminée. Patientez un instant puis réessayez.";
      return;
    }
    if (!key) key = crypto.randomUUID();
    busy = true;
    submit.disabled = true;
    submit.textContent = "Envoi en cours…";
    $("#send-failure").hidden = true;
    status.textContent = "Envoi de votre demande…";
    const abort = new AbortController(),
      timer = setTimeout(() => abort.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          ...values(),
          website: read("website"),
          turnstileToken: token,
        }),
        credentials: "omit",
        cache: "no-store",
        signal: abort.signal,
      });
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      if (response.ok && data && data.ok === true) {
        dirty = false;
        $("#sent-recap").textContent = [v.type, v.commune, v.delai].join(" · ");
        $("#sent-callback").textContent = v.rappel
          ? `Votre préférence de rappel : ${v.rappel.toLowerCase()}. C’est une indication, pas un rendez-vous.`
          : "";
        showResult("sent");
        return;
      }
      if (response.status === 422 && data && data.errors) {
        const names = STEP_FIELDS.flat();
        const firstStep = STEP_FIELDS[0].some((n) => data.errors[n]) ? 0 : 1;
        if (firstStep !== step) show(firstStep, false);
        showErrors(data.errors, names);
        return;
      }
      failure(
        response.status === 429
          ? "Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes, ou contactez Martin directement."
          : "L’envoi n’a pas abouti. Vos réponses sont toujours là : vous pouvez réessayer, ou contacter Martin directement.",
      );
    } catch {
      failure(
        navigator.onLine === false
          ? "Vous semblez hors connexion. Vos réponses sont toujours là : réessayez une fois reconnecté."
          : "L’envoi n’a pas abouti. Vos réponses sont toujours là : vous pouvez réessayer, ou contacter Martin directement.",
      );
    } finally {
      clearTimeout(timer);
      busy = false;
      submit.disabled = false;
      submit.textContent = "Envoyer ma demande";
      if (window.turnstile && cfg.turnstileSiteKey && result.hidden)
        try {
          window.turnstile.reset();
          token = "";
        } catch {
          /* The widget is optional for the page to keep working. */
        }
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    if (step === 1) await loadPhoneLibrary();
    const check = core.validate(values(), lib);
    if (!showErrors(check.errors, STEP_FIELDS[step])) return;
    if (step === 0) return show(1);
    if (!endpoint) {
      dirty = false;
      return mailPanel(check.value);
    }
    send(check.value);
  });
  /* Enter or the keyboard Go key submits the visible step: the browser default
     button would be the first one, which sits in the hidden step. */
  form.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.isComposing || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    form.requestSubmit(steps[step].querySelector("button[type=submit]"));
  });
  form.addEventListener("input", (e) => {
    dirty = true;
    key = "";
    const name = e.target.name;
    if (name && $("#err-" + name) && !$("#err-" + name).hidden)
      setError(name, "");
    if (name === "telephone") updatePhoneHint();
    $("#send-failure").hidden = true;
  });
  for (const b of document.querySelectorAll("[data-back]"))
    b.addEventListener("click", () => show(Number(b.dataset.back)));
  $("#use-mail").addEventListener("click", async () => {
    await loadPhoneLibrary();
    const check = core.validate(values(), lib);
    if (showErrors(check.errors, STEP_FIELDS[1])) mailPanel(check.value);
  });
  $("#copy-message").addEventListener("click", async () => {
    const preview = $("#message-preview"),
      note = $("#mail-status");
    try {
      await navigator.clipboard.writeText(preview.textContent);
      note.textContent =
        "Message copié. Vous pouvez le coller dans votre messagerie.";
    } catch {
      const r = document.createRange();
      r.selectNodeContents(preview);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      note.textContent = "Le texte est sélectionné : copiez-le.";
    }
  });
  $("#send-mail").addEventListener("click", () => {
    $("#mail-status").textContent =
      "Vérifiez votre messagerie puis envoyez le message. Ce site ne peut pas confirmer son envoi.";
  });
  window.addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  /* A local page may pass the commune so the visitor does not retype it. */
  const params = new URLSearchParams(location.search);
  const commune = core.clean(params.get("commune") || "");
  if (commune && core.validate({ commune }).errors.commune === undefined)
    field("commune").value = commune;
  const origine = core.clean(params.get("origine") || "");
  field("origine").value = /^[a-z0-9/_.-]{1,120}$/i.test(origine)
    ? origine
    : "/estimation/";
  show(0, false);
})();
