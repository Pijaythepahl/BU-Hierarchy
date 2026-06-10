import {
  STRENGTHS,
  computeRanking,
  createId,
  generatePairs,
  getNextPair,
  pairCount,
  pairKey,
  setComparison
} from "./ahp.js";
import { clearState, loadState, saveState } from "./storage.js";

const app = document.querySelector("#app");

let state = loadState();
let view = state.people.length < 2 ? "people" : "compare";
let selectedStrength = 3;
let activePair = null;
let dragState = null;
let menuOpen = false;

function persist(patch = {}) {
  state = saveState({ ...state, ...patch });
}

function setView(nextView) {
  view = nextView;
  menuOpen = false;
  render();
}

function ensureActivePair() {
  activePair = getNextPair(state.people, state.comparisons, state.activePairKey);
  if (activePair && activePair.key !== state.activePairKey) {
    persist({ activePairKey: activePair.key });
  }
  return activePair;
}

function addPerson(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const input = form.elements.namedItem("personName");
  const name = input.value.trim();
  if (!name) return;

  const exists = state.people.some((person) => person.name.toLowerCase() === name.toLowerCase());
  if (exists) {
    input.setCustomValidity("Dieser Name ist bereits erfasst.");
    input.reportValidity();
    return;
  }

  input.setCustomValidity("");
  const person = {
    id: createId("person"),
    name,
    createdAt: new Date().toISOString()
  };
  persist({ people: [...state.people, person] });
  input.value = "";
  render();
  requestAnimationFrame(() => {
    document.querySelector("#personName")?.focus();
  });
}

function renamePerson(id, name) {
  const trimmed = name.trim();
  if (!trimmed) return;
  persist({
    people: state.people.map((person) =>
      person.id === id ? { ...person, name: trimmed } : person
    )
  });
  render();
}

function removePerson(id) {
  const people = state.people.filter((person) => person.id !== id);
  const comparisons = Object.fromEntries(
    Object.entries(state.comparisons).filter(
      ([, comparison]) => comparison.personAId !== id && comparison.personBId !== id
    )
  );
  persist({
    people,
    comparisons,
    activePairKey: null
  });
  render();
}

function choose(winnerId) {
  const pair = ensureActivePair();
  if (!pair) return;
  const comparisons = setComparison({
    pair,
    winnerId,
    strength: selectedStrength,
    existing: state.comparisons
  });
  const nextPair = getNextPair(state.people, comparisons, pair.key);
  persist({
    comparisons,
    activePairKey: nextPair?.key || pair.key
  });
  if (computeRanking(state.people, comparisons).progress.open === 0) {
    view = "ranking";
  }
  selectedStrength = 3;
  render();
}

function resetAll() {
  const confirmed = window.confirm("Alle Namen und Vergleiche wirklich löschen?");
  if (!confirmed) return;
  clearState();
  state = loadState();
  view = "people";
  activePair = null;
  selectedStrength = 3;
  render();
}

