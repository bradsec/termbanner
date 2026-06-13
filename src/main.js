import './styles.css';
import { gradient, parseHex, quantizeColor, toHex } from './color.js';
import { randomizePalette } from './random-palette.js';
import { randomColor, randomGradient, MAX_GRADIENT_STOPS } from './random-color.js';
import { ColorPicker } from './color-picker.js';
import { ansiCellLines, cellRowsToPlainText, defaultPaletteForSlots } from './cell-render.js';
import { validateFonts } from './font.js';
import { plainText, previewLines } from './render.js';
import { generatePowerShellScript, generateShellScript } from './script-export.js';
import { generateGoScript, generateJavaScriptScript, generatePythonScript, generateRustScript } from './lang-export.js';
import { createScriptZip } from './zip-export.js';
import { FontBrowser } from './font-browser.js';
import { renderBanner as composeBanner, bannerColors, bannerToAnsi, hasPlainText } from './banner.js';
import { buildApiVariants } from './api-url.js';
import { DEFAULT_BANNER_TEXT, browseFontsLabel, buildFontOptionsHtml, randomFontKey } from './app-defaults.js';
import { serializeSettings, parseSettings } from './settings-io.js';

const app = document.querySelector('#app');

let gradientStopCount = 0;

const DEFAULTS = {
  solidColor: '#33ff00',
  gradientColors: ['#33ff00', '#0066ff'],
  letterSpacing: 0,
  lineSpacing: 1,
  paddingLeft: 1,
  paddingTop: 1,
  paddingBottom: 1,
  plainTextColor: '#ffffff',
  previewBg: '#080a0b',
  previewFg: '#AAAAAA',
  previewSizeId: '120x30',
};

// Common terminal emulator default window sizes (columns x rows).
// 80x24: classic VT100/xterm, macOS Terminal, GNOME Terminal default.
// 120x30: Windows Terminal default.
const PREVIEW_SIZES = [
  { id: 'fit',    label: 'Fit to window',    cols: null, rows: null },
  { id: '80x24',  label: '80 x 24 (classic)', cols: 80,  rows: 24 },
  { id: '120x30', label: '120 x 30 (Windows Terminal)', cols: 120, rows: 30 },
];

// The banner is always rendered at the cell size that fits this many columns in
// the available width (the widest preset). Using one reference for every mode
// keeps the banner a constant size, so changing the window size only changes
// the window box, not the banner itself.
const PREVIEW_REFERENCE_COLS = Math.max(...PREVIEW_SIZES.map((s) => s.cols || 0));

// Fixed monospace font size used when a fixed terminal size is selected,
// so the preview represents a real terminal grid instead of scaling to width.
const PRESET_FONT_SIZE = 14;

// A transient blip on the very first load (mobile network handoffs, tab
// backgrounded mid-fetch, etc.) used to leave the FLF/TDF font indexes
// empty for the rest of the session, since loadFonts() only runs once.
// Retry a few times before giving up.
const FONT_INDEX_LOAD_ATTEMPTS = 3;
const FONT_INDEX_RETRY_DELAY_MS = 400;

const state = {
  plainFonts: null,
  tdfIndex: [],
  loadedTdfFonts: new Map(),
  flfIndex: [],
  loadedFlfFonts: new Map(),
  tdfPalettes: new Map(),
  rendered: null,
  renderToken: 0,
  text: DEFAULT_BANNER_TEXT,
  fontKey: 'flf:ANSI_Shadow',
  fontTypeFilter: 'thedraw',
  colorMode: 'gradient',
  solidColor: DEFAULTS.solidColor,
  gradientColors: [...DEFAULTS.gradientColors],
  plainTextColor: DEFAULTS.plainTextColor,
  plainTextColorMode: 'auto',
  terminalMode: 'truecolor',
  letterSpacing: DEFAULTS.letterSpacing,
  lineSpacing: DEFAULTS.lineSpacing,
  paddingLeft: DEFAULTS.paddingLeft,
  paddingTop: DEFAULTS.paddingTop,
  paddingBottom: DEFAULTS.paddingBottom,
  transparentBg: true,
  previewBg: DEFAULTS.previewBg,
  previewFg: DEFAULTS.previewFg,
  previewSizeId: DEFAULTS.previewSizeId,
};


