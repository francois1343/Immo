/* Reception settings for the estimate form.
   Both values stay empty until the data controller, retention period and
   hosting are confirmed: with an empty endpoint the page sends nothing and
   only prepares a message the visitor sends from their own mail app. */
window.IMMO_INQUIRY = Object.freeze({
  endpoint: "",
  turnstileSiteKey: "",
});
