/**
 * Free Sleep — Custom Lovelace Card
 *
 * A frosted-glass, Apple-esque card for controlling an Eight Sleep Pod
 * running Free Sleep. Shows both bed sides with temperature controls,
 * presence status, and biometrics summary.
 *
 * Note on innerHTML usage: All values rendered via innerHTML are from
 * trusted HA entity state (numbers, known strings). No user-supplied
 * HTML is ever rendered. This follows standard Lovelace card patterns.
 */

/* ---------- helpers ---------- */

function lerpColor(a, b, t) {
  const p = (hex) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (v) => Math.round(v).toString(16).padStart(2, "0");
  return `#${c(r1 + (r2 - r1) * t)}${c(g1 + (g2 - g1) * t)}${c(b1 + (b2 - b1) * t)}`;
}

function getTemperatureColor(tempF) {
  const t = Math.max(0, Math.min(1, (tempF - 55) / (110 - 55)));
  if (t <= 0.27) return "#0A84FF";
  if (t <= 0.49) return lerpColor("#0A84FF", "#5E5CE6", (t - 0.27) / 0.22);
  if (t <= 0.73) return lerpColor("#5E5CE6", "#FF9F0A", (t - 0.49) / 0.24);
  return lerpColor("#FF9F0A", "#FF453A", (t - 0.73) / 0.27);
}

/** Create an element with optional class and text content. */
function el(tag, className, textContent) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (textContent != null) e.textContent = String(textContent);
  return e;
}

/** Create an SVG element from a trusted static path string. */
function svgIcon(pathD, fill, size) {
  const sz = size || 14;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(sz));
  svg.setAttribute("height", String(sz));
  svg.style.fill = fill;
  svg.style.flexShrink = "0";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", pathD);
  svg.appendChild(path);
  return svg;
}

// Trusted static SVG paths
const HEART_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";
const BREATH_PATH = "M2 16h3.5c.7 0 1.3-.4 1.6-1l1.4-2.8c.3-.6.9-1 1.6-1h1.8c.7 0 1.3.4 1.6 1L15 15c.3.6.9 1 1.6 1H22M2 12h2.5c.7 0 1.3-.4 1.6-1l.8-1.6c.3-.6.9-1 1.6-1h2c.7 0 1.3.4 1.6 1l.8 1.6c.3.6.9 1 1.6 1H22";
const MOON_PATH_1 = "M12 2a9.4 9.4 0 0 0 0 20c5.2 0 9.4-4.5 9.4-10S17.2 2 12 2zm0 18a7.4 7.4 0 0 1-5-2A7.4 7.4 0 0 1 4.6 12c0-4.1 3.3-8 7.4-8a7.5 7.5 0 0 1 0 15z";
const MOON_PATH_2 = "M12 6a6 6 0 0 0-4.2 10.3A6 6 0 0 0 12 18a6 6 0 0 0 0-12z";

/* ---------- card ---------- */

