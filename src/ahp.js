export const STRENGTHS = [
  { value: 1, label: "Gleich", tone: "neutral" },
  { value: 3, label: "Leicht", tone: "low" },
  { value: 5, label: "Deutlich", tone: "medium" },
  { value: 7, label: "Stark", tone: "high" }
];

const RANDOM_INDEX = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
  11: 1.51,
  12: 1.48,
  13: 1.56,
  14: 1.57,
  15: 1.59
};

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

export function comparisonValue(comparison, personAId, personBId) {
  if (comparison.winnerId === "tie") return 1;
  if (comparison.personAId === personAId && comparison.personBId === personBId) {
    return comparison.winnerId === personAId ? comparison.strength : 1 / comparison.strength;
  }
  return comparison.winnerId === personAId ? comparison.strength : 1 / comparison.strength;
}

export function computeConsistency(people, comparisons) {
  const progress = getProgress(people, comparisons);
  const n = people.length;
  const ri = RANDOM_INDEX[n];

  if (n < 3) {
    return {
      available: false,
      status: "unavailable",
      label: "nicht verfügbar",
      message: "Konsistenz ist erst ab 3 Personen sinnvoll."
    };
  }

  if (progress.open > 0) {
    return {
      available: false,
      status: "pending",
      label: "nach Abschluss verfügbar",
      message: "Konsistenz nach Abschluss verfügbar."
    };
  }

  if (!ri) {
    return {
      available: false,
      status: "unavailable",
      label: "nicht verfügbar",
      message: "Für diese Anzahl Personen ist keine Konsistenz-Ampel hinterlegt."
    };
  }

  const validComparisons = normalizeComparisons(comparisons, people);
  const matrix = people.map((rowPerson) =>
    people.map((columnPerson) => {
      if (rowPerson.id === columnPerson.id) return 1;
      const comparison = validComparisons[pairKey(rowPerson.id, columnPerson.id)];
      return comparison ? comparisonValue(comparison, rowPerson.id, columnPerson.id) : 1;
    })
  );

  let vector = Array(n).fill(1 / n);
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const next = matrix.map((row) =>
      row.reduce((sum, value, index) => sum + value * vector[index], 0)
    );
    const total = next.reduce((sum, value) => sum + value, 0) || 1;
    vector = next.map((value) => value / total);
  }

  const weighted = matrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * vector[index], 0)
  );
  const lambdaMax =
    weighted.reduce((sum, value, index) => sum + value / (vector[index] || 1), 0) / n;
  const consistencyIndex = (lambdaMax - n) / (n - 1);
  const consistencyRatio = Math.max(0, consistencyIndex / ri);

  const status =
    consistencyRatio <= 0.1 ? "good" : consistencyRatio <= 0.2 ? "warning" : "review";
  const label = status === "good" ? "gut" : status === "warning" ? "auffällig" : "prüfen";
  const message =
    status === "good"
      ? "Die Paarvergleiche wirken in sich stimmig."
      : status === "warning"
        ? "Einige Paarvergleiche könnten leicht widersprüchlich sein."
        : "Hinweis auf widersprüchliche Paarvergleiche.";

  return {
    available: true,
    status,
    label,
    message,
    lambdaMax,
    consistencyIndex,
    consistencyRatio
  };
}
