import { gradient, parseHex, toHex } from './color.js';
import { padRows, renderRows } from './font.js';
import { renderFlfRows } from './flf.js';
import { ansiLines, plainText } from './render.js';
import { combineLineBlocks, overlayTextRow } from './line-gap.js';
import {
  renderCellRows,
  overlayCellRow,
  padCellRows,
  defaultPaletteForSlots,
  ansiCellLines,
} from './cell-render.js';

const PLAIN_BLOCK_SRC = '\\{\\{([\\s\\S]*?)\\}\\}';
const PLAIN_BLOCK_RE = new RegExp(PLAIN_BLOCK_SRC, 'g');
const HAS_PLAIN_RE = new RegExp(PLAIN_BLOCK_SRC);

// Split banner text into an ordered list of items:
//   { type: 'font', line }  - a non-empty line outside any {{ }} block (trimmed)
//   { type: 'plain', row }  - one row inside a {{ }} block (verbatim, blanks kept)
// A block may span multiple lines; one newline next to each marker is trimmed.
export function segmentText(text) {
  const items = [];
  const source = String(text ?? '');
  let last = 0;
  let match;

  const pushFont = (segment) => {
    for (const line of segment.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length > 0) items.push({ type: 'font', line: trimmed });
    }
  };

  PLAIN_BLOCK_RE.lastIndex = 0;
  while ((match = PLAIN_BLOCK_RE.exec(source)) !== null) {
    pushFont(source.slice(last, match.index));
    const content = match[1].replace(/^\n/, '').replace(/\n$/, '');
    for (const row of content.split('\n')) items.push({ type: 'plain', row });
    last = PLAIN_BLOCK_RE.lastIndex;
  }
  pushFont(source.slice(last));
  return items;
}

export function hasPlainText(text) {
  return HAS_PLAIN_RE.test(String(text ?? ''));
}

export const BANNER_DEFAULTS = {
  colorMode: 'gradient',
  solidColor: '#33ff00',
  gradientColors: ['#33ff00', '#0066ff'],
  letterSpacing: 0,
  lineSpacing: 1,
  paddingLeft: 1,
  paddingTop: 1,
  paddingBottom: 1,
  transparentBg: true,
};


export function bannerColors(colorMode, solidColor, gradientColors, rowCount) {
  if (colorMode === 'solid') {
    return gradient([parseHex(solidColor)], rowCount);
  }
  return gradient(gradientColors.map(parseHex), rowCount);
}

// Merge per-slot fg/bg overrides onto a built palette. `overrides` maps a slot
// key (e.g. '0x01') to `{ fg?, bg? }` rgb values; unspecified channels and
// slots keep their built-in colors.
export function applyPaletteOverrides(palette, overrides) {
  if (!overrides) return palette;
  for (const [slot, channels] of Object.entries(overrides)) {
    if (!palette[slot]) continue;
    palette[slot] = {
      fg: channels.fg ?? palette[slot].fg,
      bg: channels.bg ?? palette[slot].bg,
    };
  }
  return palette;
}

const PLAIN_SLOT = '__plain';

function plainCellRow(text) {
  return Array.from(String(text)).map((ch) => ({ ch, color: PLAIN_SLOT }));
}

// Pad only the row count (top/bottom) to mirror padRows, without touching
// content; used to keep a parallel per-row "kind" array aligned with the rows.
function padKinds(kinds, options = {}) {
  const top = Number.parseInt(options.top ?? 0, 10) || 0;
  const bottom = Number.parseInt(options.bottom ?? 0, 10) || 0;
  const topPad = Math.max(0, top);
  const bottomPad = Math.max(0, bottom);
  const topTrim = Math.max(0, -top);
  const bottomTrim = Math.max(0, -bottom);
  const trimmed = kinds.slice(topTrim, Math.max(topTrim, kinds.length - bottomTrim));
  return [
    ...Array.from({ length: topPad }, () => ''),
    ...trimmed,
    ...Array.from({ length: bottomPad }, () => ''),
  ];
}