function resetComparisons() {
  const confirmed = window.confirm("Nur die Vergleiche zurücksetzen? Die Namen bleiben erhalten.");
  if (!confirmed) return;
  selectedStrength = 3;
  menuOpen = false;
  persist({
    comparisons: {},
    activePairKey: null
  });
  view = state.people.length >= 2 ? "compare" : "people";
  render();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderShell(content) {
  const { progress } = computeRanking(state.people, state.comparisons);
  app.innerHTML = `
    <main class="app-shell">
      <header class="topbar">
        <div class="brand">
          <img src="./assets/icon.svg" alt="" class="brand-icon" />
          <div>
            <p class="eyeline">BU AHP</p>
            <h1>BU Hierarchy</h1>
          </div>
        </div>
        <div class="menu-wrap">
          <button class="icon-button" type="button" data-action="toggle-menu" title="Optionen" aria-label="Optionen" aria-expanded="${menuOpen ? "true" : "false"}">
            <span aria-hidden="true">↺</span>
          </button>
          ${
            menuOpen
              ? `<div class="reset-menu" role="menu">
                  <button type="button" role="menuitem" data-action="reset-comparisons">Nur Vergleiche zurücksetzen</button>
                  <button type="button" role="menuitem" data-action="reset-all">Alles zurücksetzen</button>
                </div>`
              : ""
          }
        </div>
      </header>

      <section class="status-strip" aria-label="Fortschritt">
        <div>
          <span class="metric-value">${progress.completed}</span>
          <span class="metric-label">erledigt</span>
        </div>
        <div>
          <span class="metric-value">${progress.open}</span>
          <span class="metric-label">offen</span>
        </div>
        <div>
          <span class="metric-value">${progress.percent}%</span>
          <span class="metric-label">Fortschritt</span>
        </div>
      </section>

      ${content}

      <nav class="bottom-nav" aria-label="Hauptbereiche">
        ${navButton("people", "Personen", "☷")}
        ${navButton("compare", "Vergleichen", "⇄")}
        ${navButton("ranking", "Ranking", "≡")}
      </nav>
    </main>
  `;

  bindGlobalEvents();
}

function navButton(target, label, icon) {
  const disabled = target === "compare" && state.people.length < 2 ? "disabled" : "";
  return `
    <button class="nav-item ${view === target ? "is-active" : ""}" type="button" data-view="${target}" ${disabled}>
      <span aria-hidden="true">${icon}</span>
      <span>${label}</span>
    </button>
  `;
}

function renderPeople() {
  const count = state.people.length;
  const totalPairs = pairCount(count);
  const warning =
    count >= 12
      ? `<div class="notice warning"><strong>Viele Vergleiche:</strong> ${count} Namen bedeuten ${totalPairs} Paarvergleiche. Empfohlen sind 3 bis 12 Personen.</div>`
      : `<div class="notice">Empfohlener Bereich: 3 bis 12 Personen. Aktuell entstehen ${totalPairs} Paarvergleiche.</div>`;

  renderShell(`
    <section class="view people-view">
      <div class="section-heading">
        <h2>Personen</h2>
        <p>Namen erfassen, dann die Paarvergleiche starten.</p>
      </div>
      <form class="add-form" data-form="add-person">
        <label for="personName">Name</label>
        <div class="input-row">
          <input id="personName" name="personName" autocomplete="off" placeholder="z. B. Müller" />
          <button type="submit">Hinzufügen</button>
        </div>
      </form>
      ${warning}
      <div class="person-list">
        ${
          state.people.length
            ? state.people
                .map(
                  (person, index) => `
                    <article class="person-row">
                      <span class="row-index">${index + 1}</span>
                      <input value="${escapeHtml(person.name)}" data-person-name="${person.id}" aria-label="Name bearbeiten" />
                      <button class="ghost-button" type="button" data-remove-person="${person.id}" aria-label="${escapeHtml(person.name)} entfernen">Entfernen</button>
                    </article>
                  `
                )
                .join("")
            : `<div class="empty-state">Noch keine Namen erfasst.</div>`
        }
      </div>
      ${
        state.people.length >= 2
          ? `<button class="primary-wide" type="button" data-view="compare">Vergleiche starten</button>`
          : `<p class="hint">Mindestens zwei Namen sind nötig.</p>`
      }
    </section>
  `);
}

function renderCompare() {
  const pair = ensureActivePair();
  const ranking = computeRanking(state.people, state.comparisons);

  if (state.people.length < 2) {
    renderPeople();
    return;
  }

  if (!pair) {
    view = "ranking";
    renderRanking();
    return;
  }

  const pairLabel = `${pair.a.name} / ${pair.b.name}`;
  renderShell(`
    <section class="view compare-layout">
      <div class="compare-panel">
        <div class="section-heading compact">
          <h2>Wer ist besser?</h2>
          <p>${escapeHtml(pairLabel)}</p>
        </div>
        <div class="card-stage" data-swipe-stage>
          ${choiceCard(pair.a, "left")}
          ${choiceCard(pair.b, "right")}
        </div>
        <div class="strength-panel" aria-label="Stärke">
          <span>Stärke</span>
          <div class="segmented">
            ${STRENGTHS.map(
              (strength) => `
                <button class="${selectedStrength === strength.value ? "is-selected" : ""}" type="button" data-strength="${strength.value}">
                  ${strength.label}
                </button>
              `
            ).join("")}
          </div>
        </div>
      </div>
      <aside class="ranking-preview">
        <div class="preview-head">
          <h3>Ranking</h3>
          <span>${ranking.progress.percent}%</span>
        </div>
        ${rankingList(ranking.ranked.slice(0, 5), true)}
      </aside>
    </section>
  `);
  fitChoiceNames();
  bindSwipe(pair);
}

function choiceCard(person, side) {
  const nameLength = [...person.name].length;
  const nameSize =
    nameLength <= 6 ? 50 : nameLength <= 8 ? 42 : nameLength <= 11 ? 34 : nameLength <= 15 ? 28 : 23;
  return `
    <button class="choice-card ${side}" type="button" data-card-choice="${person.id}">
      <strong data-base-size="${nameSize}" style="--name-size: ${nameSize}px">${escapeHtml(person.name)}</strong>
    </button>
  `;
}

function renderRanking() {
  const ranking = computeRanking(state.people, state.comparisons);
  const completeLabel = ranking.isComplete ? "Vollständig" : "Vorläufig";
  renderShell(`
    <section class="view ranking-view">
      <div class="section-heading">
        <h2>Ranking</h2>
        <p>${completeLabel}: ${ranking.progress.completed} von ${ranking.progress.total} Paarvergleichen erledigt.</p>
      </div>
      <div class="progress-block">
        <div class="progress-meta">
          <span>${ranking.progress.percent}% Fortschritt</span>
          <span>${ranking.progress.open} offen</span>
        </div>
        <div class="progress-track"><span style="width: ${ranking.progress.percent}%"></span></div>
      </div>
      ${rankingList(ranking.ranked, false)}
    </section>
  `);
}

function rankingList(items, compact) {
  if (!items.length) {
    return `<div class="empty-state">Noch kein Ranking vorhanden.</div>`;
  }
  return `
    <ol class="ranking-list ${compact ? "compact" : ""}">
      ${items
        .map(
          (entry, index) => `
            <li>
              <span class="rank">${index + 1}</span>
              <div class="rank-main">
                <strong>${escapeHtml(entry.person.name)}</strong>
                <span>${entry.compared} Vergleiche</span>
              </div>
              <span class="score">${Math.round(entry.score * 1000) / 10}%</span>
            </li>
          `
        )
        .join("")}
    </ol>
  `;
}

function bindGlobalEvents() {
  app.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  app.querySelector("[data-action='toggle-menu']")?.addEventListener("click", () => {
    menuOpen = !menuOpen;
    render();
  });
  app.querySelector("[data-action='reset-comparisons']")?.addEventListener("click", resetComparisons);
  app.querySelector("[data-action='reset-all']")?.addEventListener("click", resetAll);
  app.querySelector("[data-form='add-person']")?.addEventListener("submit", addPerson);
  app.querySelectorAll("[data-remove-person]").forEach((button) => {
    button.addEventListener("click", () => removePerson(button.dataset.removePerson));
  });
  app.querySelectorAll("[data-person-name]").forEach((input) => {
    input.addEventListener("change", () => renamePerson(input.dataset.personName, input.value));
  });
  app.querySelectorAll("[data-strength]").forEach((button) => {
    button.addEventListener("click", () => {
      selectedStrength = Number(button.dataset.strength);
      if (selectedStrength === 1) {
        choose("tie");
        return;
      }
      app.querySelectorAll("[data-strength]").forEach((strengthButton) => {
        strengthButton.classList.toggle(
          "is-selected",
          Number(strengthButton.dataset.strength) === selectedStrength
        );
      });
    });
  });
  app.querySelectorAll("[data-choose]").forEach((button) => {
    button.addEventListener("click", () => choose(button.dataset.choose));
  });
  app.querySelectorAll("[data-card-choice]").forEach((button) => {
    button.addEventListener("click", () => choose(button.dataset.cardChoice));
  });
}

function fitChoiceNames() {
  const nameElements = [...app.querySelectorAll(".choice-card strong")];
  const fittedSizes = nameElements.map((nameElement) => {
    const card = nameElement.closest(".choice-card");
    if (!card) return 18;
    let size = Number(nameElement.dataset.baseSize || 50);
    nameElement.style.fontSize = `${size}px`;
    while (nameElement.scrollWidth > card.clientWidth - 24 && size > 18) {
      size -= 1;
      nameElement.style.fontSize = `${size}px`;
    }
    return size;
  });
  const sharedSize = Math.min(...fittedSizes, 50);
  nameElements.forEach((nameElement) => {
    nameElement.style.fontSize = `${sharedSize}px`;
  });
}

function bindSwipe(pair) {
  const stage = app.querySelector("[data-swipe-stage]");
  if (!stage) return;

  stage.addEventListener("pointerdown", (event) => {
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      didSwipe: false
    };
  });

  stage.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    dragState.currentX = event.clientX;
    const offset = event.clientX - dragState.startX;
    dragState.didSwipe = Math.abs(offset) > 12;
    stage.style.setProperty("--swipe-x", `${Math.max(-80, Math.min(80, offset))}px`);
  });

  stage.addEventListener("pointerup", (event) => {
    if (!dragState) return;
    const offset = event.clientX - dragState.startX;
    const didSwipe = dragState.didSwipe;
    stage.style.removeProperty("--swipe-x");
    dragState = null;
    if (!didSwipe) return;
    if (offset > 64) choose(pair.b.id);
    if (offset < -64) choose(pair.a.id);
  });

  stage.addEventListener("pointercancel", () => {
    dragState = null;
    stage.style.removeProperty("--swipe-x");
  });
}

function render() {
  if (view === "people") renderPeople();
  if (view === "compare") renderCompare();
  if (view === "ranking") renderRanking();
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

render();
