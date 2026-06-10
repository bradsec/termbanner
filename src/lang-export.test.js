import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatePythonScript,
  generateGoScript,
  generateRustScript,
  generateJavaScriptScript,
} from './lang-export.js';

const rows = ['AAA', 'B"B'];
const colors = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }];

test('generatePythonScript includes all color functions and detection', () => {
  const script = generatePythonScript(rows, colors);

  assert.match(script, /def print_truecolor_banner/);
  assert.match(script, /def print_256_banner/);
  assert.match(script, /def print_16_banner/);
  assert.match(script, /def print_plain_banner/);
  assert.match(script, /'NO_COLOR' in os\.environ/);
  assert.match(script, /if __name__ == '__main__'/);
});

test('generateGoScript includes all color functions and detection', () => {
  const script = generateGoScript(rows, colors);

  assert.match(script, /func printTruecolorBanner/);
  assert.match(script, /func print256Banner/);
  assert.match(script, /func print16Banner/);
  assert.match(script, /func printPlainBanner/);
  assert.match(script, /os\.LookupEnv\("NO_COLOR"\)/);
  assert.match(script, /strings\.Contains/);
  assert.match(script, /package main/);
});

test('generateRustScript includes all color functions and detection', () => {
  const script = generateRustScript(rows, colors);

  assert.match(script, /fn print_truecolor_banner/);
  assert.match(script, /fn print_256_banner/);
  assert.match(script, /fn print_16_banner/);
  assert.match(script, /fn print_plain_banner/);
  assert.match(script, /env::var_os\("NO_COLOR"\)\.is_some\(\)/);
  assert.match(script, /use std::env/);
});

test('generateJavaScriptScript includes all color functions and detection', () => {
  const script = generateJavaScriptScript(rows, colors);

  assert.match(script, /function printTruecolorBanner/);
  assert.match(script, /function print256Banner/);
  assert.match(script, /function print16Banner/);
  assert.match(script, /function printPlainBanner/);
  assert.match(script, /'NO_COLOR' in process\.env/);
  assert.match(script, /\/usr\/bin\/env node/);
});

test('double quotes in banner text are escaped in all languages', () => {
  const quoted = ['say "hello"'];
  const c = [{ r: 255, g: 255, b: 255 }];

  assert.match(generatePythonScript(quoted, c),     /say \\"hello\\"/);
  assert.match(generateGoScript(quoted, c),         /say \\"hello\\"/);
  assert.match(generateRustScript(quoted, c),       /say \\"hello\\"/);
  assert.match(generateJavaScriptScript(quoted, c), /say \\"hello\\"/);
});

test('ESC bytes in ANSI lines are rendered as \\x1b in all languages', () => {
  const variants = {
    plainLines: ['AAA'],
    truecolorLines: ['\x1b[38;2;255;0;0mAAA\x1b[0m'],
    color256Lines:  ['\x1b[38;5;196mAAA\x1b[0m'],
    color16Lines:   ['\x1b[31mAAA\x1b[0m'],
  };

  for (const gen of [generatePythonScript, generateGoScript, generateRustScript, generateJavaScriptScript]) {
    const script = gen(variants);
    assert.match(script, /\\x1b\[38;2;255;0;0m/, `${gen.name} should contain \\x1b truecolor escape`);
    assert.doesNotMatch(script, /\x1b/, `${gen.name} should not contain raw ESC bytes`);
  }
});

test('all generators accept explicit variant objects', () => {
  const variants = {
    plainLines: ['PLAIN'],
    truecolorLines: ['TC'],
    color256Lines: ['256'],
    color16Lines: ['16'],
  };

  assert.match(generatePythonScript(variants),     /PLAIN/);
  assert.match(generateGoScript(variants),         /PLAIN/);
  assert.match(generateRustScript(variants),       /PLAIN/);
  assert.match(generateJavaScriptScript(variants), /PLAIN/);
});