app.innerHTML = `
<div class="win-app">
  <div class="win-titlebar">
    <span class="win-titlebar-icon">TB</span>
    <span class="win-titlebar-title">TermBanner - ANSI Banner Generator</span>
    <div class="win-titlebar-buttons">
      <button type="button" class="win-titlebar-btn" tabindex="-1">_</button>
      <button type="button" class="win-titlebar-btn" tabindex="-1">&#9633;</button>
      <button type="button" class="win-titlebar-btn" tabindex="-1">&times;</button>
    </div>
  </div>

  <div class="win-menubar" role="menubar">
    <div class="win-menubar-item" id="fileMenu">File
      <div class="win-dropdown" role="menu">
        <button type="button" class="win-menu-item" id="menuDownloadSh">Download .sh</button>
        <button type="button" class="win-menu-item" id="menuDownloadPs1">Download .ps1</button>
        <button type="button" class="win-menu-item" id="menuDownloadPy">Download .py</button>
        <button type="button" class="win-menu-item" id="menuDownloadGo">Download .go</button>
        <button type="button" class="win-menu-item" id="menuDownloadRs">Download .rs</button>
        <button type="button" class="win-menu-item" id="menuDownloadJs">Download .js</button>
        <button type="button" class="win-menu-item" id="menuDownloadZip">Download all (.zip)</button>
        <div class="win-menu-sep"></div>
        <button type="button" class="win-menu-item" id="menuCopySh">Copy .sh</button>
        <button type="button" class="win-menu-item" id="menuCopyPs1">Copy .ps1</button>
        <button type="button" class="win-menu-item" id="menuCopyPy">Copy .py</button>
        <button type="button" class="win-menu-item" id="menuCopyGo">Copy .go</button>
        <button type="button" class="win-menu-item" id="menuCopyRs">Copy .rs</button>
        <button type="button" class="win-menu-item" id="menuCopyJs">Copy .js</button>
        <button type="button" class="win-menu-item" id="menuCopyAnsi">Copy ANSI</button>
        <button type="button" class="win-menu-item" id="menuCopyPlain">Copy plain text</button>
        <div class="win-menu-sep"></div>
        <button type="button" class="win-menu-item" id="menuSaveSettings">Save settings (.json)</button>
        <button type="button" class="win-menu-item" id="menuLoadSettings">Load settings...</button>
      </div>
    </div>
    <div class="win-menubar-item" id="optionsMenu">Options
      <div class="win-dropdown" role="menu">
        <button type="button" class="win-menu-item" id="menuPreviewBg">Terminal background...</button>
        <button type="button" class="win-menu-item" id="menuPreviewFg">Terminal text color...</button>
        <div class="win-menu-sep"></div>
        <button type="button" class="win-menu-item size-option" data-size="fit">Terminal size: Fit to window</button>
        <button type="button" class="win-menu-item size-option" data-size="80x24">Terminal size: 80 x 24 (classic)</button>
        <button type="button" class="win-menu-item size-option" data-size="120x30">Terminal size: 120 x 30 (Windows Terminal)</button>
        <div class="win-menu-sep"></div>
        <button type="button" class="win-menu-item" id="menuResetBg">Reset terminal background</button>
        <button type="button" class="win-menu-item" id="menuResetFg">Reset terminal text color</button>
        <button type="button" class="win-menu-item" id="menuResetDefaults">Reset colors and spacing</button>
        <button type="button" class="win-menu-item" id="menuResetAll">Reset all</button>
      </div>
    </div>
    <div class="win-menubar-item" id="creditsMenu">Credits</div>
    <div class="win-menubar-item" id="aboutMenu">About</div>
  </div>

  <div class="win-workspace">
    <section class="control-panel">

      <fieldset class="win-groupbox">
        <legend>Banner Text</legend>
        <textarea id="bannerText" rows="3" class="text-input" placeholder="Enter banner text..."></textarea>
      </fieldset>

      <fieldset class="win-groupbox">
        <legend>Font &amp; Mode</legend>
        <div class="stack">
        <label class="field stack">
          <span class="field-label">Font Type</span>
          <select id="fontTypeFilter" class="select-input">
            <option value="all">All</option>
            <option value="figlet">Figlet</option>
            <option value="thedraw">TheDraw</option>
          </select>
        </label>
        <div class="two-col">
          <label class="field stack">
            <span class="field-label">Font</span>
            <select id="fontKey" class="select-input"></select>
          </label>
          <label class="field stack">
            <span class="field-label">ANSI mode</span>
            <select id="terminalMode" class="select-input">
              <option value="truecolor">Truecolor</option>
              <option value="256">256 color</option>
              <option value="16">16 color</option>
              <option value="plain">Plain</option>
            </select>
          </label>
        </div>
        <div class="font-actions">
          <button id="browseFonts" type="button" class="action-button secondary">Browse All Fonts...</button>
          <button id="randomFont" type="button" class="action-button secondary">Random Font</button>
        </div>
        </div>
      </fieldset>

      <fieldset id="solidColorFieldset" class="win-groupbox">
        <legend><label class="legend-radio-label"><input type="radio" name="colorMode" id="solidModeRadio"> Solid Color</label></legend>
        <div id="solidControls" class="stack">
          <button id="randomColor" type="button" class="action-button secondary">Random Solid</button>
          <div class="color-preview-strip" id="solidPreviewStrip"></div>
          <label class="swatch-field">
            <span>Color</span>
            <button id="solidColor" type="button" class="color-swatch"></button>
          </label>
        </div>
      </fieldset>

      <fieldset id="gradientColorFieldset" class="win-groupbox">
        <legend><label class="legend-radio-label"><input type="radio" name="colorMode" id="gradientModeRadio" checked> Gradient Color</label></legend>
        <div class="color-actions">
          <button id="randomGradient" type="button" class="action-button secondary">Random Gradient</button>
          <button id="addStop" type="button" class="action-button secondary">+ Add stop</button>
        </div>
        <div id="gradientControls" class="stack"></div>
      </fieldset>

      <fieldset id="plainTextColorFieldset" class="win-groupbox" hidden>
        <legend>Plain Text Color</legend>
        <div class="stack">
          <label class="swatch-field">
            <span>Color</span>
            <button id="plainTextColor" type="button" class="color-swatch"></button>
          </label>
          <button id="plainTextAuto" type="button" class="action-button secondary">Auto (match font)</button>
        </div>
      </fieldset>

      <fieldset id="tdfPaletteFieldset" class="win-groupbox">
        <legend>Palette</legend>
        <div class="tdf-palette-actions">
          <button id="randomPalette" type="button" class="action-button secondary">Random Palette</button>
          <button id="resetPalette" type="button" class="action-button secondary">Reset Palette</button>
        </div>
        <div id="tdfPaletteControls" class="tdf-palette-controls"></div>
        <label class="toggle-field">
          <input id="transparentBg" type="checkbox" class="toggle-input">
          <span class="toggle-label">Transparent background</span>
        </label>
      </fieldset>

      <fieldset class="win-groupbox">
        <legend>Spacing</legend>
        <label class="range-field">
          <span class="range-label">
            <span>Letter spacing</span>
            <span id="letterSpacingValue" class="numeric-value"></span>
          </span>
          <input id="letterSpacing" type="range" min="-8" max="8" step="1" class="range-input">
        </label>
        <div class="spacing-sliders">
          <label class="range-field">
            <span class="range-label">
              <span>Left gap</span>
              <span id="paddingLeftValue" class="numeric-value"></span>
            </span>
            <input id="paddingLeft" type="range" min="-8" max="8" step="1" class="range-input">
          </label>
          <label class="range-field">
            <span class="range-label">
              <span>Top gap</span>
              <span id="paddingTopValue" class="numeric-value"></span>
            </span>
            <input id="paddingTop" type="range" min="-8" max="8" step="1" class="range-input">
          </label>
          <label class="range-field">
            <span class="range-label">
              <span>Bottom gap</span>
              <span id="paddingBottomValue" class="numeric-value"></span>
            </span>
            <input id="paddingBottom" type="range" min="-8" max="8" step="1" class="range-input">
          </label>
        </div>
        <label class="range-field">
          <span class="range-label">
            <span>Line gap</span>
            <span id="lineSpacingValue" class="numeric-value"></span>
          </span>
          <input id="lineSpacing" type="range" min="-8" max="8" step="1" class="range-input">
        </label>
      </fieldset>

      <fieldset class="win-groupbox">
        <legend>Export</legend>
        <div class="stack">
          <div class="two-col">
            <button id="downloadSh" type="button" class="action-button download">Download .sh</button>
            <button id="downloadPs1" type="button" class="action-button download">Download .ps1</button>
            <button id="downloadPy" type="button" class="action-button download">Download .py</button>
            <button id="downloadGo" type="button" class="action-button download">Download .go</button>
            <button id="downloadRs" type="button" class="action-button download">Download .rs</button>
            <button id="downloadJs" type="button" class="action-button download">Download .js</button>
          </div>
          <button id="downloadZip" type="button" class="action-button download wide">Download all (.zip)</button>
          <hr class="export-divider">
          <div class="two-col">
            <button id="copySh" type="button" class="action-button secondary">Copy .sh</button>
            <button id="copyPs1" type="button" class="action-button secondary">Copy .ps1</button>
            <button id="copyPy" type="button" class="action-button secondary">Copy .py</button>
            <button id="copyGo" type="button" class="action-button secondary">Copy .go</button>
            <button id="copyRs" type="button" class="action-button secondary">Copy .rs</button>
            <button id="copyJs" type="button" class="action-button secondary">Copy .js</button>
            <button id="copyAnsi" type="button" class="action-button secondary">Copy ANSI</button>
            <button id="copyPlain" type="button" class="action-button secondary">Copy plain text</button>
          </div>
        </div>
      </fieldset>

    </section>

    <section class="preview-column">
      <div class="dos-window terminal-panel">
        <div class="dos-titlebar">
          <span class="dos-titlebar-title">Command Prompt</span>
          <div class="dos-titlebar-right">
            <button type="button" class="dos-titlebar-btn" tabindex="-1">_</button>
            <button type="button" class="dos-titlebar-btn" tabindex="-1">&#9633;</button>
            <button type="button" class="dos-titlebar-btn" tabindex="-1">&times;</button>
          </div>
        </div>
        <div class="dos-prompt-line" id="dosPromptLine">
          <span class="dos-prompt-text">C:\\&gt;</span><span id="dosCommand" class="dos-command-text"></span>
        </div>
        <div id="terminalPreview" class="terminal-preview" role="img" aria-label="Banner preview"></div>
      </div>

      <div id="bannerDimensions" class="banner-dims"></div>

      <div class="dos-window output-panel">
        <div class="dos-titlebar">
          <span class="dos-titlebar-title">Command Prompt</span>
          <div class="dos-titlebar-right">
            <button type="button" class="dos-titlebar-btn" tabindex="-1">_</button>
            <button type="button" class="dos-titlebar-btn" tabindex="-1">&#9633;</button>
            <button type="button" class="dos-titlebar-btn" tabindex="-1">&times;</button>
          </div>
        </div>
        <div class="ansi-scroll dos-scroll">
          <div class="dos-prompt-line">
            <span class="dos-prompt-text">C:\\&gt;</span><span class="dos-command-text">type output.txt</span>
          </div>
          <pre id="ansiOutput" class="terminal-text ansi-output"></pre>
        </div>
      </div>

      <div class="dos-window api-panel">
        <div class="dos-titlebar">
          <span class="dos-titlebar-title">Command Prompt</span>
          <div class="dos-titlebar-right">
            <button type="button" class="dos-titlebar-btn" tabindex="-1">_</button>
            <button type="button" class="dos-titlebar-btn" tabindex="-1">&#9633;</button>
            <button type="button" class="dos-titlebar-btn" tabindex="-1">&times;</button>
          </div>
        </div>
        <div class="api-scroll dos-scroll">
          <div class="dos-prompt-line">
            <span class="dos-prompt-text">C:\\&gt;</span><span class="dos-command-text">termbanner --api</span>
          </div>
          <div id="apiVariants" class="api-variants" aria-label="API curl commands"></div>
        </div>
      </div>
    </section>
  </div>

  <div class="win-statusbar">
    <p id="status" class="win-status-panel status-line" role="status">Ready</p>
    <span id="statusDims" class="win-status-panel"></span>
    <span id="statusMode" class="win-status-panel"></span>
    <span class="win-status-panel win-status-version">v1.0</span>
    <span class="win-status-panel win-status-domain">termbanner.com</span>
  </div>
</div>
`;

