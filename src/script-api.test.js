import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFonts } from './font.js';
import { renderBanner } from './banner.js';
import { isScriptFormat, scriptFilename, generateScript } from './script-api.js';

const ANSI = validateFonts({
  demo: { name: 'Demo', height: 2, glyphs: { A: ['#', '#'], B: ['*', '*'] } },
}).demo;

function plainResult() {
  return renderBanner({
    font: ANSI, text: 'A', colorMode: 'solid', solidColor: '#ff0000',
    paddingLeft: 0, paddingTop: 0, paddingBottom: 0,
  });
}

test('isScriptFormat recognizes names and aliases', () => {
  assert.ok(isScriptFormat('bash'));
  assert.ok(isScriptFormat('sh'));
  assert.ok(isScriptFormat('powershell'));
  assert.ok(isScriptFormat('ps1'));
  assert.ok(isScriptFormat('python'));
  assert.ok(isScriptFormat('py'));
  assert.ok(isScriptFormat('go'));
  assert.ok(isScriptFormat('rust'));
  assert.ok(isScriptFormat('js'));
  assert.ok(!isScriptFormat('cobol'));
  assert.ok(!isScriptFormat('ansi'));
});

test('scriptFilename maps format to an extension', () => {
  assert.equal(scriptFilename('bash'), 'termbanner.sh');
  assert.equal(scriptFilename('powershell'), 'termbanner.ps1');
  assert.equal(scriptFilename('python'), 'termbanner.py');
  assert.equal(scriptFilename('go'), 'termbanner.go');
  assert.equal(scriptFilename('rust'), 'termbanner.rs');
  assert.equal(scriptFilename('javascript'), 'termbanner.js');
});

test('generateScript(bash) emits a runnable shell script for plain fonts', () => {
  const out = generateScript('bash', plainResult());
  assert.ok(out.startsWith('#!/bin/sh'));
  assert.ok(out.includes('print_truecolor_banner'));
});

test('generateScript(python) emits a python script', () => {
  const out = generateScript('py', plainResult());
  assert.ok(out.includes('def ') || out.includes('print('));
});

test('generateScript supports TheDraw results', () => {
  const tdf = {
    kind: 'tdf-color', key: 't', height: 1, spacing: 0,
    colorSlots: ['0x01'],
    glyphs: { A: { chars: ['A'], colors: ['01'] } },
  };
  const result = renderBanner({ font: tdf, text: 'A', paddingLeft: 0, paddingTop: 0, paddingBottom: 0 });
  const out = generateScript('bash', result);
  assert.ok(out.startsWith('#!/bin/sh'));
});

test('generateScript throws on unknown format', () => {
  assert.throws(() => generateScript('cobol', plainResult()), /format/);
});
