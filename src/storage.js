import { normalizeComparisons } from "./ahp.js";

const STORAGE_KEY = "bu-hierarchy-state-v1";
const STATE_VERSION = 1;

export function createEmptyState() {
  const now = new Date().toISOString();
  return {
    version: STATE_VERSION,
    people: [],
    comparisons: {},
    activePairKey: null,
    createdAt: now,
    updatedAt: now
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== STATE_VERSION || !Array.isArray(parsed.people)) {
      return createEmptyState();
    }
    return {
      ...createEmptyState(),
      ...parsed,
      comparisons: normalizeComparisons(parsed.comparisons || {}, parsed.people)
    };
  } catch {
    return createEmptyState();
  }
}

export function saveState(state) {
  const nextState = {
    ...state,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  return nextState;
}

export function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}