const elements = {
  bannerText: document.querySelector('#bannerText'),
  bannerTextFieldset: document.querySelector('#bannerText').closest('fieldset'),
  controlPanel: document.querySelector('.control-panel'),
  winWorkspace: document.querySelector('.win-workspace'),
  fontKey: document.querySelector('#fontKey'),
  fontTypeFilter: document.querySelector('#fontTypeFilter'),
  terminalMode: document.querySelector('#terminalMode'),
  solidModeRadio: document.querySelector('#solidModeRadio'),
  gradientModeRadio: document.querySelector('#gradientModeRadio'),
  solidColorFieldset: document.querySelector('#solidColorFieldset'),
  gradientColorFieldset: document.querySelector('#gradientColorFieldset'),
  solidControls: document.querySelector('#solidControls'),
  gradientControls: document.querySelector('#gradientControls'),
  tdfPaletteFieldset: document.querySelector('#tdfPaletteFieldset'),
  tdfPaletteControls: document.querySelector('#tdfPaletteControls'),
  randomPalette: document.querySelector('#randomPalette'),
  resetPalette: document.querySelector('#resetPalette'),
  transparentBg: document.querySelector('#transparentBg'),
  dosPromptLine: document.querySelector('#dosPromptLine'),
  solidColor: document.querySelector('#solidColor'),
  randomColor: document.querySelector('#randomColor'),
  randomGradient: document.querySelector('#randomGradient'),
  addStop: document.querySelector('#addStop'),
  plainTextColorFieldset: document.querySelector('#plainTextColorFieldset'),
  plainTextColor: document.querySelector('#plainTextColor'),
  plainTextAuto: document.querySelector('#plainTextAuto'),
  letterSpacing: document.querySelector('#letterSpacing'),
  letterSpacingValue: document.querySelector('#letterSpacingValue'),
  paddingLeft: document.querySelector('#paddingLeft'),
  paddingLeftValue: document.querySelector('#paddingLeftValue'),
  paddingTop: document.querySelector('#paddingTop'),
  paddingTopValue: document.querySelector('#paddingTopValue'),
  paddingBottom: document.querySelector('#paddingBottom'),
  paddingBottomValue: document.querySelector('#paddingBottomValue'),
  lineSpacing: document.querySelector('#lineSpacing'),
  lineSpacingValue: document.querySelector('#lineSpacingValue'),
  terminalPreview: document.querySelector('#terminalPreview'),
  terminalPanel: document.querySelector('.terminal-panel'),
  dosCommand: document.querySelector('#dosCommand'),
  bannerDimensions: document.querySelector('#bannerDimensions'),
  ansiOutput: document.querySelector('#ansiOutput'),
  apiVariants: document.querySelector('#apiVariants'),
  status: document.querySelector('#status'),
  statusDims: document.querySelector('#statusDims'),
  statusMode: document.querySelector('#statusMode'),
  downloadSh: document.querySelector('#downloadSh'),
  downloadPs1: document.querySelector('#downloadPs1'),
  downloadZip: document.querySelector('#downloadZip'),
  copySh: document.querySelector('#copySh'),
  copyPs1: document.querySelector('#copyPs1'),
  copyAnsi: document.querySelector('#copyAnsi'),
  copyPlain: document.querySelector('#copyPlain'),
  downloadPy: document.querySelector('#downloadPy'),
  downloadGo: document.querySelector('#downloadGo'),
  downloadRs: document.querySelector('#downloadRs'),
  downloadJs: document.querySelector('#downloadJs'),
  copyPy: document.querySelector('#copyPy'),
  copyGo: document.querySelector('#copyGo'),
  copyRs: document.querySelector('#copyRs'),
  copyJs: document.querySelector('#copyJs'),
  browseFonts: document.querySelector('#browseFonts'),
  randomFont: document.querySelector('#randomFont'),
};

bindInputs();
initMenuBar();
await loadFonts();
render();

// Observe the preview column (not the preview itself): its width tracks the
// viewport in both directions, so resizing across the responsive breakpoint
// re-renders and switches between the fixed terminal size and fit-to-window.
// Observing the preview would miss this in fixed mode, where it has an explicit
// width that does not track the viewport. Call render() (not renderBanner)
// so a fresh render token is issued; a bare renderBanner() bails after its
// async font load because its token no longer matches state.renderToken.
const previewColumn = elements.terminalPanel?.parentElement || elements.terminalPreview;
new ResizeObserver(() => render()).observe(previewColumn);

async function loadFonts() {
  const response = await fetchFirst(['./fonts/ansi-fonts.json', './public/fonts/ansi-fonts.json']);
  if (!response.ok) {
    throw new Error(`failed to load fonts: ${response.status}`);
  }
  state.plainFonts = validateFonts(await response.json());
  state.tdfIndex = await loadTdfIndex();
  state.flfIndex = await loadFlfIndex();
  elements.fontKey.innerHTML = buildFontOptionsHtml(state);
  elements.browseFonts.textContent = browseFontsLabel(state);
  state.fontKey = randomFontKey(state);
}

