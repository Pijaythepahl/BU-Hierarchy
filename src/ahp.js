export const STRENGTHS = [
  { value: 1, label: "Gleich", tone: "neutral" },
  { value: 3, label: "Leicht", tone: "low" },
  { value: 5, label: "Deutlich", tone: "medium" },
  { value: 7, label: "Stark", tone: "high" }
];

export function createId(prefix = "id") {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function pairCount(personCount) {
  if (personCount < 2) return 0;
  return (personCount * (personCount - 1)) / 2;
}

export function pairKey(a, b) {
  return [a, b].sort().join("__");
}

export function generatePairs(people) {
  const pairs = [];
  for (let i = 0; i < people.length; i += 1) {
    for (let j = i + 1; j < people.length; j += 1) {
      pairs.push({ a: people[i], b: people[j], key: pairKey(people[i].id, people[j].id) });
    }
  }
  return pairs;
}

export function normalizeComparisons(comparisons, people) {
  const ids = new Set(people.map((person) => person.id));
  const normalized = {};

  Object.values(comparisons || {}).forEach((comparison) => {
    if (!comparison || !ids.has(comparison.personAId) || !ids.has(comparison.personBId)) return;
    const key = pairKey(comparison.personAId, comparison.personBId);
    normalized[key] = { ...comparison, key };
  });

  return normalized;
}

export function getProgress(people, comparisons) {
  const total = pairCount(people.length);
  const validComparisons = normalizeComparisons(comparisons, people);
  const completed = Object.keys(validComparisons).length;
  return {
    total,
    completed,
    open: Math.max(total - completed, 0),
    percent: total === 0 ? 0 : Math.round((completed / total) * 100)
  };
}

export function getNextPair(people, comparisons, afterKey = null) {
  const pairs = generatePairs(people);
  if (pairs.length === 0) return null;
  const completed = normalizeComparisons(comparisons, people);
  if (afterKey && !completed[afterKey]) {
    return pairs.find((pair) => pair.key === afterKey) || null;
  }
  const startIndex = Math.max(
    0,
    afterKey ? pairs.findIndex((pair) => pair.key === afterKey) + 1 : 0
  );
  const orderedPairs = [...pairs.slice(startIndex), ...pairs.slice(0, startIndex)];
  return orderedPairs.find((pair) => !completed[pair.key]) || orderedPairs[0] || null;
}

export function setComparison({ pair, winnerId, strength, existing = {} }) {
  const value = Number(strength) || 1;
  const comparison = {
    key: pair.key,
    personAId: pair.a.id,
    personBId: pair.b.id,
    winnerId: winnerId === "tie" ? "tie" : winnerId,
    strength: winnerId === "tie" ? 1 : Math.max(1, value),
    updatedAt: new Date().toISOString()
  };

  return {
    ...existing,
    [pair.key]: comparison
  };
}

export function computeRanking(people, comparisons) {
  const validComparisons = normalizeComparisons(comparisons, people);
  const logTotals = new Map(people.map((person) => [person.id, 0]));
  const counts = new Map(people.map((person) => [person.id, 0]));

  Object.values(validComparisons).forEach((comparison) => {
    const value =
      comparison.winnerId === "tie"
        ? 1
        : comparison.winnerId === comparison.personAId
          ? comparison.strength
          : 1 / comparison.strength;
    const logValue = Math.log(value);

    logTotals.set(comparison.personAId, logTotals.get(comparison.personAId) + logValue);
    logTotals.set(comparison.personBId, logTotals.get(comparison.personBId) - logValue);
    counts.set(comparison.personAId, counts.get(comparison.personAId) + 1);
    counts.set(comparison.personBId, counts.get(comparison.personBId) + 1);
  });

  const rawScores = people.map((person) => {
    const count = counts.get(person.id) || 0;
    const averageLog = count === 0 ? 0 : logTotals.get(person.id) / count;
    return {
      person,
      raw: Math.exp(averageLog),
      compared: count
    };
  });

  const rawTotal = rawScores.reduce((sum, entry) => sum + entry.raw, 0) || 1;
  const ranked = rawScores
    .map((entry) => ({
      ...entry,
      score: entry.raw / rawTotal
    }))
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name, "de"));

  return {
    ranked,
    progress: getProgress(people, validComparisons),
    isComplete: getProgress(people, validComparisons).open === 0 && people.length > 1
  };
}
