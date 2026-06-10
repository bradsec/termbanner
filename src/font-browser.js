import { quantizeColor } from './color.js';
import { renderCellRows, defaultPaletteForSlots } from './cell-render.js';
import { renderRows } from './font.js';
import { renderFlfRows } from './flf.js';
import { previewLines } from './render.js';
import { orderedFontEntries } from './app-defaults.js';

const CARD_FONT_SIZE = 12;
const CARD_FONT = `${CARD_FONT_SIZE}px "DejaVu Sans Mono", "Noto Sans Mono", "Cascadia Mono", Consolas, monospace`;
const CARD_LINE_HEIGHT_PLAIN = Math.ceil(CARD_FONT_SIZE * 1.2);
const CARD_LINE_HEIGHT_TDF   = Math.ceil(CARD_FONT_SIZE * 1.06);
const PREVIEW_GLYPH_ORDER = 'BANNERTERMSHADOWFIGL0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function measureCtx() {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = CARD_FONT;
  return ctx;
}

function drawPlainCanvas(font, text, colors, renderFn = renderRows) {
  const rows = renderFn(font, text);
  const lines = previewLines(rows, colors, 'truecolor');
  const m = measureCtx();
  const width  = Math.ceil(Math.max(1, ...lines.map((l) => m.measureText(l.text).width)));
  const height = Math.ceil(lines.length * CARD_LINE_HEIGHT_PLAIN);
  const ratio  = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width  = width  * ratio;
  canvas.height = height * ratio;
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.font = CARD_FONT;
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 0, i * CARD_LINE_HEIGHT_PLAIN);
  });
  return canvas;
}

function drawTdfCanvas(font, text, previewBg) {
  const rows    = renderCellRows(font, text);
  const palette = defaultPaletteForSlots(font.colorSlots ?? []);
  const m         = measureCtx();
  const cellWidth = Math.ceil(m.measureText('M').width);
  const columns   = Math.max(1, ...rows.map((r) => r.length));
  const ratio     = window.devicePixelRatio || 1;
  const width     = columns * cellWidth;
  const height    = rows.length * CARD_LINE_HEIGHT_TDF;
  const canvas = document.createElement('canvas');
  canvas.width  = width  * ratio;
  canvas.height = height * ratio;
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.font = CARD_FONT;
  ctx.textBaseline = 'top';
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, col) => {
      const raw = palette[cell.color] ?? palette['0x00'];
      const fg = raw.fg;
      const bg = raw.bg;
      const x = col * cellWidth;
      const y = rowIndex * CARD_LINE_HEIGHT_TDF;
      const isBlackBg = bg.r === 0 && bg.g === 0 && bg.b === 0;
      ctx.fillStyle = isBlackBg ? previewBg : `rgb(${bg.r} ${bg.g} ${bg.b})`;
      ctx.fillRect(x, y, cellWidth, CARD_LINE_HEIGHT_TDF);
      if (cell.ch !== ' ') {
        ctx.fillStyle = `rgb(${fg.r} ${fg.g} ${fg.b})`;
        ctx.fillText(cell.ch, x, y);
      }
    });
  });
  return canvas;
}

export function previewTextCandidates(text, glyphs) {
  const candidates = [];
  const firstLine = String(text ?? '').trim().split('\n')[0].trim().slice(0, 4);

  if (firstLine.length > 0 && supportsText(glyphs, firstLine)) {
    candidates.push(firstLine);
  }

  if (supportsText(glyphs, 'ABC')) {
    candidates.push('ABC');
  }

  const supportedSample = candidates.length === 0 ? supportedGlyphSample(glyphs) : '';
  if (supportedSample.length > 0) {
    candidates.push(supportedSample);
  }

  return [...new Set(candidates)];
}

function supportsText(glyphs, text) {
  return [...text].every((char) => supportsChar(glyphs, char));
}

function supportsChar(glyphs, char) {
  if (!glyphs || typeof glyphs !== 'object') return false;
  return glyphs[char] !== undefined || glyphs[char.toLocaleUpperCase('en-US')] !== undefined;
}

function supportedGlyphSample(glyphs) {
  if (!glyphs || typeof glyphs !== 'object') return '';

  const chars = [];
  for (const char of PREVIEW_GLYPH_ORDER) {
    if (supportsChar(glyphs, char) && !chars.includes(char.toLocaleUpperCase('en-US'))) {
      chars.push(char.toLocaleUpperCase('en-US'));
    }
    if (chars.length === 4) return chars.join('');
  }

  for (const char of Object.keys(glyphs)) {
    if (char !== ' ' && [...char].length === 1 && !chars.includes(char)) {
      chars.push(char);
    }
    if (chars.length === 4) break;
  }

  return chars.join('');
}

export class FontBrowser {
  static #instance = null;