async function fetchFirst(paths) {
  let lastResponse = null;
  for (const path of paths) {
    const response = await fetch(path.replace(/#/g, '%23'));
    if (response.ok) {
      return response;
    }
    lastResponse = response;
  }
  return lastResponse;
}

async function loadTdfIndex() {
  return loadFontIndex(
    ['./fonts/tdf/index.json', './public/fonts/tdf/index.json'],
    (entry) => entry?.kind === 'tdf-color' && typeof entry.key === 'string' && typeof entry.path === 'string',
  );
}

async function loadFontIndex(paths, isValidEntry) {
  let lastError;
  for (let attempt = 1; attempt <= FONT_INDEX_LOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchFirst(paths);
      if (!response?.ok) {
        throw new Error(`failed to load font index "${paths[0]}": ${response?.status}`);
      }

      const index = await response.json();
      if (!Array.isArray(index)) {
        throw new Error(`font index "${paths[0]}" must be an array`);
      }

      return index.filter(isValidEntry);
    } catch (error) {
      lastError = error;
      if (attempt < FONT_INDEX_LOAD_ATTEMPTS) {
        await sleep(FONT_INDEX_RETRY_DELAY_MS * attempt);
      }
    }
  }
  console.warn(lastError);
  return [];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function bindInputs() {
  elements.bannerText.value = state.text;
  elements.fontTypeFilter.value = state.fontTypeFilter;
  elements.terminalMode.value = state.terminalMode;
  elements.solidColor.style.background = state.solidColor;
  elements.plainTextColor.style.background = state.plainTextColor;
  elements.letterSpacing.value = String(state.letterSpacing);
  elements.lineSpacing.value = String(state.lineSpacing);
  elements.lineSpacingValue.textContent = String(state.lineSpacing);
  elements.paddingLeft.value = String(state.paddingLeft);
  elements.paddingLeftValue.textContent = String(state.paddingLeft);
  elements.paddingTop.value = String(state.paddingTop);
  elements.paddingTopValue.textContent = String(state.paddingTop);
  elements.paddingBottom.value = String(state.paddingBottom);
  elements.paddingBottomValue.textContent = String(state.paddingBottom);
  elements.transparentBg.checked = state.transparentBg;

  elements.bannerText.addEventListener('input', () => update('text', elements.bannerText.value));
  elements.fontTypeFilter.addEventListener('change', () => {
    state.fontTypeFilter = elements.fontTypeFilter.value;
    rebuildFontOptions();
  });
  elements.fontKey.addEventListener('change', () => update('fontKey', elements.fontKey.value));
  elements.terminalMode.addEventListener('change', () => update('terminalMode', elements.terminalMode.value));
  elements.solidColor.addEventListener('click', () => {
    ColorPicker.open(elements.solidColor, state.solidColor, (hex) => {
      elements.solidColor.style.background = hex;
      update('solidColor', hex);
    });
  });
  elements.plainTextColor.addEventListener('click', () => {
    const current = state.rendered?.plainColor ?? state.plainTextColor;
    ColorPicker.open(elements.plainTextColor, current, (hex) => {
      state.plainTextColorMode = 'manual';
      elements.plainTextColor.style.background = hex;
      update('plainTextColor', hex);
    });
  });
  elements.plainTextAuto.addEventListener('click', () => {
    state.plainTextColorMode = 'auto';
    render();
  });
  elements.letterSpacing.addEventListener('input', () => update('letterSpacing', Number.parseInt(elements.letterSpacing.value, 10)));
  elements.lineSpacing.addEventListener('input', () => update('lineSpacing', Number.parseInt(elements.lineSpacing.value, 10)));
  elements.paddingLeft.addEventListener('input', () => update('paddingLeft', Number.parseInt(elements.paddingLeft.value, 10)));
  elements.paddingTop.addEventListener('input', () => update('paddingTop', Number.parseInt(elements.paddingTop.value, 10)));
  elements.paddingBottom.addEventListener('input', () => update('paddingBottom', Number.parseInt(elements.paddingBottom.value, 10)));
  elements.transparentBg.addEventListener('change', () => update('transparentBg', elements.transparentBg.checked));
  elements.randomPalette.addEventListener('click', () => {
    if (!isTdfSelection()) return;
    const key = tdfKeyFromFontKey(state.fontKey);
    const pal = state.tdfPalettes.get(key);
    if (!pal) return;
    // Randomize from the font's default palette, not the live one, so brightness
    // is taken from the font's original shading rather than the last set palette
    // (which may already be randomized or quantized to a narrower ANSI depth).
    const base = defaultPaletteForSlots(Object.keys(pal));
    state.tdfPalettes.set(key, randomizePalette(base, Object.keys(base), state.terminalMode));
    render();
  });
  elements.resetPalette.addEventListener('click', () => {
    if (!isTdfSelection()) return;
    const key = tdfKeyFromFontKey(state.fontKey);
    const pal = state.tdfPalettes.get(key);
    if (!pal) return;
    state.tdfPalettes.set(key, defaultPaletteForSlots(Object.keys(pal)));
    render();
  });
  elements.solidModeRadio.addEventListener('change', () => update('colorMode', 'solid'));
  elements.gradientModeRadio.addEventListener('change', () => update('colorMode', 'gradient'));

  elements.randomColor.addEventListener('click', () => {
    const hex = randomColor(state.terminalMode);
    elements.solidColor.style.background = hex;
    state.colorMode = 'solid';
    update('solidColor', hex);
  });
  elements.randomGradient.addEventListener('click', () => {
    state.colorMode = 'gradient';
    update('gradientColors', randomGradient(state.terminalMode, MAX_GRADIENT_STOPS));
  });
  elements.addStop.addEventListener('click', () => {
    const cols = state.gradientColors;
    if (cols.length >= MAX_GRADIENT_STOPS) return;
    const a = parseHex(cols[cols.length - 2]);
    const b = parseHex(cols[cols.length - 1]);
    const mid = toHex({
      r: Math.round((a.r + b.r) / 2),
      g: Math.round((a.g + b.g) / 2),
      b: Math.round((a.b + b.b) / 2),
    });
    update('gradientColors', [...cols, mid]);
  });

  elements.downloadSh.addEventListener('click', () => download('banner.sh', currentShellScript(), 'text/x-shellscript'));
  elements.downloadPs1.addEventListener('click', () => download('banner.ps1', currentPowerShellScript(), 'text/plain'));
  elements.downloadZip.addEventListener('click', downloadZip);
  elements.copySh.addEventListener('click', () => copyText(currentShellScript()));
  elements.copyPs1.addEventListener('click', () => copyText(currentPowerShellScript()));
  elements.copyAnsi.addEventListener('click', () => copyText(currentAnsiText()));
  elements.copyPlain.addEventListener('click', () => copyText(currentPlainText()));
  elements.downloadPy.addEventListener('click', () => download('banner.py', currentPythonScript(), 'text/x-python'));
  elements.downloadGo.addEventListener('click', () => download('banner.go', currentGoScript(), 'text/x-go'));
  elements.downloadRs.addEventListener('click', () => download('banner.rs', currentRustScript(), 'text/x-rust'));
  elements.downloadJs.addEventListener('click', () => download('banner.js', currentJavaScriptScript(), 'text/javascript'));
  elements.copyPy.addEventListener('click', () => copyText(currentPythonScript()));
  elements.copyGo.addEventListener('click', () => copyText(currentGoScript()));
  elements.copyRs.addEventListener('click', () => copyText(currentRustScript()));
  elements.copyJs.addEventListener('click', () => copyText(currentJavaScriptScript()));

  elements.browseFonts.addEventListener('click', () => {
    if (!state.plainFonts) return;
    FontBrowser.open({
      plainFonts: state.plainFonts,
      tdfIndex: state.tdfIndex,
      flfIndex: state.flfIndex,
      fontTypeFilter: state.fontTypeFilter,
      text: state.text || 'ABC',
      colors: currentColors(20),
      previewBg: state.previewBg,
      onSelect: (fontKey) => update('fontKey', fontKey),
      loadTdfFont,
      loadFlfFont,
    });
  });

  elements.randomFont.addEventListener('click', () => {
    if (!state.plainFonts) return;
    let key = randomFontKey(state);
    for (let i = 0; i < 5 && key === state.fontKey; i += 1) {
      key = randomFontKey(state);
    }
    update('fontKey', key);
  });
}

function initMenuBar() {
  const menuItems = document.querySelectorAll('.win-menubar-item');

  menuItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!e.target.closest('.win-dropdown')) {
        ColorPicker.close();
      }
      const isOpen = item.classList.contains('open');
      menuItems.forEach((i) => i.classList.remove('open'));
      if (!isOpen && !e.target.closest('.win-dropdown') && item.querySelector('.win-dropdown')) {
        item.classList.add('open');
      }
    });
  });

  document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.win-menubar-item')) {
      menuItems.forEach((i) => i.classList.remove('open'));
    }
  }, true);

  const wire = (id, fn) => {
    document.querySelector(`#${id}`)?.addEventListener('click', () => {
      menuItems.forEach((i) => i.classList.remove('open'));
      fn();
    });
  };

  const settingsFileInput = document.createElement('input');
  settingsFileInput.type = 'file';
  settingsFileInput.accept = 'application/json,.json';
  settingsFileInput.hidden = true;
  document.body.append(settingsFileInput);
  settingsFileInput.addEventListener('change', () => {
    const file = settingsFileInput.files && settingsFileInput.files[0];
    settingsFileInput.value = '';
    if (file) loadSettingsFile(file);
  });

  wire('menuDownloadSh',  () => download('banner.sh',  currentShellScript(),       'text/x-shellscript'));
  wire('menuDownloadPs1', () => download('banner.ps1', currentPowerShellScript(),   'text/plain'));
  wire('menuDownloadZip', () => downloadZip());
  wire('menuCopySh',      () => copyText(currentShellScript()));
  wire('menuCopyPs1',     () => copyText(currentPowerShellScript()));
  wire('menuCopyAnsi',    () => copyText(currentAnsiText()));
  wire('menuCopyPlain',   () => copyText(currentPlainText()));
  wire('menuDownloadPy',  () => download('banner.py',  currentPythonScript(),      'text/x-python'));
  wire('menuDownloadGo',  () => download('banner.go',  currentGoScript(),          'text/x-go'));
  wire('menuDownloadRs',  () => download('banner.rs',  currentRustScript(),        'text/x-rust'));
  wire('menuDownloadJs',  () => download('banner.js',  currentJavaScriptScript(),  'text/javascript'));
  wire('menuCopyPy',      () => copyText(currentPythonScript()));
  wire('menuCopyGo',      () => copyText(currentGoScript()));
  wire('menuCopyRs',      () => copyText(currentRustScript()));
  wire('menuCopyJs',      () => copyText(currentJavaScriptScript()));
  wire('menuSaveSettings', () => {
    download('termbanner-settings.json', JSON.stringify(serializeSettings(state), null, 2), 'application/json');
  });
  wire('menuLoadSettings', () => settingsFileInput.click());

  document.querySelector('#menuPreviewBg')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    ColorPicker.open(document.querySelector('#optionsMenu'), state.previewBg, (hex) => {
      update('previewBg', hex);
    });
  });

  document.querySelector('#menuPreviewFg')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    ColorPicker.open(document.querySelector('#optionsMenu'), state.previewFg, (hex) => {
      update('previewFg', hex);
    });
  });

  document.querySelector('#menuResetBg')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    update('previewBg', DEFAULTS.previewBg);
  });

  document.querySelector('#menuResetFg')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    update('previewFg', DEFAULTS.previewFg);
  });

  for (const button of document.querySelectorAll('.size-option')) {
    button.addEventListener('click', () => {
      menuItems.forEach((i) => i.classList.remove('open'));
      update('previewSizeId', button.dataset.size);
    });
  }

  document.querySelector('#menuResetDefaults')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    Object.assign(state, {
      solidColor: DEFAULTS.solidColor,
      gradientColors: [...DEFAULTS.gradientColors],
      letterSpacing: DEFAULTS.letterSpacing,
      lineSpacing: DEFAULTS.lineSpacing,
      paddingLeft: DEFAULTS.paddingLeft,
      paddingTop: DEFAULTS.paddingTop,
      paddingBottom: DEFAULTS.paddingBottom,
      plainTextColor: DEFAULTS.plainTextColor,
      plainTextColorMode: 'auto',
    });
    elements.plainTextColor.style.background = state.plainTextColor;
    render();
  });

  document.querySelector('#menuResetAll')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    Object.assign(state, {
      previewBg: DEFAULTS.previewBg,
      previewFg: DEFAULTS.previewFg,
      solidColor: DEFAULTS.solidColor,
      gradientColors: [...DEFAULTS.gradientColors],
      letterSpacing: DEFAULTS.letterSpacing,
      lineSpacing: DEFAULTS.lineSpacing,
      paddingLeft: DEFAULTS.paddingLeft,
      paddingTop: DEFAULTS.paddingTop,
      paddingBottom: DEFAULTS.paddingBottom,
      plainTextColor: DEFAULTS.plainTextColor,
      plainTextColorMode: 'auto',
    });
    elements.plainTextColor.style.background = state.plainTextColor;
    render();
  });

  document.querySelector('#aboutMenu')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    openAboutDialog();
  });

  document.querySelector('#creditsMenu')?.addEventListener('click', () => {
    menuItems.forEach((i) => i.classList.remove('open'));
    openCreditsDialog();
  });
}

function openAboutDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'credits-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'credits-dialog about-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'About');

  const titlebar = document.createElement('div');
  titlebar.className = 'credits-titlebar';
  const icon = document.createElement('span');
  icon.className = 'credits-titlebar-icon';
  icon.textContent = 'TB';
  const title = document.createElement('span');
  title.className = 'credits-titlebar-title';
  title.textContent = 'About TermBanner';
  const btns = document.createElement('div');
  btns.className = 'credits-titlebar-buttons';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'win-titlebar-btn';
  closeBtn.tabIndex = -1;
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', close);
  btns.append(closeBtn);
  titlebar.append(icon, title, btns);

  const body = document.createElement('div');
  body.className = 'credits-body about-body';

  const appName = document.createElement('div');
  appName.className = 'credits-app-name';
  appName.textContent = 'TermBanner';

  const byLine = document.createElement('div');
  byLine.className = 'about-byline';
  byLine.textContent = 'By ';
  const byLink = document.createElement('a');
  byLink.className = 'credits-link';
  byLink.href = 'https://github.com/bradsec';
  byLink.textContent = 'Mark Bradley';
  byLink.target = '_blank';
  byLink.rel = 'noopener noreferrer';
  byLine.append(byLink);

  body.append(appName, byLine);

  const footer = document.createElement('div');
  footer.className = 'credits-footer';
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'action-button credits-ok-btn';
  okBtn.textContent = 'OK';
  okBtn.addEventListener('click', close);
  footer.append(okBtn);

  dialog.append(titlebar, body, footer);
  overlay.append(dialog);
  document.body.append(overlay);

  okBtn.focus();

  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function close() {
    document.removeEventListener('keydown', escHandler);
    overlay.remove();
  }
}

function creditsRule() {
  const hr = document.createElement('hr');
  hr.className = 'credits-rule';
  return hr;
}

function creditsSection(titleText, bodyText, link) {
  const section = document.createElement('section');
  section.className = 'credits-section';

  const h = document.createElement('h3');
  h.className = 'credits-section-title';
  h.textContent = titleText;

  const p = document.createElement('p');
  p.className = 'credits-section-body';
  p.textContent = bodyText;

  section.append(h, p);

  if (link) {
    const pLink = document.createElement('p');
    pLink.className = 'credits-section-link';
    pLink.textContent = link.label;
    if (link.href) {
      pLink.textContent += ' ';
      const a = document.createElement('a');
      a.className = 'credits-link';
      a.href = link.href;
      a.textContent = link.linkText;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      pLink.append(a);
    }
    section.append(pLink);
  }

  return section;
}

function openCreditsDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'credits-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'credits-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-label', 'Credits');

  const titlebar = document.createElement('div');
  titlebar.className = 'credits-titlebar';
  const icon = document.createElement('span');
  icon.className = 'credits-titlebar-icon';
  icon.textContent = 'TB';
  const title = document.createElement('span');
  title.className = 'credits-titlebar-title';
  title.textContent = 'Credits';
  const btns = document.createElement('div');
  btns.className = 'credits-titlebar-buttons';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'win-titlebar-btn';
  closeBtn.tabIndex = -1;
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', close);
  btns.append(closeBtn);
  titlebar.append(icon, title, btns);

  const body = document.createElement('div');
  body.className = 'credits-body';

  const appBlock = document.createElement('div');
  appBlock.className = 'credits-app-block';
  const appName = document.createElement('div');
  appName.className = 'credits-app-name';
  appName.textContent = 'TermBanner';
  const appDesc = document.createElement('div');
  appDesc.className = 'credits-app-desc';
  appDesc.textContent = 'ANSI Banner Generator';
  appBlock.append(appName, appDesc);

  body.append(appBlock, creditsRule(), creditsSection(
    'FIGlet Fonts (.flf)',
    'The FIGlet font collection was created by Glenn Chappell, Ian Chai, and many contributors. FIGlet itself was originally written by Glenn Chappell (1991) and later maintained by Ian Chai, John Cowan, Christiaan Keet, and Claudio Matsuoka. Individual fonts are credited in their file headers.',
    { label: 'Project:', linkText: 'figlet.org', href: 'http://www.figlet.org/' },
  ), creditsRule(), creditsSection(
    'TheDraw TDF Fonts (.tdf)',
    'The TheDraw font format originates from TheDraw (The Drawing Tool), a DOS ANSI art editor created by Ian E. Davis (circa 1988–1993). The bundled fonts were created by artists from the BBS and ANSI art scene and distributed as freeware.',
    { label: 'TheDraw created by: Ian E. Davis' },
  ), creditsRule(), creditsSection(
    'Perfect DOS VGA 437',
    'The terminal preview uses the Perfect DOS VGA 437 typeface by Zeh Fernando, which faithfully recreates the IBM PC VGA BIOS character set for use on modern displays. Distributed as freeware.',
  ));

  const footer = document.createElement('div');
  footer.className = 'credits-footer';
  const okBtn = document.createElement('button');
  okBtn.type = 'button';
  okBtn.className = 'action-button credits-ok-btn';
  okBtn.textContent = 'OK';
  okBtn.addEventListener('click', close);
  footer.append(okBtn);

  dialog.append(titlebar, body, footer);
  overlay.append(dialog);
  document.body.append(overlay);

  okBtn.focus();

  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', escHandler);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  function close() {
    document.removeEventListener('keydown', escHandler);
    overlay.remove();
  }
}

function update(key, value) {
  state[key] = value;
  render();
}

function getSettingsDefaults() {
  return {
    text: DEFAULT_BANNER_TEXT,
    fontKey: 'flf:ANSI_Shadow',
    fontTypeFilter: 'thedraw',
    colorMode: 'gradient',
    solidColor: DEFAULTS.solidColor,
    gradientColors: [...DEFAULTS.gradientColors],
    plainTextColor: DEFAULTS.plainTextColor,
    plainTextColorMode: 'auto',
    terminalMode: 'truecolor',
    letterSpacing: DEFAULTS.letterSpacing,
    lineSpacing: DEFAULTS.lineSpacing,
    paddingLeft: DEFAULTS.paddingLeft,
    paddingTop: DEFAULTS.paddingTop,
    paddingBottom: DEFAULTS.paddingBottom,
    transparentBg: true,
    previewBg: DEFAULTS.previewBg,
    previewFg: DEFAULTS.previewFg,
    previewSizeId: DEFAULTS.previewSizeId,
    tdfPalettes: {},
  };
}

function applySettings(parsed) {
  const { settings, warnings } = parsed;
  const palettes = settings.tdfPalettes;
  delete settings.tdfPalettes;
  Object.assign(state, settings);
  state.tdfPalettes = new Map(Object.entries(palettes));

  const available = new Set(Array.from(elements.fontKey.options).map((o) => o.value));
  if (!available.has(state.fontKey)) {
    state.fontKey = available.has('flf:ANSI_Shadow') ? 'flf:ANSI_Shadow' : randomFontKey(state);
    warnings.push('Saved font was unavailable; using a default.');
  }

  elements.bannerText.value = state.text;
  rebuildFontOptions();
  render();
  setStatus(warnings.length ? 'Settings loaded with adjustments' : 'Settings loaded');
}

function loadSettingsFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let raw;
    try {
      raw = JSON.parse(reader.result);
    } catch {
      setStatus('Not a valid TermBanner settings file', true);
      return;
    }
    const parsed = parseSettings(raw, { defaults: getSettingsDefaults() });
    if (!parsed) {
      setStatus('Not a valid TermBanner settings file', true);
      return;
    }
    applySettings(parsed);
  };
  reader.onerror = () => setStatus('Could not read settings file', true);
  reader.readAsText(file);
}

function rebuildFontOptions() {
  if (!state.plainFonts) return;
  elements.fontKey.innerHTML = buildFontOptionsHtml(state);
  elements.browseFonts.textContent = browseFontsLabel(state);
  const available = new Set(Array.from(elements.fontKey.options).map((o) => o.value));
  if (!available.has(state.fontKey)) {
    state.fontKey = randomFontKey(state);
  }
  render();
}

function gradientPreviewCSS(colors) {
  if (colors.length === 1) return colors[0];
  return `linear-gradient(to right, ${colors.join(', ')})`;
}

function syncPreviewStrips() {
  const solidStrip = document.querySelector('#solidPreviewStrip');
  if (solidStrip) solidStrip.style.background = state.solidColor;

  const gradientStrip = elements.gradientControls.querySelector('.color-preview-strip');
  if (gradientStrip) gradientStrip.style.background = gradientPreviewCSS(state.gradientColors);
}

