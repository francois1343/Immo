/* Delivery of an estimate request by e-mail, through the SMTP server of the
   business. Nothing is kept by the site: the request exists as the e-mail
   received in the inbox.
   Settings come from the environment; only the password is secret and it is
   never written in the repository (SMTP_PASSWORD, in .env.local or in the
   environment variables of the host). */
export function mailSettings(env = process.env) {
  return {
    host: env.SMTP_HOST || "mail.immobiliermartin.be",
    port: Number(env.SMTP_PORT) || 465,
    /* The server answers with the certificate of its hosting platform: the
       connection is verified against that name. */
    tlsName: env.SMTP_TLS_NAME || "mail.lwspanel.com",
    user: env.SMTP_USER || "no-reply@immobiliermartin.be",
    password: env.SMTP_PASSWORD || "",
    /* Sender: the no-reply mailbox, used for sending only. */
    from: env.MAIL_FROM || env.SMTP_USER || "no-reply@immobiliermartin.be",
    /* Recipient: where the requests must arrive. */
    to: env.MAIL_TO || "info@immobiliermartin.be",
  };
}
/* Reception is switched on by the password alone. */
export const mailConfigured = (env = process.env) => Boolean(mailSettings(env).password);

export function transportOptions(settings) {
  return {
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    requireTLS: true,
    tls: { servername: settings.tlsName },
    auth: { user: settings.user, pass: settings.password },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  };
}

const line = (s) => String(s ?? "").replace(/[\r\n]+/g, " ").trim();
/* The message Martin receives. `record` is a validated request. */
export function inquiryMail(record, settings) {
  const rows = [
    ["Commune", record.commune],
    ["Type de bien", record.type],
    ["Calendrier", record.delai],
    ["Prénom", record.prenom],
    ["Téléphone", record.telephone],
    ["E-mail", record.email],
    ["Préférence de rappel", record.rappel],
    ["Précision", record.message],
    ["Page d’origine", record.origine],
  ].filter(([, value]) => value);
  return {
    from: { name: "Site Martin Snauwaert", address: settings.from },
    to: settings.to,
    /* Answering the e-mail writes to the visitor, never to the no-reply box. */
    ...(record.email ? { replyTo: record.email } : {}),
    subject: line(`Demande d’estimation — ${record.commune} — ${record.prenom}`),
    text:
      "Nouvelle demande reçue par le formulaire du site.\n\n" +
      rows.map(([label, value]) => `${label} : ${label === "Précision" ? String(value).trim() : line(value)}`).join("\n") +
      `\n\nReçue le ${new Date(record.receivedAt).toLocaleString("fr-BE", { timeZone: "Europe/Brussels" })} · référence ${record.id.slice(0, 8)}\n`,
  };
}

/* Store for lib/inquiry-handler.mjs: "storing" a request is sending it. The
   same key is sent once per running instance, so a double click or a retry
   does not produce two e-mails. */
export function mailStore({ transport, settings, keep = 500 }) {
  const sent = new Map();
  return {
    async put(key, record) {
      if (sent.has(key)) return { created: false, record: sent.get(key) };
      await transport.sendMail(inquiryMail(record, settings));
      sent.set(key, { id: record.id });
      if (sent.size > keep) sent.delete(sent.keys().next().value);
      return { created: true, record };
    },
  };
}
