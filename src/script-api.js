import { generateShellScript, generatePowerShellScript } from './script-export.js';
import {
  generatePythonScript,
  generateGoScript,
  generateRustScript,
  generateJavaScriptScript,
} from './lang-export.js';
import { ansiCellLines, cellRowsToPlainText } from './cell-render.js';

// Each format maps to a generator and a file extension. Aliases share targets.
const FORMATS = {
  bash: { generate: generateShellScript, ext: 'sh' },
  sh: { generate: generateShellScript, ext: 'sh' },
  powershell: { generate: generatePowerShellScript, ext: 'ps1' },
  ps1: { generate: generatePowerShellScript, ext: 'ps1' },
  python: { generate: generatePythonScript, ext: 'py' },
  py: { generate: generatePythonScript, ext: 'py' },
  go: { generate: generateGoScript, ext: 'go' },
  rust: { generate: generateRustScript, ext: 'rs' },
  rs: { generate: generateRustScript, ext: 'rs' },
  javascript: { generate: generateJavaScriptScript, ext: 'js' },
  js: { generate: generateJavaScriptScript, ext: 'js' },
};

export function isScriptFormat(format) {
  return Object.prototype.hasOwnProperty.call(FORMATS, format);
}

export function scriptFilename(format) {
  const entry = FORMATS[format];
  if (!entry) throw new Error(`unknown format "${format}"`);
  return `termbanner.${entry.ext}`;
}

// Build a self-contained script from a renderBanner result. The generators
// embed all color depths (truecolor/256/16/plain) with runtime detection, so
// `depth`/`mode` do not affect script output.
export function generateScript(format, result, options = {}) {
  const entry = FORMATS[format];
  if (!entry) throw new Error(`unknown format "${format}"`);
  const transparentBg = options.transparentBg ?? true;

  if (result.kind === 'tdf-color') {
    return entry.generate({
      plainLines: cellRowsToPlainText(result.rows).split('\n'),
      truecolorLines: ansiCellLines(result.rows, result.palette, 'truecolor', { transparentBg }),
      color256Lines: ansiCellLines(result.rows, result.palette, '256', { transparentBg }),
      color16Lines: ansiCellLines(result.rows, result.palette, '16', { transparentBg }),
    });
  }

  return entry.generate(result.rows, result.colors);
}