function buildGradientDOM() {
  const colors = state.gradientColors;
  const count = colors.length;
  gradientStopCount = count;

  const stopLabel = (i) => {
    if (i === 0) return 'Top';
    if (i === count - 1) return 'Bottom';
    return `Stop ${i + 1}`;
  };

  const strip = document.createElement('div');
  strip.className = 'color-preview-strip';
  elements.gradientControls.replaceChildren(strip);

  colors.forEach((color, i) => {
    const label = document.createElement('label');
    label.className = 'swatch-field';
    const span = document.createElement('span');
    span.textContent = stopLabel(i);
    const row = document.createElement('div');
    row.className = 'swatch-row';
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch gradient-stop-swatch';
    swatch.dataset.index = String(i);
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      ColorPicker.open(swatch, state.gradientColors[Number(swatch.dataset.index)], (hex) => {
        swatch.style.background = hex;
        const next = [...state.gradientColors];
        next[Number(swatch.dataset.index)] = hex;
        update('gradientColors', next);
      });
    });
    row.append(swatch);
    if (count > 2) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'remove-stop-btn';
      removeBtn.dataset.index = String(i);
      removeBtn.setAttribute('aria-label', `Remove stop ${i + 1}`);
      removeBtn.textContent = '−';
      removeBtn.addEventListener('click', () => {
        const next = [...state.gradientColors];
        next.splice(Number(removeBtn.dataset.index), 1);
        update('gradientColors', next);
      });
      row.append(removeBtn);
    }
    label.append(span, row);
    elements.gradientControls.append(label);
  });

  syncPreviewStrips();
}

async function render() {
  if (!state.plainFonts) {
    return;
  }

  const token = state.renderToken + 1;
  state.renderToken = token;
  state.rendered = null;

  syncBannerTextPlacement();
  elements.fontKey.value = state.fontKey;
  elements.fontTypeFilter.value = state.fontTypeFilter;
  elements.terminalMode.value = state.terminalMode;
  if (elements.statusMode) elements.statusMode.textContent = state.terminalMode;
  if (elements.dosCommand) {
    const selectedOption = elements.fontKey.options[elements.fontKey.selectedIndex];
    const fontName = selectedOption ? selectedOption.text : '';
    elements.dosCommand.textContent = ` termbanner "${fontName}" < input.txt`;
  }
  elements.solidColor.style.background = state.solidColor;
  elements.letterSpacing.value = String(state.letterSpacing);
  elements.letterSpacingValue.textContent = String(state.letterSpacing);
  elements.lineSpacing.value = String(state.lineSpacing);
  elements.lineSpacingValue.textContent = String(state.lineSpacing);
  elements.paddingLeft.value = String(state.paddingLeft);
  elements.paddingLeftValue.textContent = String(state.paddingLeft);
  elements.paddingTop.value = String(state.paddingTop);
  elements.paddingTopValue.textContent = String(state.paddingTop);
  elements.paddingBottom.value = String(state.paddingBottom);
  elements.paddingBottomValue.textContent = String(state.paddingBottom);
  elements.transparentBg.checked = state.transparentBg;
  syncSizeMenu();
  elements.dosPromptLine.style.background = state.previewBg;
  elements.dosPromptLine.style.setProperty('--dos-prompt-fg', state.previewFg);
  elements.terminalPreview.style.background = state.previewBg;

  const isTdf = isTdfSelection();
  elements.solidColorFieldset.hidden = isTdf;
  elements.gradientColorFieldset.hidden = isTdf;
  elements.tdfPaletteFieldset.hidden = !isTdf;
  elements.plainTextColorFieldset.hidden = !hasPlainText(state.text);
  elements.solidModeRadio.checked = state.colorMode === 'solid';
  elements.gradientModeRadio.checked = state.colorMode === 'gradient';

  if (state.gradientColors.length !== gradientStopCount) {
    buildGradientDOM();
  } else {
    const swatches = elements.gradientControls.querySelectorAll('.gradient-stop-swatch');
    for (const swatch of swatches) {
      swatch.style.background = state.gradientColors[Number(swatch.dataset.index)];
    }
    syncPreviewStrips();
  }
  elements.addStop.hidden = state.gradientColors.length >= MAX_GRADIENT_STOPS;

  renderBanner(token);
}

async function renderBanner(token) {
  try {
    const loadingTdf = isTdfSelection() && !state.loadedTdfFonts.has(tdfKeyFromFontKey(state.fontKey));
    const loadingFlf = isFlfSelection() && !state.loadedFlfFonts.has(flfKeyFromFontKey(state.fontKey));
    if (loadingTdf || loadingFlf) {
      setStatus('Loading font...');
      setExportDisabled(true);
    }

    const selected = await selectedFont();
    if (token !== state.renderToken) {
      return;
    }

    const rendered = renderSelectedFont(selected);
    state.rendered = rendered;
    elements.plainTextColor.style.background = state.plainTextColorMode === 'manual'
      ? state.plainTextColor
      : (rendered.plainColor ?? state.plainTextColor);

    if (rendered.kind === 'plain') {
      drawTerminalPreview(previewLines(rendered.rows, rendered.colors, state.terminalMode));
      elements.ansiOutput.textContent = visibleAnsi(plainAnsiText(rendered));
      setStatus('');
      updateApiVariants();
      setExportDisabled(false);
      return;
    }

    drawCellTerminalPreview(rendered.rows, rendered.palette);
    elements.ansiOutput.textContent = visibleAnsi(tdfAnsiText(rendered));
    renderTdfPaletteControls(rendered.font, rendered.palette, state.terminalMode);
    updateApiVariants();
    setExportDisabled(false);
    setStatus('');
  } catch (error) {
    if (token !== state.renderToken) {
      return;
    }
    elements.terminalPreview.textContent = '';
    elements.ansiOutput.textContent = '';
    elements.apiVariants.replaceChildren();
    state.rendered = null;
    setStatus(error.message, true);
    setExportDisabled(true);
  }
}

async function selectedFont() {
  if (state.fontKey.startsWith('tdf:')) {
    const key = tdfKeyFromFontKey(state.fontKey);
    const font = await loadTdfFont(key);
    return { kind: 'tdf-color', font };
  }

  if (state.fontKey.startsWith('flf:')) {
    const key = flfKeyFromFontKey(state.fontKey);
    const font = await loadFlfFont(key);
    return { kind: 'plain', font };
  }

  const key = plainKeyFromFontKey(state.fontKey);
  const font = state.plainFonts[key];
  if (!font) {
    throw new Error(`unknown font "${key}"`);
  }
  return { kind: 'plain', font };
}

// In-flight font fetches keyed by font key, so concurrent renders of the same
// uncached font share one request instead of fetching it twice.
const inflightFontLoads = new Map();

function dedupeFontLoad(mapKey, load) {
  const pending = inflightFontLoads.get(mapKey);
  if (pending) return pending;
  const promise = load().finally(() => inflightFontLoads.delete(mapKey));
  inflightFontLoads.set(mapKey, promise);
  return promise;
}

function loadTdfFont(key) {
  const cached = state.loadedTdfFonts.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }
  return dedupeFontLoad(`tdf:${key}`, () => fetchTdfFont(key));
}

async function fetchTdfFont(key) {
  const entry = state.tdfIndex.find((candidate) => candidate.key === key);
  if (!entry) {
    throw new Error(`unknown TDF font "${key}"`);
  }

  const response = await fetchFirst(tdfFontPaths(entry));
  if (!response?.ok) {
    throw new Error(`failed to load TDF font "${entry.name ?? key}"`);
  }

  const font = await response.json();
  validateTdfFont(font, key);
  state.loadedTdfFonts.set(key, font);
  if (!state.tdfPalettes.has(key)) {
    state.tdfPalettes.set(key, defaultPaletteForSlots(font.colorSlots ?? []));
  }
  return font;
}

function validateTdfFont(font, key) {
  if (
    font?.kind !== 'tdf-color'
    || font.format !== 'tdf-compact-v1'
    || !font.glyphs
    || typeof font.glyphs !== 'object'
    || Array.isArray(font.glyphs)
  ) {
    throw new Error(`invalid TDF font "${key}"`);
  }
}

function tdfFontPaths(entry) {
  const path = entry.path;
  return [path, `./public/${path.replace(/^\.\//, '')}`];
}

async function loadFlfIndex() {
  return loadFontIndex(
    ['./fonts/flf/index.json', './public/fonts/flf/index.json'],
    (entry) => entry?.kind === 'flf-plain' && typeof entry.key === 'string' && typeof entry.path === 'string',
  );
}

function loadFlfFont(key) {
  const cached = state.loadedFlfFonts.get(key);
  if (cached) return Promise.resolve(cached);
  return dedupeFontLoad(`flf:${key}`, () => fetchFlfFont(key));
}

async function fetchFlfFont(key) {
  const entry = state.flfIndex.find((e) => e.key === key);
  if (!entry) throw new Error(`unknown FLF font "${key}"`);

  const response = await fetchFirst(flfFontPaths(entry));
  if (!response?.ok) throw new Error(`failed to load FLF font "${entry.name ?? key}"`);

  const font = await response.json();
  if (font?.kind !== 'flf-plain' || font.format !== 'flf-v1') {
    throw new Error(`invalid FLF font "${key}"`);
  }
  state.loadedFlfFonts.set(key, font);
  return font;
}

