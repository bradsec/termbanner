import { toHex } from './color.js';
import { defaultPaletteForSlots } from './cell-render.js';
import { hasPlainText } from './banner.js';

const DEF = {
  gradient: ['#33ff00', '#0066ff'],
  letterSpacing: 0,
  lineSpacing: 1,
  paddingLeft: 1,
  paddingTop: 1,
  paddingBottom: 1,
};

function bare(hex) {
  return String(hex).replace(/^#/, '').toLowerCase();
}

function sameRgb(a, b) {
  return a && b && a.r === b.r && a.g === b.g && a.b === b.b;
}

function gradientEqualsDefault(colors) {
  return Array.isArray(colors)
    && colors.length === DEF.gradient.length
    && colors.every((c, i) => bare(c) === bare(DEF.gradient[i]));
}

function paletteDiff(palette, colorSlots) {
  const base = defaultPaletteForSlots(colorSlots ?? []);
  const parts = [];
  for (const slot of colorSlots ?? []) {
    const cur = palette?.[slot];
    const def = base[slot];
    if (!cur || !def) continue;
    const fgChanged = !sameRgb(cur.fg, def.fg);
    const bgChanged = !sameRgb(cur.bg, def.bg);
    if (!fgChanged && !bgChanged) continue;
    const slotId = slot.replace(/^0x/i, '');
    let entry = `${slotId}-${bare(toHex(cur.fg))}`;
    if (bgChanged) entry += `-${bare(toHex(cur.bg))}`;
    parts.push(entry);
  }
  return parts.join(',');
}

export function buildApiQuery(state) {
  const p = new URLSearchParams();
  p.set('text', state.text);
  p.set('font', state.fontKey);

  const tm = state.terminalMode;
  if (tm === 'plain') {
    p.set('mode', 'plain');
  } else if (tm === '256' || tm === '16') {
    p.set('depth', tm);
  }

  const isTdf = String(state.fontKey).startsWith('tdf:');
  if (isTdf) {
    const diff = paletteDiff(state.palette, state.colorSlots);
    if (diff) p.set('palette', diff);
  } else if (tm !== 'plain') {
    if (state.colorMode === 'solid') {
      p.set('color', bare(state.solidColor));
    } else if (!gradientEqualsDefault(state.gradientColors)) {
      p.set('gradient', state.gradientColors.map(bare).join(','));
    }
  }

  if (state.letterSpacing !== DEF.letterSpacing) p.set('letterspacing', String(state.letterSpacing));
  if (state.lineSpacing !== DEF.lineSpacing) p.set('linespacing', String(state.lineSpacing));
  if (state.paddingLeft !== DEF.paddingLeft) p.set('padleft', String(state.paddingLeft));
  if (state.paddingTop !== DEF.paddingTop) p.set('padtop', String(state.paddingTop));
  if (state.paddingBottom !== DEF.paddingBottom) p.set('padbottom', String(state.paddingBottom));

  if (state.plainTextColorMode === 'manual' && state.plainTextColor && hasPlainText(state.text)) {
    p.set('plaincolor', bare(state.plainTextColor));
  }

  return p.toString();
}

export function buildCurlCommand(state, origin = 'https://termbanner.com') {
  // Double quotes so the same command works on Windows cmd/PowerShell (which do
  // not treat single quotes as delimiters) as well as bash/zsh. The query is
  // URL-encoded, so no shell-special characters survive inside the quotes.
  return `curl "${origin}/api?${buildApiQuery(state)}"`;
}

const SCRIPT_VARIANTS = [
  ['bash', 'Bash .sh', 'sh'],
  ['powershell', 'PowerShell .ps1', 'ps1'],
  ['python', 'Python .py', 'py'],
  ['go', 'Go .go', 'go'],
  ['rust', 'Rust .rs', 'rs'],
  ['javascript', 'JavaScript .js', 'js'],
];

// All curl variants for the current banner: raw ANSI, plain text, and each
// script format. The base query (font, color, palette, spacing) is shared; only
// the output selector differs. `depth` is kept for ANSI/plain but stripped from
// script formats, where it has no effect. Script variants append `-o
// termbanner.<ext>` so the copied command saves to a named file.
export function buildApiVariants(state, origin = 'https://termbanner.com') {
  const root = new URLSearchParams(buildApiQuery(state));
  root.delete('mode');
  root.delete('format');

  const make = (mutate) => {
    const p = new URLSearchParams(root.toString());
    mutate(p);
    return `curl "${origin}/api?${p.toString()}"`;
  };

  return [
    { id: 'ansi', label: 'ANSI (default)', curl: make(() => {}) },
    { id: 'plain', label: 'Plain text', curl: make((p) => p.set('mode', 'plain')) },
    ...SCRIPT_VARIANTS.map(([fmt, label, ext]) => ({
      id: fmt,
      label,
      curl: `${make((p) => { p.delete('depth'); p.set('format', fmt); })} -o termbanner.${ext}`,
    })),
  ];
}
