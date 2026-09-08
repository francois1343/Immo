class EstimationChatbot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    // Données de configuration (faciles à ajuster ou charger via API)
    this.config = {
      communes: {
        Beaumont: { baseMaison: 1450, baseAppart: 1650, baseTerrain: 35 },
        Chimay: { baseMaison: 1380, baseAppart: 1580, baseTerrain: 30 },
        Cerfontaine: { baseMaison: 1400, baseAppart: 1600, baseTerrain: 32 },
        Thuin: { baseMaison: 1550, baseAppart: 1750, baseTerrain: 40 },
        Froidchapelle: { baseMaison: 1350, baseAppart: 1500, baseTerrain: 28 }
      },
      coeffsEtat: {
        a_renover: 0.82,
        bon: 1.0,
        excellent: 1.15
      },
      coeffsPEB: {
        A: 1.08,
        B: 1.04,
        C: 1.0,
        D: 0.96,
        E_F_G: 0.9
      }
    };

    // État de la conversation
    this.state = {
      step: 1,
      type: "maison",
      commune: "Beaumont",
      surfaceHabitable: 120,
      surfaceTerrain: 500,
      etat: "bon",
      peb: "C",
      delaiVente: "des_que_possible",
      nom: "",
      tel: "",
      email: "",
      estimationMin: 0,
      estimationMax: 0
    };
  }

  connectedCallback() {
    this.render();
  }

  // Calcul de la fourchette d'estimation
  calculateEstimation() {
    const data =
      this.config.communes[this.state.commune] ||
      this.config.communes.Beaumont;
    let baseVal = 0;

    if (this.state.type === "maison") {
      const valHabitable =
        this.state.surfaceHabitable * data.baseMaison;
      const valTerrain =
        (this.state.surfaceTerrain || 0) * (data.baseTerrain * 0.5);
      baseVal =
        (valHabitable + valTerrain) *
        this.config.coeffsEtat[this.state.etat] *
        this.config.coeffsPEB[this.state.peb];
    } else if (this.state.type === "appartement") {
      baseVal =
        this.state.surfaceHabitable *
        data.baseAppart *
        this.config.coeffsEtat[this.state.etat] *
        this.config.coeffsPEB[this.state.peb];
    } else if (this.state.type === "terrain") {
      baseVal = this.state.surfaceTerrain * data.baseTerrain;
    }

    this.state.estimationMin = Math.round((baseVal * 0.95) / 1000) * 1000;
    this.state.estimationMax = Math.round((baseVal * 1.05) / 1000) * 1000;
  }

  nextStep() {
    this.state.step++;

    if (this.state.type === "terrain" && this.state.step === 4) {
      this.state.step = 5;
    }

    if (this.state.step === 6) {
      this.calculateEstimation();
    }
    this.render();
  }

  prevStep() {
    if (this.state.step > 1) {
      this.state.step =
        this.state.type === "terrain" && this.state.step === 5
          ? 3
          : this.state.step - 1;
      this.render();
    }
  }

  updateField(field, value) {
    this.state[field] = value;
  }

  render() {
    const progressStep = Math.min(this.state.step, 6);
    const progressLabels = {
      1: "Type de bien",
      2: "Localisation",
      3: "Surfaces",
      4: "Caractéristiques",
      5: "Recevoir le rapport",
      6: "Votre estimation"
    };
    const progressPercent = [0, 17, 33, 50, 67, 83, 100][progressStep];

    this.shadowRoot.innerHTML = `
      <link rel="stylesheet" href="estimation.css">

      <div class="chatbot-header">
        <div class="avatar">
          <img src="../assets/icon-192.png" alt="">
        </div>
        <div class="header-info">
          <h2>Assistant estimation</h2>
          <p>Martin Snauwaert · Connexion Immo</p>
        </div>
        <span class="availability">Disponible</span>
      </div>

      <div class="progress-area">
        <div class="progress-meta">
          <span>${progressLabels[progressStep]}</span>
          <span>${progressPercent}%</span>
        </div>
        <div
          class="progress-track"
          role="progressbar"
          aria-label="Progression de l'estimation"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${progressPercent}"
        >
          <span class="progress-value progress-step-${progressStep}"></span>
        </div>
      </div>

      <div class="chatbot-body">
        <div class="content">
          ${this.renderStepContent()}
        </div>

        ${
          this.state.step < 6
            ? `<div class="buttons">
                ${
                  this.state.step > 1
                    ? `<button class="btn btn-secondary" id="btn-prev" type="button">Retour</button>`
                    : "<div></div>"
                }
                ${
                  this.state.step < 5
                    ? `<button class="btn btn-primary" id="btn-next" type="button">Continuer</button>`
                    : ""
                }
              </div>`
            : ""
        }
      </div>
    `;

    this.bindEvents();
  }

  renderStepContent() {
    switch (this.state.step) {
      case 1:
        return `
          <div class="bot-bubble">Commençons par le type de bien à estimer.</div>
          <div class="form-group">
            <label class="sr-only" for="field-type">Type de bien</label>
            <select id="field-type">
              <option value="maison" ${this.state.type === "maison" ? "selected" : ""}>Maison</option>
              <option value="appartement" ${this.state.type === "appartement" ? "selected" : ""}>Appartement</option>
              <option value="terrain" ${this.state.type === "terrain" ? "selected" : ""}>Terrain</option>
            </select>
          </div>
        `;

      case 2:
        return `
          <div class="bot-bubble">Où se trouve votre ${this.state.type} ?</div>
          <div class="form-group">
            <label class="sr-only" for="field-commune">Commune</label>
            <select id="field-commune">
              ${Object.keys(this.config.communes)
                .map(
                  (commune) =>
                    `<option value="${commune}" ${this.state.commune === commune ? "selected" : ""}>${commune}</option>`
                )
                .join("")}
            </select>
          </div>
        `;

      case 3:
        return `
          <div class="bot-bubble">Quelles sont les surfaces du bien, même approximativement ?</div>
          ${
            this.state.type !== "terrain"
              ? `
                <div class="form-group">
                  <label for="field-surfaceHab">Surface habitable (m²)</label>
                  <input type="number" id="field-surfaceHab" value="${this.state.surfaceHabitable}" min="1" inputmode="numeric">
                </div>
              `
              : ""
          }
          ${
            this.state.type !== "appartement"
              ? `
                <div class="form-group">
                  <label for="field-surfaceTer">Surface du terrain (m²)</label>
                  <input type="number" id="field-surfaceTer" value="${this.state.surfaceTerrain}" min="1" inputmode="numeric">
                </div>
              `
              : ""
          }
        `;

      case 4:
        return `
          <div class="bot-bubble">Quel est son état général ? Une indication sur le PEB suffit.</div>
          <div class="form-group">
            <label for="field-etat">État du bien</label>
            <select id="field-etat">
              <option value="a_renover" ${this.state.etat === "a_renover" ? "selected" : ""}>À rénover / À rafraîchir</option>
              <option value="bon" ${this.state.etat === "bon" ? "selected" : ""}>Bon état général</option>
              <option value="excellent" ${this.state.etat === "excellent" ? "selected" : ""}>Excellent / Récent / Rénové</option>
            </select>
          </div>
          <div class="form-group">
            <label for="field-peb">Certificat PEB (approximatif)</label>
            <select id="field-peb">
              <option value="A" ${this.state.peb === "A" ? "selected" : ""}>PEB A ou B (Très économe)</option>
              <option value="C" ${this.state.peb === "C" ? "selected" : ""}>PEB C ou D (Moyen)</option>
              <option value="E_F_G" ${this.state.peb === "E_F_G" ? "selected" : ""}>PEB E, F ou G (Énergivore)</option>
            </select>
          </div>
        `;

      case 5:
        return `
          <div class="bot-bubble">Quand pensez-vous vendre ? Laissez vos coordonnées pour que Martin puisse vous répondre.</div>
          <form id="contact-form">
            <div class="form-group">
              <label for="lead-delai">Délai de vente envisagé</label>
              <select id="lead-delai" name="delaiVente" required>
                <option value="des_que_possible">Dès que possible</option>
                <option value="moins_3_mois">Dans moins de 3 mois</option>
                <option value="3_6_mois">Dans 3 à 6 mois</option>
                <option value="plus_6_mois">Dans plus de 6 mois</option>
                <option value="reflexion">Je suis encore en réflexion</option>
              </select>
            </div>
            <div class="form-group">
              <label for="lead-nom">Votre nom</label>
              <input type="text" id="lead-nom" name="nom" placeholder="Martin Dupont" autocomplete="name" required>
            </div>
            <div class="form-group">
              <label for="lead-tel">Numéro de téléphone</label>
              <input type="tel" id="lead-tel" name="telephone" placeholder="+32 4XX XX XX XX" autocomplete="tel" inputmode="tel" required>
            </div>
            <div class="form-group">
              <label for="lead-email">Adresse e-mail</label>
              <input type="email" id="lead-email" name="email" placeholder="vous@exemple.be" autocomplete="email" inputmode="email" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block">Valider et envoyer à Martin</button>
          </form>
        `;

      case 6:
        return `
          <div class="bot-bubble bot-bubble-success">
            <strong>Merci, vos informations sont enregistrées.</strong><br>
            Voici maintenant la première estimation de votre bien à ${this.state.commune}.
          </div>
          <div class="result-box">
            <small>Fourchette d'estimation indicative</small>
            <div class="price-tag">${this.state.estimationMin.toLocaleString()} € - ${this.state.estimationMax.toLocaleString()} €</div>
            <p class="result-note">Martin peut affiner ce montant en tenant compte des particularités du bien.</p>
          </div>
          <p class="result-disclaimer">Cette fourchette est indicative et ne remplace pas une visite du bien.</p>
        `;

      default:
        return "";
    }
  }

  bindEvents() {
    const shadow = this.shadowRoot;
    const btnNext = shadow.querySelector("#btn-next");
    const btnPrev = shadow.querySelector("#btn-prev");
    const contactForm = shadow.querySelector("#contact-form");

    if (btnNext) {
      btnNext.addEventListener("click", () => this.nextStep());
    }
    if (btnPrev) {
      btnPrev.addEventListener("click", () => this.prevStep());
    }
    const fieldType = shadow.querySelector("#field-type");
    if (fieldType) {
      fieldType.addEventListener("change", (event) =>
        this.updateField("type", event.target.value)
      );
    }

    const fieldCommune = shadow.querySelector("#field-commune");
    if (fieldCommune) {
      fieldCommune.addEventListener("change", (event) =>
        this.updateField("commune", event.target.value)
      );
    }

    const fieldSurfHab = shadow.querySelector("#field-surfaceHab");
    if (fieldSurfHab) {
      fieldSurfHab.addEventListener("change", (event) =>
        this.updateField(
          "surfaceHabitable",
          parseFloat(event.target.value) || 0
        )
      );
    }

    const fieldSurfTer = shadow.querySelector("#field-surfaceTer");
    if (fieldSurfTer) {
      fieldSurfTer.addEventListener("change", (event) =>
        this.updateField(
          "surfaceTerrain",
          parseFloat(event.target.value) || 0
        )
      );
    }

    const fieldEtat = shadow.querySelector("#field-etat");
    if (fieldEtat) {
      fieldEtat.addEventListener("change", (event) =>
        this.updateField("etat", event.target.value)
      );
    }

    const fieldPeb = shadow.querySelector("#field-peb");
    if (fieldPeb) {
      fieldPeb.addEventListener("change", (event) =>
        this.updateField("peb", event.target.value)
      );
    }

    if (contactForm) {
      contactForm.addEventListener("submit", (event) => {
        event.preventDefault();
        this.state.delaiVente = shadow.querySelector("#lead-delai").value;
        this.state.nom = shadow.querySelector("#lead-nom").value;
        this.state.tel = shadow.querySelector("#lead-tel").value;
        this.state.email = shadow.querySelector("#lead-email").value;
        this.state.step = 6;
        this.calculateEstimation();

        const payload = { ...this.state };

        console.log(
          "Données qualifiées prêtes à être envoyées à l'API/Backend :",
          payload
        );

        this.render();
      });
    }
  }
}

customElements.define("estimation-chatbot", EstimationChatbot);