function flfFontPaths(entry) {
  const path = entry.path;
  return [path, `./public/${path.replace(/^\.\//, '')}`];
}

function renderSelectedFont(selected) {
  return composeBanner({
    font: selected.font,
    text: state.text.trim(),
    colorMode: state.colorMode,
    solidColor: state.solidColor,
    gradientColors: state.gradientColors,
    // Pass the app's full per-font palette so user palette edits are preserved
    // (banner.js uses it directly instead of rebuilding the default palette).
    palette: selected.font.kind === 'tdf-color'
      ? state.tdfPalettes.get(selected.font.key)
      : undefined,
    letterSpacing: state.letterSpacing,
    lineSpacing: state.lineSpacing,
    paddingLeft: state.paddingLeft,
    paddingTop: state.paddingTop,
    paddingBottom: state.paddingBottom,
    plainTextColor: state.plainTextColorMode === 'manual' ? state.plainTextColor : undefined,
  });
}

function currentColors(rowCount) {
  return bannerColors(state.colorMode, state.solidColor, state.gradientColors, rowCount);
}

function currentAnsiText() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') {
    return tdfAnsiText(rendered);
  }
  return plainAnsiText(rendered);
}

function visibleAnsi(text) {
  return text.replaceAll('\x1b', '\\x1b');
}

function curlState() {
  const isTdf = state.fontKey.startsWith('tdf:');
  return {
    text: state.text,
    fontKey: state.fontKey,
    colorMode: state.colorMode,
    solidColor: state.solidColor,
    gradientColors: state.gradientColors,
    terminalMode: state.terminalMode,
    letterSpacing: state.letterSpacing,
    lineSpacing: state.lineSpacing,
    paddingLeft: state.paddingLeft,
    paddingTop: state.paddingTop,
    paddingBottom: state.paddingBottom,
    colorSlots: isTdf ? (state.rendered?.font?.colorSlots ?? []) : [],
    palette: isTdf ? state.rendered?.palette : undefined,
    plainTextColor: state.plainTextColor,
    plainTextColorMode: state.plainTextColorMode,
  };
}

async function copyCurlLine(curl, codeEl) {
  try {
    await navigator.clipboard.writeText(curl);
    flashStatus('Copied');
    if (codeEl) {
      codeEl.classList.add('api-curl-copied');
      setTimeout(() => codeEl.classList.remove('api-curl-copied'), 600);
    }
  } catch {
    setStatus('Copy failed', true);
  }
}

function updateApiVariants() {
  const container = elements.apiVariants;
  if (!state.rendered) {
    container.replaceChildren();
    return;
  }
  const variants = buildApiVariants(curlState(), window.location.origin);
  const frag = document.createDocumentFragment();
  for (const variant of variants) {
    const row = document.createElement('div');
    row.className = 'api-row';

    const label = document.createElement('span');
    label.className = 'api-label';
    label.textContent = `:: ${variant.label}`;

    const code = document.createElement('code');
    code.className = 'api-curl';
    code.textContent = variant.curl;
    code.title = 'Click to copy';
    code.setAttribute('role', 'button');
    code.setAttribute('tabindex', '0');
    code.addEventListener('click', () => copyCurlLine(variant.curl, code));
    code.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        copyCurlLine(variant.curl, code);
      }
    });

    row.append(label, code);
    frag.append(row);
  }
  container.replaceChildren(frag);
}

function currentPlainText() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') {
    return cellRowsToPlainText(rendered.rows);
  }
  return plainText(rendered.rows);
}

function currentShellScript() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') {
    return generateShellScript({
      plainLines: cellRowsToPlainText(rendered.rows).split('\n'),
      truecolorLines: ansiCellLines(rendered.rows, rendered.palette, 'truecolor', { transparentBg: state.transparentBg }),
      color256Lines: ansiCellLines(rendered.rows, rendered.palette, '256', { transparentBg: state.transparentBg }),
      color16Lines: ansiCellLines(rendered.rows, rendered.palette, '16', { transparentBg: state.transparentBg }),
    });
  }
  return generateShellScript(rendered.rows, rendered.colors);
}

function currentPowerShellScript() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') {
    return generatePowerShellScript({
      plainLines: cellRowsToPlainText(rendered.rows).split('\n'),
      truecolorLines: ansiCellLines(rendered.rows, rendered.palette, 'truecolor', { transparentBg: state.transparentBg }),
      color256Lines: ansiCellLines(rendered.rows, rendered.palette, '256', { transparentBg: state.transparentBg }),
      color16Lines: ansiCellLines(rendered.rows, rendered.palette, '16', { transparentBg: state.transparentBg }),
    });
  }
  return generatePowerShellScript(rendered.rows, rendered.colors);
}

function tdfVariants(rendered) {
  return {
    plainLines: cellRowsToPlainText(rendered.rows).split('\n'),
    truecolorLines: ansiCellLines(rendered.rows, rendered.palette, 'truecolor', { transparentBg: state.transparentBg }),
    color256Lines: ansiCellLines(rendered.rows, rendered.palette, '256', { transparentBg: state.transparentBg }),
    color16Lines: ansiCellLines(rendered.rows, rendered.palette, '16', { transparentBg: state.transparentBg }),
  };
}

function currentPythonScript() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') return generatePythonScript(tdfVariants(rendered));
  return generatePythonScript(rendered.rows, rendered.colors);
}

function currentGoScript() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') return generateGoScript(tdfVariants(rendered));
  return generateGoScript(rendered.rows, rendered.colors);
}

function currentRustScript() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') return generateRustScript(tdfVariants(rendered));
  return generateRustScript(rendered.rows, rendered.colors);
}

function currentJavaScriptScript() {
  const rendered = currentRendered();
  if (rendered.kind === 'tdf-color') return generateJavaScriptScript(tdfVariants(rendered));
  return generateJavaScriptScript(rendered.rows, rendered.colors);
}

function currentRendered() {
  if (!state.rendered) {
    throw new Error('Render is not ready');
  }
  return state.rendered;
}

function plainAnsiText(rendered) {
  return bannerToAnsi(rendered, state.terminalMode);
}

function tdfAnsiText(rendered) {
  return bannerToAnsi(rendered, state.terminalMode, { transparentBg: state.transparentBg });
}

async function downloadZip() {
  try {
    const blob = await createScriptZip({
      shell: currentShellScript(),
      powershell: currentPowerShellScript(),
      python: currentPythonScript(),
      go: currentGoScript(),
      rust: currentRustScript(),
      javascript: currentJavaScriptScript(),
    });
    downloadBlob('termbanner-scripts.zip', blob);
    setStatus('Downloaded ZIP archive');
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    flashStatus('Copied');
  } catch (error) {
    setStatus(error.message, true);
  }
}

