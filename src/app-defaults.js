export const DEFAULT_BANNER_TEXT = 'TERM\nBANNER\n{{termbanner.com}}';
export const FALLBACK_FONT_KEY = 'flf:ANSI_Shadow';

export function randomFontKey({ plainFonts, flfIndex, tdfIndex, fontTypeFilter = 'all' }, random = Math.random) {
  const keys = orderedFontEntries({ plainFonts, flfIndex, tdfIndex, fontTypeFilter }).map((e) => e.key);

  if (keys.length === 0) {
    return FALLBACK_FONT_KEY;
  }

  const index = Math.min(keys.length - 1, Math.floor(random() * keys.length));
  return keys[index];
}

export function buildFontOptionsHtml({ plainFonts, flfIndex, tdfIndex, fontTypeFilter = 'all' }) {
  const entries = orderedFontEntries({ plainFonts, flfIndex, tdfIndex, fontTypeFilter });
  const figletOptions = entries
    .filter((entry) => entry.kind !== 'tdf')
    .map((entry) => fontOptionHtml(entry.key, entry.name));
  const tdfOptions = entries
    .filter((entry) => entry.kind === 'tdf')
    .map((entry) => fontOptionHtml(entry.key, entry.name));

  const parts = [];
  if (figletOptions.length > 0) {
    parts.push(`<optgroup label="Figlet">${figletOptions.join('')}</optgroup>`);
  }
  if (tdfOptions.length > 0) {
    parts.push(`<optgroup label="TheDraw">${tdfOptions.join('')}</optgroup>`);
  }
  return parts.join('');
}

export function totalFontCount({ plainFonts, flfIndex, tdfIndex }) {
  return Object.keys(plainFonts ?? {}).length
    + (flfIndex ?? []).length
    + (tdfIndex ?? []).length;
}

export function browseFontsLabel(fontState) {
  const count = orderedFontEntries(fontState).length;
  return count > 0
    ? `Browse All Fonts... (${count.toLocaleString('en-US')})`
    : 'Browse All Fonts...';
}

export function orderedFontEntries({ plainFonts, flfIndex, tdfIndex, fontTypeFilter = 'all' }) {
  const plainEntries = Object.entries(plainFonts ?? {})
    .map(([key, font]) => ({ kind: 'plain', key: plainFontKey(key), name: font.name }));
  const flfEntries = (flfIndex ?? [])
    .map((entry) => ({ kind: 'flf', key: flfFontKey(entry.key), name: entry.name }));
  const tdfEntries = (tdfIndex ?? [])
    .map((entry) => ({ kind: 'tdf', key: tdfFontKey(entry.key), name: tdfLabel(entry) }));

  const figletEntries = insertAfterAnsiShadow(flfEntries, plainEntries);

  if (fontTypeFilter === 'figlet') return figletEntries;
  if (fontTypeFilter === 'thedraw') return tdfEntries;
  return [...figletEntries, ...tdfEntries];
}

function insertAfterAnsiShadow(flfEntries, plainEntries) {
  if (plainEntries.length === 0) {
    return flfEntries;
  }

  const index = flfEntries.findIndex((entry) => entry.key === 'flf:ANSI_Shadow');
  if (index === -1) {
    return [...plainEntries, ...flfEntries];
  }

  return [
    ...flfEntries.slice(0, index + 1),
    ...plainEntries,
    ...flfEntries.slice(index + 1),
  ];
}

function fontOptionHtml(value, label) {
  return `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
}

function tdfLabel(entry) {
  const count = Number.isInteger(entry.colorSlotCount) ? entry.colorSlotCount : 0;
  return `${entry.name ?? entry.key} (${count})`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function plainFontKey(key) {
  return `plain:${key}`;
}

export function flfFontKey(key) {
  return `flf:${key}`;
}

export function tdfFontKey(key) {
  return `tdf:${key}`;
}
