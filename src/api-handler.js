import { parseHex } from './color.js';
import { resolveFont } from './resolve-font.js';
import { renderBanner, bannerToAnsi } from './banner.js';
import { bannerToHtml, htmlPage } from './banner-html.js';
import { isScriptFormat, scriptFilename, generateScript } from './script-api.js';

const MAX_TEXT = 200;
const MAX_STOPS = 10;
const SPACING_MIN = -50;
const SPACING_MAX = 50;
const PAD_MIN = -50;
const PAD_MAX = 100;
const MAX_PALETTE = 64;
const MAX_OUTPUT = 500000; // cells/chars; defense-in-depth output-size guard
const CACHE = 'public, max-age=86400';
const DEPTHS = new Set(['truecolor', '256', '16']);
const DEFAULT_FONT = 'ANSI Shadow';
const DEFAULT_GRADIENT = ['#33ff00', '#0066ff'];

const PLAIN_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};
const HTML_HEADERS = {
  'Content-Type': 'text/html; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
};

function error(status, message) {
  return {
    status,
    headers: { ...PLAIN_HEADERS, 'Cache-Control': 'no-store' },
    body: `${message}\n`,
  };
}

// Sum of row lengths: char count for plain rows (strings), cell count for
// TheDraw rows (arrays). Used to reject pathologically large output.
export function outputCellCount(result) {
  return result.rows.reduce((total, row) => total + row.length, 0);
}

function wantsHtml(accept) {
  return String(accept ?? '').toLowerCase().includes('text/html');
}

function parseGradient(value) {
  const stops = value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (stops.length > MAX_STOPS) {
    throw new Error(`too many gradient stops (max ${MAX_STOPS})`);
  }
  for (const stop of stops) {
    parseHex(stop); // throws on invalid hex
  }
  return stops;
}

function intParam(params, name, def, min, max) {
  const raw = params.get(name);
  if (raw === null || raw === '') return def;
  if (!/^-?\d+$/.test(raw.trim())) {
    throw new Error(`${name} must be an integer`);
  }
  const n = Number.parseInt(raw, 10);
  if (n < min || n > max) {
    throw new Error(`${name} out of range [${min}, ${max}]`);
  }
  return n;
}

// Parse `palette=SLOT-FGHEX[-BGHEX],...` into { '0xNN': { fg, bg? } }, validating
// each slot against the font's colorSlots and each color as hex.
function parsePalette(value, colorSlots) {
  const slotSet = new Set(colorSlots.map((s) => s.toLowerCase()));
  const entries = value.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (entries.length > MAX_PALETTE) {
    throw new Error(`too many palette entries (max ${MAX_PALETTE})`);
  }
  const overrides = {};
  for (const entry of entries) {
    const [slotRaw, fgRaw, bgRaw] = entry.split('-');
    if (!slotRaw || !fgRaw) {
      throw new Error(`invalid palette entry "${entry}"`);
    }
    const slot = `0x${slotRaw.replace(/^0x/i, '').toLowerCase().padStart(2, '0')}`;
    if (!slotSet.has(slot)) {
      throw new Error(`unknown palette slot "${slotRaw}"`);
    }
    const channels = { fg: parseHex(fgRaw) };
    if (bgRaw) channels.bg = parseHex(bgRaw);
    overrides[slot] = channels;
  }
  return overrides;
}

export async function handleApi(rawQuery, accept, loaders) {
  const params = new URLSearchParams(rawQuery);

  let text = params.get('text');
  if (!text || !text.trim()) {
    return error(400, 'text is required');
  }
  text = text.replace(/\\n/g, '\n');
  if (text.length > MAX_TEXT) {
    return error(400, `text too long (max ${MAX_TEXT} characters)`);
  }

  const mode = params.get('mode') ?? 'ansi';
  if (mode !== 'ansi' && mode !== 'plain') {
    return error(400, 'mode must be "ansi" or "plain"');
  }
  const depth = params.get('depth') ?? 'truecolor';
  if (!DEPTHS.has(depth)) {
    return error(400, 'depth must be "truecolor", "256", or "16"');
  }
  const terminalMode = mode === 'plain' ? 'plain' : depth;

  let spacing;
  try {
    spacing = {
      letterSpacing: intParam(params, 'letterspacing', 0, SPACING_MIN, SPACING_MAX),
      lineSpacing: intParam(params, 'linespacing', 1, SPACING_MIN, SPACING_MAX),
      paddingLeft: intParam(params, 'padleft', 1, PAD_MIN, PAD_MAX),
      paddingTop: intParam(params, 'padtop', 1, PAD_MIN, PAD_MAX),
      paddingBottom: intParam(params, 'padbottom', 1, PAD_MIN, PAD_MAX),
    };
  } catch (e) {
    return error(400, e.message);
  }

  let colorMode = 'gradient';
  let solidColor;
  let gradientColors = DEFAULT_GRADIENT;
  let plainTextColor;
  try {
    const color = params.get('color');
    const grad = params.get('gradient');
    if (color) {
      parseHex(color);
      solidColor = color;
      colorMode = 'solid';
    } else if (grad) {
      gradientColors = parseGradient(grad);
    }
    const plain = params.get('plaincolor');
    if (plain) {
      parseHex(plain);
      plainTextColor = plain;
    }
  } catch (e) {
    return error(400, e.message);
  }

  const indexes = await loaders.indexes();
  const descriptor = resolveFont(params.get('font') ?? DEFAULT_FONT, indexes);
  if (!descriptor) {
    return error(400, `unknown font "${params.get('font')}"`);
  }

  let font;
  try {
    font = await loaders.loadFont(descriptor);
  } catch (e) {
    return error(400, e.message);
  }

  let paletteOverrides;
  try {
    const paletteParam = params.get('palette');
    if (paletteParam && font.kind === 'tdf-color') {
      paletteOverrides = parsePalette(paletteParam, font.colorSlots ?? []);
    }
  } catch (e) {
    return error(400, e.message);
  }

  let result;
  try {
    result = renderBanner({
      font,
      text,
      colorMode,
      solidColor,
      gradientColors,
      paletteOverrides,
      plainTextColor,
      letterSpacing: spacing.letterSpacing,
      lineSpacing: spacing.lineSpacing,
      paddingLeft: spacing.paddingLeft,
      paddingTop: spacing.paddingTop,
      paddingBottom: spacing.paddingBottom,
    });
  } catch (e) {
    return error(400, e.message);
  }

  if (outputCellCount(result) > MAX_OUTPUT) {
    return error(400, 'rendered output too large');
  }

  const format = params.get('format');
  if (format) {
    if (!isScriptFormat(format)) {
      return error(400, `unknown format "${format}"`);
    }
    const script = generateScript(format, result, { transparentBg: true });
    return {
      status: 200,
      headers: {
        ...PLAIN_HEADERS,
        'Cache-Control': CACHE,
        'Content-Disposition': `inline; filename="${scriptFilename(format)}"`,
      },
      body: script,
    };
  }

  if (wantsHtml(accept)) {
    const body = bannerToHtml(result, terminalMode, { transparentBg: true });
    return {
      status: 200,
      headers: { ...HTML_HEADERS, 'Cache-Control': CACHE },
      body: htmlPage(body, { title: 'TermBanner' }),
    };
  }

  const ansi = bannerToAnsi(result, terminalMode, { transparentBg: true });
  return {
    status: 200,
    headers: { ...PLAIN_HEADERS, 'Cache-Control': CACHE },
    body: `${ansi}\n`,
  };
}