function download(filename, content, type) {
  try {
    downloadBlob(filename, new Blob([content], { type }));
    setStatus(`Downloaded ${filename}`);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}


function setExportDisabled(disabled) {
  setScriptExportDisabled(disabled);
  setCopyExportDisabled(disabled);
}

function setScriptExportDisabled(disabled) {
  for (const button of [
    elements.downloadSh,
    elements.downloadPs1,
    elements.downloadZip,
    elements.copySh,
    elements.copyPs1,
    elements.downloadPy,
    elements.downloadGo,
    elements.downloadRs,
    elements.downloadJs,
    elements.copyPy,
    elements.copyGo,
    elements.copyRs,
    elements.copyJs,
  ]) {
    setButtonDisabled(button, disabled);
  }
}

function setCopyExportDisabled(disabled) {
  for (const button of [
    elements.copyAnsi,
    elements.copyPlain,
  ]) {
    setButtonDisabled(button, disabled);
  }
}

function setButtonDisabled(button, disabled) {
  button.disabled = disabled;
}

let statusFlashTimer;

function setStatus(message, isError = false) {
  clearTimeout(statusFlashTimer);
  elements.status.textContent = message;
  // Keep win-status-panel so the panel stays aligned with the other status cells.
  elements.status.className = `win-status-panel status-line${isError ? ' error' : ''}`;
}

// Transient success flash (e.g. "Copied"): coloured, bold, blinks a couple of
// times, then reverts to the idle status.
// Show a transient message (e.g. "Copied") that reverts to the idle status.
function flashStatus(message) {
  clearTimeout(statusFlashTimer);
  setStatus(message);
  statusFlashTimer = setTimeout(() => setStatus('Ready'), 1400);
}

function drawTerminalPreview(lines) {
  const fontSize = terminalFontSize();
  const lineHeight = Math.ceil(fontSize * 1.2);
  const font = `${fontSize}px "DejaVu Sans Mono", "Noto Sans Mono", "Cascadia Mono", Consolas, monospace`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;

  // Let the browser measure actual rendered widths — handles Unicode box chars correctly
  const width = Math.ceil(Math.max(1, ...lines.map((l) => measure.measureText(l.text).width)));
  const height = Math.ceil(Math.max(1, lines.length) * lineHeight);
  const ratio = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.font = font;
  ctx.textBaseline = 'top';

  lines.forEach((line, rowIndex) => {
    ctx.fillStyle = line.color;
    ctx.fillText(line.text, 0, rowIndex * lineHeight);
  });

  const cellWidth = Math.ceil(measure.measureText('M').width);
  applyTerminalWindowSize(cellWidth, terminalRowHeight(fontSize));
  elements.terminalPreview.replaceChildren(canvas);
  setPreviewDims();
}

function drawCellTerminalPreview(rows, palette) {
  const fontSize = terminalFontSize();
  const lineHeight = Math.ceil(fontSize * 1.06);
  const font = `${fontSize}px "DejaVu Sans Mono", "Noto Sans Mono", "Cascadia Mono", Consolas, monospace`;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = font;
  const cellWidth = Math.ceil(measure.measureText('M').width);
  const columns = Math.max(1, ...rows.map((row) => row.length));
  const rowCount = Math.max(1, rows.length);
  const ratio = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  const width = columns * cellWidth;
  const height = rowCount * lineHeight;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(ratio, ratio);
  ctx.font = font;
  ctx.textBaseline = 'top';

  const plain = state.terminalMode === 'plain';

  rows.forEach((row, rowIndex) => {
    row.forEach((cell, column) => {
      const raw = palette[cell.color] ?? palette['0x00'];
      const fg = plain ? { r: 192, g: 192, b: 192 } : quantizeColor(raw.fg, state.terminalMode);
      const bg = plain ? { r: 0, g: 0, b: 0 } : quantizeColor(raw.bg, state.terminalMode);
      const x = column * cellWidth;
      const y = rowIndex * lineHeight;
      const isBlackBg = bg.r === 0 && bg.g === 0 && bg.b === 0;
      ctx.fillStyle = (state.transparentBg && isBlackBg) ? state.previewBg : rgbCss(bg);
      ctx.fillRect(x, y, cellWidth, lineHeight);
      if (cell.ch !== ' ') {
        ctx.fillStyle = rgbCss(fg);
        ctx.fillText(cell.ch, x, y);
      }
    });
  });

  applyTerminalWindowSize(cellWidth, terminalRowHeight(fontSize));
  elements.terminalPreview.replaceChildren(canvas);
  setPreviewDims();
}

// Row height used to size the preview window box. Kept independent of the
// per-path drawing line height (figlet 1.2, TDF cells 1.06) so the window does
// not change height when switching font types at the same column/row count.
function terminalRowHeight(fontSize) {
  return Math.ceil(fontSize * 1.2);
}

function terminalFontSize() {
  // One constant cell size for every window mode so the banner does not rescale
  // when the window size changes; only the window box changes size.
  return presetFontSize(PREVIEW_REFERENCE_COLS);
}

// Largest font (capped at PRESET_FONT_SIZE) at which `cols` columns still fit
// the available preview width, so a wide terminal scales down instead of
// overflowing. Subtracting `cols` allows for per-cell rounding in the draw step.
function presetFontSize(cols) {
  const m = document.createElement('canvas').getContext('2d');
  m.font = `100px "DejaVu Sans Mono", "Noto Sans Mono", "Cascadia Mono", Consolas, monospace`;
  const advancePerPx = m.measureText('M').width / 100;
  const avail = availablePreviewWidth() - 16; // .terminal-preview padding
  const maxByWidth = Math.floor((avail - cols) / (cols * advancePerPx));
  return Math.max(6, Math.min(PRESET_FONT_SIZE, maxByWidth));
}

function availablePreviewWidth() {
  const column = elements.terminalPanel && elements.terminalPanel.parentElement;
  if (!column) return 900;
  return column.clientWidth - 16; // .preview-column horizontal padding
}

function currentPreviewSize() {
  return PREVIEW_SIZES.find((s) => s.id === state.previewSizeId) || PREVIEW_SIZES[0];
}

// Below the responsive breakpoint the control panel stacks and the preview
// column is too narrow for a fixed terminal grid, which clips a border. Force
// fit-to-window there while keeping the user's menu choice for wide screens.
function isSmallScreen() {
  return window.matchMedia('(max-width: 900px)').matches;
}

function effectivePreviewSize() {
  return isSmallScreen() ? PREVIEW_SIZES[0] : currentPreviewSize();
}

// On small screens the preview stacks above the control panel, burying the
// text box below a tall banner. Relocate the Banner Text fieldset to the top
// of the workspace there so people can edit text and see the result without
// scrolling past the preview; restore it to the control panel on wide screens.
function syncBannerTextPlacement() {
  const fieldset = elements.bannerTextFieldset;
  const { winWorkspace, controlPanel } = elements;
  if (!fieldset || !winWorkspace || !controlPanel) return;

  if (isSmallScreen()) {
    if (fieldset.parentElement !== winWorkspace) {
      winWorkspace.prepend(fieldset);
    }
  } else if (fieldset.parentElement !== controlPanel || controlPanel.firstElementChild !== fieldset) {
    controlPanel.prepend(fieldset);
  }
}

// Size the preview viewport to the selected terminal window (cols x rows) using
// the same cell metrics the banner is drawn with, so the user sees how the
// banner fits a real terminal. 'fit' restores the auto, width-filling layout.
function applyTerminalWindowSize(cellWidth, lineHeight) {
  const size = effectivePreviewSize();
  const preview = elements.terminalPreview;
  const panel = elements.terminalPanel;
  if (size.cols) {
    const pad = 16; // .terminal-preview has 8px padding on each side
    preview.style.flex = 'none';
    preview.style.width = `${size.cols * cellWidth + pad}px`;
    preview.style.height = `${size.rows * lineHeight + pad}px`;
    if (panel) panel.classList.add('sized');
  } else {
    preview.style.flex = '';
    preview.style.width = '';
    preview.style.height = '';
    if (panel) panel.classList.remove('sized');
  }
}

// Bottom-left status panel: show the selected preview window size. Fit to
// window has no fixed terminal size, so it is left blank.
function setPreviewDims() {
  if (!elements.statusDims) return;
  const size = effectivePreviewSize();
  elements.statusDims.textContent = size.cols ? `${size.cols} x ${size.rows}` : '';
}

function syncSizeMenu() {
  for (const button of document.querySelectorAll('.size-option')) {
    button.classList.toggle('checked', button.dataset.size === state.previewSizeId);
  }
}

function rgbCss(color) {
  return `rgb(${color.r} ${color.g} ${color.b})`;
}

function plainKeyFromFontKey(key) {
  return key.startsWith('plain:') ? key.slice('plain:'.length) : key;
}

function tdfKeyFromFontKey(key) {
  return key.slice('tdf:'.length);
}

function isTdfSelection() {
  return state.fontKey.startsWith('tdf:');
}

function flfKeyFromFontKey(key) {
  return key.slice('flf:'.length);
}

function isFlfSelection() {
  return state.fontKey.startsWith('flf:');
}

function renderTdfPaletteControls(font, palette, mode) {
  const container = elements.tdfPaletteControls;
  const quantized = mode === '16' || mode === '256';
  container.replaceChildren();
  for (const slot of (font.colorSlots ?? [])) {
    const value = palette[slot];
    if (!value) continue;

    const label = document.createElement('div');
    label.className = 'palette-slot';

    const slotId = document.createElement('span');
    slotId.className = 'palette-slot-id';
    slotId.textContent = slot;

    const fgSwatch = makePaletteSwatch(slot, 'fg', value, quantized, mode);
    const bgSwatch = makePaletteSwatch(slot, 'bg', value, quantized, mode);

    label.append(slotId, fgSwatch, bgSwatch);
    container.append(label);
  }
}

function makePaletteSwatch(slot, channel, value, quantized, mode) {
  const raw = value[channel];
  const displayColor = quantized ? quantizeColor(raw, mode) : raw;
  const swatch = document.createElement('button');
  swatch.type = 'button';
  swatch.className = 'color-swatch';
  swatch.style.background = rgbCss(displayColor);
  swatch.title = quantized
    ? `${channel === 'fg' ? 'Foreground' : 'Background'}: ${toHex(raw)} → ${toHex(displayColor)} (${mode})`
    : (channel === 'fg' ? 'Foreground' : 'Background');
  swatch.addEventListener('click', () => {
    ColorPicker.open(swatch, toHex(raw), (hex) => {
      if (!isTdfSelection()) return;
      const key = tdfKeyFromFontKey(state.fontKey);
      const pal = state.tdfPalettes.get(key);
      if (!pal?.[slot]) return;
      pal[slot][channel] = parseHex(hex);
      render();
    });
  });
  return swatch;
}
