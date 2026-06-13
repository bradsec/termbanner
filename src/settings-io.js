import { MAX_GRADIENT_STOPS } from './random-color.js';

export const SETTINGS_VERSION = 1;
export const MAX_TEXT_LEN = 1000;
export const CONTROL_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/;

const SCALAR_KEYS = [
  'text', 'fontKey', 'fontTypeFilter', 'colorMode',
  'solidColor', 'plainTextColor', 'plainTextColorMode', 'terminalMode',
  'letterSpacing', 'lineSpacing', 'paddingLeft', 'paddingTop', 'paddingBottom',
  'transparentBg', 'previewBg', 'previewFg', 'previewSizeId',
];

function paletteMapToObject(map) {
  const out = {};
  if (!(map instanceof Map)) return out;
  for (const [key, slots] of map) {
    const slotOut = {};
    for (const [slot, entry] of Object.entries(slots ?? {})) {
      slotOut[slot] = {
        fg: { ...entry.fg },
        bg: { ...entry.bg },
      };
    }
    out[key] = slotOut;
  }
  return out;
}

export function serializeSettings(state) {
  const settings = {};
  for (const key of SCALAR_KEYS) settings[key] = state[key];
  settings.gradientColors = [...(state.gradientColors ?? [])];
  settings.tdfPalettes = paletteMapToObject(state.tdfPalettes);
  return { app: 'termbanner', version: SETTINGS_VERSION, settings };
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SLOT = /^0x[0-9a-fA-F]{2}$/;
const ENUMS = {
  fontTypeFilter: ['all', 'figlet', 'thedraw'],
  colorMode: ['solid', 'gradient'],
  plainTextColorMode: ['auto', 'manual'],
  terminalMode: ['truecolor', '256', '16', 'plain'],
  previewSizeId: ['fit', '80x24', '120x30'],
};
const NUMERIC_KEYS = ['letterSpacing', 'lineSpacing', 'paddingLeft', 'paddingTop', 'paddingBottom'];
const HEX_KEYS = ['solidColor', 'plainTextColor', 'previewBg', 'previewFg'];

function clampInt(value, lo, hi) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}

function isRgb(c) {
  if (!c || typeof c !== 'object') return false;
  return ['r', 'g', 'b'].every((k) => Number.isInteger(c[k]) && c[k] >= 0 && c[k] <= 255);
}

function validatePalettes(raw, warnings) {
  const out = {};
  if (!raw || typeof raw !== 'object') return out;
  let dropped = false;
  for (const [fontKey, slots] of Object.entries(raw)) {
    // reject prototype-polluting keys before using fontKey as a property name
    if (fontKey === '__proto__' || fontKey === 'constructor' || fontKey === 'prototype') {
      dropped = true;
      continue;
    }
    if (!slots || typeof slots !== 'object') { dropped = true; continue; }
    const slotOut = {};
    let ok = true;
    for (const [slot, entry] of Object.entries(slots)) {
      if (!SLOT.test(slot) || !entry || !isRgb(entry.fg) || !isRgb(entry.bg)) { ok = false; break; }
      slotOut[slot] = { fg: { ...entry.fg }, bg: { ...entry.bg } };
    }
    if (ok && Object.keys(slotOut).length) out[fontKey] = slotOut;
    else dropped = true;
  }
  if (dropped) warnings.push('Some saved TheDraw palettes were invalid and skipped.');
  return out;
}

export function parseSettings(raw, { defaults }) {
  if (!raw || typeof raw !== 'object' || raw.app !== 'termbanner') return null;
  const src = (raw.settings && typeof raw.settings === 'object') ? raw.settings : {};
  const warnings = [];
  const out = { ...defaults };

  if ('text' in src) {
    if (typeof src.text === 'string' && !CONTROL_CHARS.test(src.text)) {
      out.text = src.text.length > MAX_TEXT_LEN ? src.text.slice(0, MAX_TEXT_LEN) : src.text;
    } else {
      out.text = defaults.text;
      warnings.push('Banner text was invalid and reset.');
    }
  }

  if ('fontKey' in src) {
    out.fontKey = typeof src.fontKey === 'string' ? src.fontKey : defaults.fontKey;
  }

  for (const [key, allowed] of Object.entries(ENUMS)) {
    if (!(key in src)) continue;
    if (allowed.includes(src[key])) out[key] = src[key];
    else { out[key] = defaults[key]; warnings.push(`${key} was invalid and reset.`); }
  }

  for (const key of HEX_KEYS) {
    if (!(key in src)) continue;
    if (typeof src[key] === 'string' && HEX.test(src[key])) out[key] = src[key];
    else { out[key] = defaults[key]; warnings.push(`${key} was invalid and reset.`); }
  }

  for (const key of NUMERIC_KEYS) {
    if (!(key in src)) continue;
    const v = clampInt(src[key], -8, 8);
    if (v === null) { out[key] = defaults[key]; warnings.push(`${key} was invalid and reset.`); }
    else out[key] = v;
  }

  if ('transparentBg' in src) out.transparentBg = Boolean(src.transparentBg);

  if ('gradientColors' in src) {
    const arr = Array.isArray(src.gradientColors)
      ? src.gradientColors.filter((c) => typeof c === 'string' && HEX.test(c))
      : [];
    if (arr.length >= 2) out.gradientColors = arr.slice(0, MAX_GRADIENT_STOPS);
    else { out.gradientColors = [...defaults.gradientColors]; warnings.push('Gradient colors were invalid and reset.'); }
  } else {
    out.gradientColors = [...defaults.gradientColors];
  }

  out.tdfPalettes = ('tdfPalettes' in src) ? validatePalettes(src.tdfPalettes, warnings) : {};

  return { settings: out, warnings };
}