class FreeSleepCard extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    if (this._root) this._render();
  }

  setConfig(config) {
    if (!config.left_climate || !config.right_climate) {
      throw new Error("Please define left_climate and right_climate entity IDs");
    }
    this._config = config;
  }

  getCardSize() {
    return 5;
  }

  connectedCallback() {
    if (!this._root) {
      this._root = this.attachShadow({ mode: "open" });
      this._loadFont();
      this._injectStyles();
      this._root.appendChild(this._buildDOM());
    }
    if (this._hass) this._render();
  }

  _loadFont() {
    if (!document.querySelector('link[href*="Outfit"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
      document.head.appendChild(link);
    }
  }

  /* ---- styles ---- */

  _injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      :host {
        --fs-bg: rgba(28, 28, 30, 0.72);
        --fs-border: rgba(255, 255, 255, 0.08);
        --fs-border-light: rgba(255, 255, 255, 0.12);
        --fs-text: #F5F5F7;
        --fs-text-sec: rgba(235, 235, 245, 0.6);
        --fs-text-ter: rgba(235, 235, 245, 0.3);
        --fs-inset: rgba(255, 255, 255, 0.04);
        --fs-grey-500: #636366;
        --fs-grey-600: #48484A;
        --fs-green: #30D158;
        --fs-orange: #FF9F0A;
        --fs-red: #FF453A;
        --fs-blue: #0A84FF;
        font-family: "Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.5; }
      }

      .card {
        background: var(--fs-bg);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid var(--fs-border);
        border-radius: 16px;
        padding: 20px;
        color: var(--fs-text);
        animation: fadeInUp 0.35s ease-out both;
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 0.95rem;
        letter-spacing: -0.01em;
      }
      .header-left svg { width: 18px; height: 18px; }
      .header-right {
        font-size: 0.7rem;
        color: var(--fs-text-ter);
        font-weight: 500;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }

      .bed {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 2px;
        margin-bottom: 12px;
      }
      .side {
        background: var(--fs-inset);
        border: 1px solid var(--fs-border);
        padding: 20px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        position: relative;
        overflow: hidden;
        transition: opacity 0.3s ease;
      }
      .side:first-child { border-radius: 16px 4px 4px 12px; }
      .side:last-child  { border-radius: 4px 16px 12px 4px; }
      .side.off { opacity: 0.4; }

      .side .glow {
        position: absolute;
        inset: 0;
        pointer-events: none;
        transition: background 0.5s ease;
      }

      .presence {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--fs-text-sec);
        z-index: 1;
      }
      .presence-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--fs-green);
        animation: pulse 2s ease-in-out infinite;
      }
      .presence.empty { color: var(--fs-text-ter); }

      .temp {
        font-size: 2rem;
        font-weight: 700;
        letter-spacing: -0.04em;
        line-height: 1;
        z-index: 1;
        transition: color 0.5s ease;
      }
      .temp-off {
        font-size: 1.4rem;
        font-weight: 600;
        color: var(--fs-grey-600);
        z-index: 1;
      }

      .stepper {
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 1;
      }
      .stepper-btn {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        border: 1px solid var(--fs-border);
        background: rgba(255, 255, 255, 0.06);
        color: var(--fs-text-sec);
        font-size: 1rem;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        padding: 0;
        line-height: 1;
      }
      .stepper-btn:hover {
        background: rgba(255, 255, 255, 0.12);
        border-color: var(--fs-border-light);
      }
      .stepper-btn:active { transform: scale(0.88); }
      .stepper-dot {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--fs-text-ter);
      }

      .current {
        font-size: 0.7rem;
        color: var(--fs-text-ter);
        font-weight: 400;
        z-index: 1;
      }

      .vitals-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }
      .vitals-panel {
        background: var(--fs-inset);
        border: 1px solid var(--fs-border);
        border-radius: 12px;
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .vital {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.78rem;
        font-weight: 500;
      }
      .vital-val { color: var(--fs-text); }
      .vital-unit { color: var(--fs-text-ter); font-weight: 400; font-size: 0.7rem; }
      .vital-na { color: var(--fs-text-ter); }

      .labels {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        text-align: center;
      }
      .label {
        font-size: 0.72rem;
        font-weight: 500;
        color: var(--fs-text-sec);
        letter-spacing: -0.005em;
      }
    `;
    this._root.appendChild(style);
  }

  /* ---- DOM construction ---- */

  _buildDOM() {
    const card = el("div", "card");

    // Header
    const header = el("div", "header");
    const headerLeft = el("div", "header-left");
    const moonIcon = svgIcon(MOON_PATH_1, "var(--fs-text-sec)", 18);
    // Add second path to moon icon
    const moonPath2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
    moonPath2.setAttribute("d", MOON_PATH_2);
    moonIcon.appendChild(moonPath2);
    headerLeft.appendChild(moonIcon);
    const cardName = el("span", null, "Free Sleep");
    cardName.id = "card-name";
    headerLeft.appendChild(cardName);
    header.appendChild(headerLeft);
    const headerRight = el("div", "header-right");
    headerRight.id = "card-model";
    header.appendChild(headerRight);
    card.appendChild(header);

    // Bed
    const bed = el("div", "bed");
    for (const side of ["left", "right"]) {
      const sideDiv = el("div", "side");
      sideDiv.id = `side-${side}`;

      const glow = el("div", "glow");
      glow.id = `glow-${side}`;
      sideDiv.appendChild(glow);

      const pres = el("div", "presence");
      pres.id = `presence-${side}`;
      sideDiv.appendChild(pres);

      const temp = el("div");
      temp.id = `temp-${side}`;
      sideDiv.appendChild(temp);

      const stepper = el("div", "stepper");
      stepper.id = `stepper-${side}`;
      sideDiv.appendChild(stepper);

      const cur = el("div", "current");
      cur.id = `current-${side}`;
      sideDiv.appendChild(cur);

      bed.appendChild(sideDiv);
    }
    card.appendChild(bed);

    // Vitals row
    const vitalsRow = el("div", "vitals-row");
    vitalsRow.id = "vitals-row";
    for (const side of ["left", "right"]) {
      const panel = el("div", "vitals-panel");
      panel.id = `vitals-${side}`;
      vitalsRow.appendChild(panel);
    }
    card.appendChild(vitalsRow);

    // Labels
    const labels = el("div", "labels");
    for (const side of ["left", "right"]) {
      const lbl = el("div", "label");
      lbl.id = `label-${side}`;
      labels.appendChild(lbl);
    }
    card.appendChild(labels);

    return card;
  }

  /* ---- render ---- */

  _render() {
    if (!this._hass || !this._config) return;
    const c = this._config;
    const h = this._hass;

    // Card name
    this._root.getElementById("card-name").textContent = c.name || "Free Sleep";

    // Model
    const leftClimate = h.states[c.left_climate];
    const modelEl = this._root.getElementById("card-model");
    modelEl.textContent = leftClimate?.attributes?.hub_version || "";

    // Vitals row visibility
    this._root.getElementById("vitals-row").style.display =
      c.show_vitals === false ? "none" : "";

    this._renderSide("left", c, h);
    this._renderSide("right", c, h);
  }

  _renderSide(side, config, hass) {
    const climateId = config[`${side}_climate`];
    const presenceId = config[`${side}_presence`];
    const hrId = config[`${side}_heart_rate`];
    const brId = config[`${side}_breathing_rate`];

    const climate = hass.states[climateId];
    const presence = presenceId ? hass.states[presenceId] : null;
    const hr = hrId ? hass.states[hrId] : null;
    const br = brId ? hass.states[brId] : null;

    const sideEl = this._root.getElementById(`side-${side}`);
    const glowEl = this._root.getElementById(`glow-${side}`);
    const presEl = this._root.getElementById(`presence-${side}`);
    const tempEl = this._root.getElementById(`temp-${side}`);
    const stepEl = this._root.getElementById(`stepper-${side}`);
    const curEl = this._root.getElementById(`current-${side}`);
    const vitEl = this._root.getElementById(`vitals-${side}`);
    const lblEl = this._root.getElementById(`label-${side}`);

    if (!climate) {
      sideEl.classList.add("off");
      tempEl.textContent = "";
      tempEl.appendChild(el("div", "temp-off", "Unavailable"));
      presEl.textContent = "";
      stepEl.textContent = "";
      curEl.textContent = "";
      glowEl.style.background = "none";
      while (vitEl.firstChild) vitEl.removeChild(vitEl.firstChild);
      lblEl.textContent = side.charAt(0).toUpperCase() + side.slice(1);
      return;
    }

    const isOn = climate.state !== "off";
    const target = climate.attributes.temperature;
    const current = climate.attributes.current_temperature;
    const friendlyName =
      climate.attributes.friendly_name ||
      side.charAt(0).toUpperCase() + side.slice(1) + " Side";
    const isPresent = presence?.state === "on";

    // Side opacity
    sideEl.classList.toggle("off", !isOn);

    // Glow
    if (isOn && target != null) {
      const color = getTemperatureColor(target);
      glowEl.style.background = `radial-gradient(ellipse at center, ${color}22 0%, transparent 75%)`;
    } else {
      glowEl.style.background = "none";
    }

    // Presence
    while (presEl.firstChild) presEl.removeChild(presEl.firstChild);
    if (isPresent) {
      presEl.className = "presence";
      presEl.appendChild(el("div", "presence-dot"));
      presEl.appendChild(document.createTextNode(" In bed"));
    } else {
      presEl.className = "presence empty";
      presEl.textContent = "Empty";
    }

    // Temperature
    while (tempEl.firstChild) tempEl.removeChild(tempEl.firstChild);
    if (isOn && target != null) {
      const color = getTemperatureColor(target);
      const t = el("div", "temp", `${Math.round(target)}°F`);
      t.style.color = color;
      tempEl.appendChild(t);
    } else {
      tempEl.appendChild(el("div", "temp-off", "Off"));
    }

    // Stepper
    while (stepEl.firstChild) stepEl.removeChild(stepEl.firstChild);
    if (isOn) {
      const minusBtn = el("button", "stepper-btn", "\u2212");
      minusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._adjustTemp(side, -1);
      });
      stepEl.appendChild(minusBtn);
      stepEl.appendChild(el("div", "stepper-dot"));
      const plusBtn = el("button", "stepper-btn", "+");
      plusBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._adjustTemp(side, 1);
      });
      stepEl.appendChild(plusBtn);
    }

    // Current temperature
    if (isOn && current != null) {
      curEl.textContent = `Currently ${Math.round(current)}°F`;
    } else {
      curEl.textContent = "";
    }

    // Vitals
    this._renderVitals(vitEl, hr, br);

    // Label
    lblEl.textContent = friendlyName;
  }

  _renderVitals(container, hr, br) {
    while (container.firstChild) container.removeChild(container.firstChild);

    const hrVal =
      hr?.state && !isNaN(hr.state) ? Math.round(Number(hr.state)) : null;
    const brVal =
      br?.state && !isNaN(br.state) ? Math.round(Number(br.state)) : null;

    // Heart rate row
    const hrRow = el("div", "vital");
    hrRow.appendChild(svgIcon(HEART_PATH, "#FF453A"));
    if (hrVal != null) {
      hrRow.appendChild(el("span", "vital-val", hrVal));
      hrRow.appendChild(el("span", "vital-unit", "bpm"));
    } else {
      hrRow.appendChild(el("span", "vital-na", "--"));
    }
    container.appendChild(hrRow);

    // Breathing rate row
    const brRow = el("div", "vital");
    brRow.appendChild(svgIcon(BREATH_PATH, "#0A84FF"));
    if (brVal != null) {
      brRow.appendChild(el("span", "vital-val", brVal));
      brRow.appendChild(el("span", "vital-unit", "/min"));
    } else {
      brRow.appendChild(el("span", "vital-na", "--"));
    }
    container.appendChild(brRow);
  }

  /* ---- actions ---- */

  _adjustTemp(side, delta) {
    const climateId = this._config[`${side}_climate`];
    const climate = this._hass.states[climateId];
    if (!climate) return;

    const current = climate.attributes.temperature;
    if (current == null) return;

    const newTemp = Math.max(55, Math.min(110, current + delta));
    this._hass.callService("climate", "set_temperature", {
      entity_id: climateId,
      temperature: newTemp,
    });
  }

  /* ---- editor ---- */

  static getConfigElement() {
    return document.createElement("free-sleep-card-editor");
  }

  static getStubConfig() {
    return {
      left_climate: "climate.free_sleep_left_side",
      right_climate: "climate.free_sleep_right_side",
      left_presence: "binary_sensor.free_sleep_left_bed_presence",
      right_presence: "binary_sensor.free_sleep_right_bed_presence",
      left_heart_rate: "sensor.free_sleep_left_heart_rate",
      right_heart_rate: "sensor.free_sleep_right_heart_rate",
      left_breathing_rate: "sensor.free_sleep_left_breathing_rate",
      right_breathing_rate: "sensor.free_sleep_right_breathing_rate",
      show_vitals: true,
    };
  }
}

customElements.define("free-sleep-card", FreeSleepCard);

/* ---------- editor ---------- */

class FreeSleepCardEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
  }

  setConfig(config) {
    this._config = { ...config };
    if (this._root) this._buildEditor();
  }

  connectedCallback() {
    if (!this._root) {
      this._root = this.attachShadow({ mode: "open" });
    }
    if (this._config) this._buildEditor();
  }

  _buildEditor() {
    // Clear
    while (this._root.firstChild) this._root.removeChild(this._root.firstChild);

    const style = document.createElement("style");
    style.textContent = `
      .editor { display: flex; flex-direction: column; gap: 12px; padding: 16px;
                font-family: "Outfit", sans-serif; }
      label { font-size: 0.85rem; font-weight: 500; color: var(--primary-text-color);
              display: flex; flex-direction: column; gap: 4px; }
      input { padding: 8px; border-radius: 8px; border: 1px solid var(--divider-color);
              background: var(--card-background-color); color: var(--primary-text-color);
              font-size: 0.85rem; }
      h3 { margin: 8px 0 0; font-size: 0.95rem; }
    `;
    this._root.appendChild(style);

    const editor = el("div", "editor");

    const fields = [
      { id: "name", label: "Card Name", placeholder: "Free Sleep" },
      { heading: "Left Side" },
      { id: "left_climate", label: "Climate Entity" },
      { id: "left_presence", label: "Presence Sensor" },
      { id: "left_heart_rate", label: "Heart Rate Sensor" },
      { id: "left_breathing_rate", label: "Breathing Rate Sensor" },
      { heading: "Right Side" },
      { id: "right_climate", label: "Climate Entity" },
      { id: "right_presence", label: "Presence Sensor" },
      { id: "right_heart_rate", label: "Heart Rate Sensor" },
      { id: "right_breathing_rate", label: "Breathing Rate Sensor" },
    ];

    for (const f of fields) {
      if (f.heading) {
        editor.appendChild(el("h3", null, f.heading));
        continue;
      }
      const lbl = el("label", null, f.label);
      const input = document.createElement("input");
      input.type = "text";
      input.id = f.id;
      input.value = this._config[f.id] || "";
      if (f.placeholder) input.placeholder = f.placeholder;
      input.addEventListener("change", (e) => {
        const val = e.target.value.trim();
        if (val) {
          this._config[f.id] = val;
        } else {
          delete this._config[f.id];
        }
        this.dispatchEvent(
          new CustomEvent("config-changed", {
            detail: { config: { ...this._config } },
            bubbles: true,
            composed: true,
          })
        );
      });
      lbl.appendChild(input);
      editor.appendChild(lbl);
    }

    this._root.appendChild(editor);
  }
}

customElements.define("free-sleep-card-editor", FreeSleepCardEditor);

/* ---------- register ---------- */

window.customCards = window.customCards || [];
window.customCards.push({
  type: "free-sleep-card",
  name: "Free Sleep",
  description:
    "Control your Eight Sleep Pod running Free Sleep — temperature, presence, and vitals.",
  preview: true,
});
