import { quantizeColor } from './color.js';
import { defaultPaletteForSlots } from './cell-render.js';

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function rgb(color) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function plainHtml(rows, colors, terminalMode) {
  const plain = terminalMode === 'plain';
  const lines = rows.map((text, index) => {
    const safe = escapeHtml(text.length === 0 ? ' ' : text);
    if (plain) return safe;
    const raw = colors[index] ?? colors[colors.length - 1] ?? { r: 255, g: 255, b: 255 };
    const color = quantizeColor(raw, terminalMode);
    return `<span style="color:${rgb(color)}">${safe}</span>`;
  });
  return `<pre class="banner">${lines.join('\n')}</pre>`;
}

function cellHtml(rows, palette, terminalMode, transparentBg) {
  const plain = terminalMode === 'plain';
  const lines = rows.map((row) => {
    let line = '';
    for (const cell of row) {
      const safe = escapeHtml(cell.ch);
      if (plain) { line += safe; continue; }
      const colors = palette[cell.color] ?? defaultPaletteForSlots([cell.color])[cell.color];
      const fg = quantizeColor(colors.fg, terminalMode);
      const styles = [`color:${rgb(fg)}`];
      if (!transparentBg && colors.bg) {
        const bg = quantizeColor(colors.bg, terminalMode);
        styles.push(`background:${rgb(bg)}`);
      }
      line += `<span style="${styles.join(';')}">${safe}</span>`;
    }
    return line;
  });
  return `<pre class="banner">${lines.join('\n')}</pre>`;
}

export function bannerToHtml(result, terminalMode, options = {}) {
  if (result.kind === 'tdf-color') {
    return cellHtml(result.rows, result.palette, terminalMode, options.transparentBg ?? true);
  }
  return plainHtml(result.rows, result.colors, terminalMode);
}

export function htmlPage(bodyHtml, meta = {}) {
  const title = escapeHtml(meta.title ?? 'TermBanner API');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>${title}</title>
<style>
  body { margin: 0; background: #080a0b; color: #c0c0c0; }
  .banner {
    margin: 0; padding: 1rem; overflow-x: auto;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    line-height: 1; white-space: pre; font-size: 14px;
  }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
