/* Shared rules for an estimate request. Loaded by the page and by the future
   server handler, so both sides refuse exactly the same things.
   Pure functions: no network, no storage, no DOM. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ImmoInquiry = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";
  const TYPES = ["Maison", "Appartement", "Terrain", "Autre bien"];
  const DELAYS = [
    "Dès que possible",
    "Dans les six mois",
    "Plus tard",
    "Je me renseigne",
  ];
  const CALLBACKS = ["Matin", "Après-midi", "Soirée", "Peu importe"];
  const FIELDS = [
    "commune",
    "type",
    "delai",
    "prenom",
    "telephone",
    "email",
    "rappel",
    "message",
    "origine",
  ];
  const LIMITS = {
    commune: 80,
    prenom: 60,
    telephone: 30,
    email: 120,
    message: 300,
    origine: 120,
  };
  const MESSAGES = {
    commune: "Indiquez la commune du bien.",
    type: "Choisissez le type de bien.",
    delai: "Choisissez votre calendrier.",
    prenom: "Indiquez votre prénom.",
    telephone:
      "Vérifiez le numéro : nous acceptons les numéros belges et français, par exemple 0493 12 34 56.",
    email: "Vérifiez l’adresse e-mail, ou laissez ce champ vide.",
    rappel: "Choisissez une préférence de rappel proposée.",
    message: "Votre précision est trop longue (300 caractères au maximum).",
    origine: "Origine non reconnue.",
  };
  const clean = (v) =>
    typeof v === "string"
      ? v
          .normalize("NFC")
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
  const NAME = /^[\p{L}][\p{L}\p{M}' ’.-]*$/u;
  const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;

  /* Strict fallback used only when libphonenumber could not be loaded in the
     browser. The server always validates with the library. */
  function fallbackPhone(raw) {
    const d = clean(raw).replace(/[\s./()-]/g, "");
    let m;
    if ((m = /^(?:\+32|0032|0)(4[5-9]\d{7})$/.exec(d)))
      return { e164: "+32" + m[1], country: "BE" };
    if ((m = /^(?:\+32|0032|0)([1-9]\d{7})$/.exec(d)) && m[1][0] !== "4")
      return { e164: "+32" + m[1], country: "BE" };
    if ((m = /^(?:\+33|0033)([1-9]\d{8})$/.exec(d)))
      return { e164: "+33" + m[1], country: "FR" };
    if ((m = /^0([1-35-9]\d{8})$/.exec(d)))
      return { e164: "+33" + m[1], country: "FR" };
    return null;
  }

  /* lib: the libphonenumber-js module or browser global. Belgium is tried
     first, then France; any other country is refused. */
  function parsePhone(raw, lib) {
    const text = clean(raw);
    if (!text || text.length > LIMITS.telephone || /[^\d\s+./()-]/.test(text))
      return null;
    if (!lib || typeof lib.parsePhoneNumberFromString !== "function")
      return fallbackPhone(text);
    for (const country of ["BE", "FR"]) {
      let n;
      try {
        n = lib.parsePhoneNumberFromString(text, country);
      } catch {
        n = null;
      }
      if (n && n.isValid() && (n.country === "BE" || n.country === "FR"))
        return {
          e164: n.number,
          country: n.country,
          display: n.formatInternational(),
        };
    }
    return null;
  }

  /* Returns {ok, value, errors}. `value` holds only known, normalised fields;
     anything else in the input is dropped. */
  function validate(input, lib) {
    const src = input && typeof input === "object" ? input : {};
    const errors = {},
      value = {};
    const text = (k) => clean(src[k]);
    const commune = text("commune");
    if (!commune || commune.length > LIMITS.commune || !NAME.test(commune))
      errors.commune = MESSAGES.commune;
    else value.commune = commune;
    for (const [k, list] of [
      ["type", TYPES],
      ["delai", DELAYS],
    ]) {
      if (list.includes(src[k])) value[k] = src[k];
      else errors[k] = MESSAGES[k];
    }
    const prenom = text("prenom");
    if (!prenom || prenom.length > LIMITS.prenom || !NAME.test(prenom))
      errors.prenom = MESSAGES.prenom;
    else value.prenom = prenom;
    const phone = parsePhone(src.telephone, lib);
    if (phone) {
      value.telephone = phone.e164;
      value.pays = phone.country;
    } else errors.telephone = MESSAGES.telephone;
    const email = text("email");
    if (email) {
      if (email.length > LIMITS.email || !EMAIL.test(email))
        errors.email = MESSAGES.email;
      else value.email = email;
    }
    if (src.rappel !== undefined && src.rappel !== "") {
      if (CALLBACKS.includes(src.rappel)) value.rappel = src.rappel;
      else errors.rappel = MESSAGES.rappel;
    }
    const message = text("message");
    if (message) {
      if (message.length > LIMITS.message) errors.message = MESSAGES.message;
      else value.message = message;
    }
    const origine = text("origine");
    if (origine) {
      if (origine.length > LIMITS.origine || !/^[a-z0-9/_.-]+$/i.test(origine))
        errors.origine = MESSAGES.origine;
      else value.origine = origine;
    }
    return { ok: Object.keys(errors).length === 0, value, errors };
  }

  /* The text a visitor can send from their own mail app when no reception
     service is connected, or when it fails. */
  function mailText(v) {
    return [
      "Bonjour Martin,",
      "",
      `Je souhaite échanger au sujet d’un bien à ${v.commune}.`,
      `Type : ${v.type}`,
      `Calendrier : ${v.delai}`,
      `Prénom : ${v.prenom}`,
      `Téléphone : ${v.telephone}`,
      v.email ? `E-mail : ${v.email}` : null,
      v.rappel ? `Préférence de rappel : ${v.rappel}` : null,
      v.message ? `Précision : ${v.message}` : null,
      "",
      "Merci.",
    ]
      .filter((x) => x !== null)
      .join("\n");
  }

  return {
    TYPES,
    DELAYS,
    CALLBACKS,
    FIELDS,
    LIMITS,
    MESSAGES,
    clean,
    parsePhone,
    validate,
    mailText,
  };
});