export function renderBanner(options) {
  const defined = Object.fromEntries(
    Object.entries(options ?? {}).filter(([, v]) => v !== undefined),
  );
  const opts = { ...BANNER_DEFAULTS, ...defined };
  const { font } = opts;
  if (!font) {
    throw new Error('font is required');
  }
  if (!String(opts.text ?? '').trim()) {
    throw new Error('Enter text to render');
  }
  const items = segmentText(opts.text);
  if (items.length === 0) {
    throw new Error('Enter text to render');
  }

  if (font.kind === 'tdf-color') {
    const blocks = items.map((item) => (item.type === 'font'
      ? renderCellRows(font, item.line, { letterSpacing: opts.letterSpacing })
      : [plainCellRow(item.row)]));
    const combined = combineLineBlocks(blocks, opts.lineSpacing, () => [], overlayCellRow);
    const rows = padCellRows(combined, {
      left: opts.paddingLeft, top: opts.paddingTop, bottom: opts.paddingBottom,
    });
    const basePalette = opts.palette
      ? { ...opts.palette }
      : applyPaletteOverrides(defaultPaletteForSlots(font.colorSlots ?? []), opts.paletteOverrides);
    const fontRows = [];
    items.forEach((item, i) => { if (item.type === 'font') fontRows.push(...blocks[i]); });
    const plainRgb = opts.plainTextColor
      ? parseHex(opts.plainTextColor)
      : dominantCellColor(fontRows, basePalette);
    basePalette[PLAIN_SLOT] = { fg: plainRgb, bg: { r: 0, g: 0, b: 0 } };
    return { kind: 'tdf-color', font, rows, palette: basePalette, plainColor: toHex(plainRgb) };
  }

  const renderLine = font.kind === 'flf-plain'
    ? (line) => renderFlfRows(font, line, { letterSpacing: opts.letterSpacing })
    : (line) => renderRows(font, line, { letterSpacing: opts.letterSpacing });

  const blocks = [];
  const kindBlocks = [];
  for (const item of items) {
    if (item.type === 'font') {
      const r = renderLine(item.line);
      blocks.push(r);
      kindBlocks.push(r.map(() => ''));
    } else {
      blocks.push([item.row]);
      kindBlocks.push(['plain']);
    }
  }

  const combined = combineLineBlocks(blocks, opts.lineSpacing, () => '', overlayTextRow);
  const combinedKinds = combineLineBlocks(
    kindBlocks, opts.lineSpacing, () => '',
    (a, b) => (a === 'plain' || b === 'plain' ? 'plain' : ''),
  );
  const rows = padRows(combined, {
    left: opts.paddingLeft, top: opts.paddingTop, bottom: opts.paddingBottom,
  });
  const kinds = padKinds(combinedKinds, { top: opts.paddingTop, bottom: opts.paddingBottom });

  // Auto plain color for ANSI/FLF is the solid color (mirrors TheDraw using its dominant art color).
  const plainRgb = opts.plainTextColor ? parseHex(opts.plainTextColor) : parseHex(opts.solidColor);
  const nonPlainCount = kinds.filter((k) => k !== 'plain').length;
  const artColors = bannerColors(opts.colorMode, opts.solidColor, opts.gradientColors, nonPlainCount);
  let artIndex = 0;
  const colors = kinds.map((k) => (k === 'plain' ? { ...plainRgb } : artColors[artIndex++]));

  return { kind: 'plain', rows, colors, plainColor: toHex(plainRgb) };
}

// Most frequent visible (non-space) foreground colour across cell rows. Used as
// the auto default plain-text colour for TheDraw fonts. White if none.
export function dominantCellColor(cellRows, palette) {
  const counts = new Map();
  const byKey = new Map();
  for (const row of cellRows) {
    for (const cell of row) {
      if (!cell || cell.ch === ' ') continue;
      const colors = palette[cell.color] ?? defaultPaletteForSlots([cell.color])[cell.color];
      const fg = colors?.fg;
      if (!fg) continue;
      const key = `${fg.r},${fg.g},${fg.b}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!byKey.has(key)) byKey.set(key, fg);
    }
  }
  let best = null;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) { bestCount = count; best = key; }
  }
  return best ? { ...byKey.get(best) } : { r: 255, g: 255, b: 255 };
}

export function bannerToAnsi(result, terminalMode, options = {}) {
  if (result.kind === 'tdf-color') {
    return ansiCellLines(result.rows, result.palette, terminalMode, {
      transparentBg: options.transparentBg ?? BANNER_DEFAULTS.transparentBg,
    }).join('\n');
  }
  if (terminalMode === 'plain') {
    return plainText(result.rows);
  }
  return ansiLines(result.rows, result.colors, terminalMode).join('\n');
}
