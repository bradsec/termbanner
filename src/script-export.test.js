import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePowerShellScript, generateShellScript } from './script-export.js';

const rows = ['AAA', "B'B"];
const colors = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }];

test('generateShellScript includes all color functions and detection', () => {
  const script = generateShellScript(rows, colors);

  assert.match(script, /print_truecolor_banner/);
  assert.match(script, /print_256_banner/);
  assert.match(script, /print_16_banner/);
  assert.match(script, /print_plain_banner/);
  assert.match(script, /color_count="\$\(tput colors 2>\/dev\/null \|\| echo 0\)"/);
  assert.match(script, /\$\{NO_COLOR\+x\}/);
  assert.match(script, /B'\\''B/);
});

test('generatePowerShellScript includes all color functions and detection', () => {
  const script = generatePowerShellScript(rows, colors);

  assert.match(script, /function Print-TruecolorBanner/);
  assert.match(script, /function Print-256Banner/);
  assert.match(script, /function Print-16Banner/);
  assert.match(script, /function Print-PlainBanner/);
  assert.match(script, /\$env:WT_SESSION/);
  assert.match(script, /Write-Host/);
  assert.match(script, /GetEnvironmentVariable\('NO_COLOR'\)/);
  assert.match(script, /SetConsoleMode/);
  assert.match(script, /B''B/);
});

test('generateShellScript accepts explicit ansi variants', () => {
  const script = generateShellScript({
    plainLines: ['A'],
    truecolorLines: ['\x1b[38;2;255;255;255mA\x1b[0m'],
    color256Lines: ['\x1b[38;5;15mA\x1b[0m'],
    color16Lines: ['\x1b[97mA\x1b[0m'],
  });

  assert.match(script, /print_truecolor_banner/);
  assert.match(script, /\\033\[38;2;255;255;255mA/);
});
