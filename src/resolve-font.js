function norm(value) {
  return String(value).trim().toLowerCase().replace(/[\s_-]+/g, '-');
}

function ansiEntries(indexes) {
  return Object.entries(indexes.ansi ?? {}).map(([key, font]) => ({
    source: 'ansi', key, name: font.name, font,
  }));
}

function flfEntries(indexes) {
  return (indexes.flf ?? []).map((e) => ({
    source: 'flf', key: e.key, name: e.name, path: e.path,
  }));
}

function tdfEntries(indexes) {
  return (indexes.tdf ?? []).map((e) => ({
    source: 'tdf', key: e.key, name: e.name, path: e.path,
  }));
}

// figlet group (ansi + flf) before thedraw, mirroring the app's ordering.
function orderedEntries(indexes) {
  return [...ansiEntries(indexes), ...flfEntries(indexes), ...tdfEntries(indexes)];
}

export function resolveFont(query, indexes) {
  const raw = String(query ?? '').trim();
  if (!raw) return null;
  const entries = orderedEntries(indexes);

  // 1. kind-prefixed exact key: flf:Roman, tdf:1911, ansi:regular
  const prefixMatch = /^(ansi|flf|tdf):(.*)$/i.exec(raw);
  if (prefixMatch) {
    const source = prefixMatch[1].toLowerCase();
    const key = prefixMatch[2];
    return entries.find((e) => e.source === source && e.key === key) ?? null;
  }

  // 2. exact key, then exact name (case-sensitive)
  const exactKey = entries.find((e) => e.key === raw);
  if (exactKey) return exactKey;
  const exactName = entries.find((e) => e.name === raw);
  if (exactName) return exactName;

  // 3. normalized match against key then name; first in precedence order wins
  const target = norm(raw);
  const byKey = entries.find((e) => norm(e.key) === target);
  if (byKey) return byKey;
  return entries.find((e) => norm(e.name) === target) ?? null;
}

export function listFontNames(indexes) {
  return orderedEntries(indexes).map((e) => e.name);
}