  static open(options) {
    FontBrowser.#instance?.#destroy();
    FontBrowser.#instance = new FontBrowser(options);
  }

  static close() {
    FontBrowser.#instance?.#destroy();
  }

  #el;
  #grid;
  #emptyState;
  #title;
  #totalCount;
  #observer;
  #onSelect;
  #plainFonts;
  #renderOpts;
  #escHandler;
  #flfIndex;
  #loadFlfFont;
  #typeFilter;
  #searchQuery;

  constructor({ plainFonts, tdfIndex, flfIndex, fontTypeFilter = 'all', text, colors, previewBg, onSelect, loadTdfFont, loadFlfFont }) {
    this.#onSelect   = onSelect;
    this.#plainFonts = plainFonts;
    this.#renderOpts = { text, colors, previewBg, loadTdfFont, loadFlfFont };
    this.#flfIndex   = flfIndex ?? [];
    this.#loadFlfFont = loadFlfFont;
    this.#typeFilter  = fontTypeFilter;
    this.#searchQuery = '';

    // Overlay
    this.#el = document.createElement('div');
    this.#el.className = 'fb-overlay';
    this.#el.addEventListener('click', (e) => { if (e.target === this.#el) this.#destroy(); });

    // Window
    const win = document.createElement('div');
    win.className = 'fb-win';

    // Title bar
    const titlebar = document.createElement('div');
    titlebar.className = 'fb-titlebar';
    const icon  = document.createElement('span');
    icon.className = 'fb-titlebar-icon';
    icon.textContent = 'TB';
    const title = document.createElement('span');
    title.className = 'fb-titlebar-title';
    title.textContent = 'Browse Fonts';
    const btns = document.createElement('div');
    btns.className = 'fb-titlebar-buttons';
    ['_', '□', '×'].forEach((ch, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'win-titlebar-btn';
      b.tabIndex = -1;
      b.textContent = ch;
      if (i === 2) b.addEventListener('click', () => this.#destroy());
      btns.append(b);
    });
    titlebar.append(icon, title, btns);

    // Search bar
    const searchBar = document.createElement('div');
    searchBar.className = 'fb-searchbar';

    // Row 1: text filter
    const searchRow = document.createElement('div');
    searchRow.className = 'fb-searchbar-row';
    const searchLabel = document.createElement('span');
    searchLabel.className = 'field-label';
    searchLabel.textContent = 'Filter:';
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'text-input fb-search-input';
    searchInput.placeholder = 'Font name...';
    searchInput.addEventListener('input', () => {
      this.#searchQuery = searchInput.value;
      this.#applyFilters();
    });
    searchRow.append(searchLabel, searchInput);

    // Row 2: type filter buttons + jump buttons
    const controlRow = document.createElement('div');
    controlRow.className = 'fb-searchbar-row fb-searchbar-controls';

    const typeBtns = document.createElement('div');
    typeBtns.className = 'fb-type-btns';
    for (const [value, label] of [['all', 'All'], ['figlet', 'Figlet'], ['thedraw', 'TheDraw']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fb-type-btn';
      btn.dataset.filter = value;
      btn.textContent = label;
      if (value === this.#typeFilter) btn.classList.add('active');
      btn.addEventListener('click', () => this.#setTypeFilter(value));
      typeBtns.append(btn);
    }

    const jumpBtns = document.createElement('div');
    jumpBtns.className = 'fb-jump-btns';
    for (const [pos, label] of [['top', 'Top'], ['middle', 'Mid'], ['bottom', 'Bot']]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fb-jump-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => this.#jumpTo(pos));
      jumpBtns.append(btn);
    }

    controlRow.append(typeBtns, jumpBtns);
    searchBar.append(searchRow, controlRow);

    // Grid
    this.#grid = document.createElement('div');
    this.#grid.className = 'fb-grid';
    this.#grid.tabIndex = -1;

    const entries = orderedFontEntries({ plainFonts, flfIndex: this.#flfIndex, tdfIndex });
    this.#title = title;
    this.#totalCount = entries.length;
    title.textContent = `Browse Fonts (${entries.length.toLocaleString('en-US')})`;

    for (const entry of entries) {
      this.#grid.append(this.#makeCard(entry.key, entry.name));
    }

    this.#emptyState = document.createElement('div');
    this.#emptyState.className = 'fb-empty';
    this.#emptyState.textContent = 'No matching fonts';
    this.#emptyState.style.display = 'none';

    win.append(titlebar, searchBar, this.#grid, this.#emptyState);
    this.#el.append(win);
    document.body.append(this.#el);
    document.body.classList.add('fb-open');

    this.#escHandler = (e) => { if (e.key === 'Escape') this.#destroy(); };
    document.addEventListener('keydown', this.#escHandler);

    // Lazy-render visible cards
    this.#observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            this.#renderCard(entry.target);
            this.#observer.unobserve(entry.target);
          }
        }
      },
      { root: this.#grid, rootMargin: '300px' },
    );
    for (const card of this.#grid.querySelectorAll('.fb-card')) {
      this.#observer.observe(card);
    }

    // Apply initial type filter if not 'all'
    if (this.#typeFilter !== 'all') {
      this.#applyFilters();
    }

    searchInput.focus();
  }

  #makeCard(fontKey, name) {
    const card = document.createElement('div');
    card.className = 'fb-card';
    card.dataset.fontKey = fontKey;
    card.dataset.name = name.toLowerCase();
    card.dataset.kind = fontKey.startsWith('tdf:') ? 'thedraw' : 'figlet';

    const preview = document.createElement('div');
    preview.className = 'fb-card-preview';
    preview.style.background = this.#renderOpts.previewBg;

    const label = document.createElement('div');
    label.className = 'fb-card-label';
    label.textContent = name;

    card.append(preview, label);
    card.addEventListener('click', () => {
      this.#onSelect(fontKey);
      this.#destroy();
    });
    return card;
  }

  async #renderCard(card) {
    const preview  = card.querySelector('.fb-card-preview');
    const fontKey  = card.dataset.fontKey;
    const { text, colors, previewBg, loadTdfFont, loadFlfFont } = this.#renderOpts;

    try {
      let canvas;
      if (fontKey.startsWith('plain:')) {
        const font = this.#plainFonts[fontKey.slice('plain:'.length)];
        const candidates = previewTextCandidates(text, font?.glyphs);
        canvas = this.#tryRenderPlain(font, candidates, colors);
      } else if (fontKey.startsWith('flf:')) {
        const font = await loadFlfFont(fontKey.slice('flf:'.length));
        const candidates = previewTextCandidates(text, font?.glyphs);
        canvas = this.#tryRenderFlf(font, candidates, colors);
      } else {
        const font = await loadTdfFont(fontKey.slice('tdf:'.length));
        const candidates = previewTextCandidates(text, font?.glyphs);
        canvas = this.#tryRenderTdf(font, candidates, previewBg);
      }
      if (canvas) preview.replaceChildren(canvas);
    } catch {
      // leave preview empty on hard failure
    }
  }

  #tryRenderPlain(font, candidates, colors) {
    for (const text of candidates) {
      try { return drawPlainCanvas(font, text, colors); } catch { /* next */ }
    }
    return null;
  }

  #tryRenderFlf(font, candidates, colors) {
    for (const text of candidates) {
      try { return drawPlainCanvas(font, text, colors, renderFlfRows); } catch { /* next */ }
    }
    return null;
  }

  #tryRenderTdf(font, candidates, previewBg) {
    for (const text of candidates) {
      try { return drawTdfCanvas(font, text, previewBg); } catch { /* next */ }
    }
    return null;
  }

  #applyFilters() {
    const q = this.#searchQuery.toLowerCase().trim();
    const t = this.#typeFilter;
    let visible = 0;
    for (const card of this.#grid.querySelectorAll('.fb-card')) {
      const textMatch = q.length === 0 || card.dataset.name.includes(q);
      const typeMatch = t === 'all' || card.dataset.kind === t;
      const hide = !textMatch || !typeMatch;
      card.style.display = hide ? 'none' : '';
      if (!hide) visible++;
    }
    const total = this.#totalCount;
    if (q.length === 0 && t === 'all') {
      this.#title.textContent = `Browse Fonts (${total.toLocaleString('en-US')})`;
    } else {
      this.#title.textContent = `Browse Fonts (${visible.toLocaleString('en-US')} of ${total.toLocaleString('en-US')})`;
    }
    this.#emptyState.style.display = visible === 0 ? 'flex' : 'none';
    this.#grid.style.display = visible === 0 ? 'none' : '';
  }

  #setTypeFilter(value) {
    this.#typeFilter = value;
    for (const btn of this.#el.querySelectorAll('.fb-type-btn')) {
      btn.classList.toggle('active', btn.dataset.filter === value);
    }
    this.#applyFilters();
  }

  #jumpTo(position) {
    if (position === 'top') {
      this.#grid.scrollTop = 0;
    } else if (position === 'bottom') {
      this.#grid.scrollTop = this.#grid.scrollHeight;
    } else {
      this.#grid.scrollTop = (this.#grid.scrollHeight - this.#grid.clientHeight) / 2;
    }
    this.#grid.focus({ preventScroll: true });
  }

  #destroy() {
    this.#observer?.disconnect();
    document.removeEventListener('keydown', this.#escHandler);
    this.#el.remove();
    document.body.classList.remove('fb-open');
    FontBrowser.#instance = null;
  }
}
