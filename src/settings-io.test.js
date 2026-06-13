import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeSettings, parseSettings } from './settings-io.js';
import { MAX_GRADIENT_STOPS } from './random-color.js';

const sampleState = () => ({
  text: 'HELLO',
  fontKey: 'tdf:Acid',
  fontTypeFilter: 'thedraw',
  colorMode: 'gradient',
  solidColor: '#33ff00',
  gradientColors: ['#33ff00', '#0066ff'],
  plainTextColor: '#ffffff',
  plainTextColorMode: 'auto',
  terminalMode: 'truecolor',
  letterSpacing: 0,
  lineSpacing: 1,
  paddingLeft: 1,
  paddingTop: 1,
  paddingBottom: 1,
  transparentBg: true,
  previewBg: '#080a0b',
  previewFg: '#AAAAAA',
  previewSizeId: '120x30',
  tdfPalettes: new Map([
    ['tdf:Acid', { '0x07': { fg: { r: 192, g: 192, b: 192 }, bg: { r: 0, g: 0, b: 0 } } }],
  ]),
  rendered: {}, renderToken: 5, loadedTdfFonts: new Map(),
});

test('serializeSettings emits app/version and only known fields', () => {
  const out = serializeSettings(sampleState());
  assert.equal(out.app, 'termbanner');
  assert.equal(out.version, 1);
  assert.equal(out.settings.text, 'HELLO');
  assert.equal(out.settings.fontKey, 'tdf:Acid');
  assert.deepEqual(out.settings.gradientColors, ['#33ff00', '#0066ff']);
  assert.deepEqual(out.settings.tdfPalettes, {
    'tdf:Acid': { '0x07': { fg: { r: 192, g: 192, b: 192 }, bg: { r: 0, g: 0, b: 0 } } },
  });
  assert.equal('rendered' in out.settings, false);
  assert.equal('renderToken' in out.settings, false);
  assert.equal('tdfPalettes' in out.settings && out.settings.tdfPalettes instanceof Map, false);
});

test('serializeSettings copies arrays, does not alias state', () => {
  const s = sampleState();
  const out = serializeSettings(s);
  out.settings.gradientColors.push('#000000');
  assert.equal(s.gradientColors.length, 2);
});

const DEFAULTS = {
  text: 'DEFAULT',
  fontKey: 'flf:ANSI_Shadow',
  fontTypeFilter: 'thedraw',
  colorMode: 'gradient',
  solidColor: '#33ff00',
  gradientColors: ['#33ff00', '#0066ff'],
  plainTextColor: '#ffffff',
  plainTextColorMode: 'auto',
  terminalMode: 'truecolor',
  letterSpacing: 0,
  lineSpacing: 1,
  paddingLeft: 1,
  paddingTop: 1,
  paddingBottom: 1,
  transparentBg: true,
  previewBg: '#080a0b',
  previewFg: '#AAAAAA',
  previewSizeId: '120x30',
  tdfPalettes: {},
};

test('parseSettings rejects non-object and wrong app', () => {
  assert.equal(parseSettings(null, { defaults: DEFAULTS }), null);
  assert.equal(parseSettings('x', { defaults: DEFAULTS }), null);
  assert.equal(parseSettings({ app: 'other', version: 1, settings: {} }, { defaults: DEFAULTS }), null);
});

test('parseSettings round-trips a valid file', () => {
  const file = serializeSettings({
    ...DEFAULTS,
    text: 'HELLO',
    fontKey: 'tdf:Acid',
    gradientColors: ['#112233', '#445566'],
    tdfPalettes: new Map([['tdf:Acid', { '0x07': { fg: { r: 1, g: 2, b: 3 }, bg: { r: 4, g: 5, b: 6 } } }]]),
  });
  const { settings, warnings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.text, 'HELLO');
  assert.equal(settings.fontKey, 'tdf:Acid');
  assert.deepEqual(settings.gradientColors, ['#112233', '#445566']);
  assert.deepEqual(settings.tdfPalettes['tdf:Acid']['0x07'].fg, { r: 1, g: 2, b: 3 });
  assert.equal(warnings.length, 0);
});

test('parseSettings rejects control-char text, falls back', () => {
  const file = { app: 'termbanner', version: 1, settings: { text: 'bad\x01here' } };
  const { settings, warnings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.text, 'DEFAULT');
  assert.ok(warnings.length >= 1);
});

test('parseSettings accepts multi-line banner text (tab and newline allowed)', () => {
  const file = { app: 'termbanner', version: 1, settings: { text: 'LINE ONE\nLINE\tTWO' } };
  const { settings, warnings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.text, 'LINE ONE\nLINE\tTWO');
  assert.equal(warnings.length, 0);
});

test('parseSettings truncates over-long text', () => {
  const file = { app: 'termbanner', version: 1, settings: { text: 'a'.repeat(5000) } };
  const { settings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.text.length, 1000);
});

test('parseSettings clamps spacing/padding to [-8,8]', () => {
  const file = { app: 'termbanner', version: 1, settings: { letterSpacing: 99, paddingTop: -99, lineSpacing: 3.7 } };
  const { settings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.letterSpacing, 8);
  assert.equal(settings.paddingTop, -8);
  assert.equal(settings.lineSpacing, 3);
});

test('parseSettings rejects bad hex and bad enums', () => {
  const file = { app: 'termbanner', version: 1, settings: { solidColor: 'red', terminalMode: 'cga' } };
  const { settings, warnings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.solidColor, '#33ff00');
  assert.equal(settings.terminalMode, 'truecolor');
  assert.ok(warnings.length >= 2);
});

test('parseSettings falls back when gradient has fewer than 2 valid stops', () => {
  const file = { app: 'termbanner', version: 1, settings: { gradientColors: ['#111111', 'nope'] } };
  const { settings } = parseSettings(file, { defaults: DEFAULTS });
  assert.deepEqual(settings.gradientColors, ['#33ff00', '#0066ff']);
});

test('parseSettings drops malformed tdf palette entries', () => {
  const file = { app: 'termbanner', version: 1, settings: { tdfPalettes: {
    'tdf:Good': { '0x07': { fg: { r: 1, g: 2, b: 3 }, bg: { r: 4, g: 5, b: 6 } } },
    'tdf:Bad': { 'zz': { fg: { r: 1, g: 2, b: 3 }, bg: { r: 4, g: 5, b: 6 } } },
    'tdf:OutOfRange': { '0x01': { fg: { r: 999, g: 2, b: 3 }, bg: { r: 4, g: 5, b: 6 } } },
  } } };
  const { settings } = parseSettings(file, { defaults: DEFAULTS });
  assert.deepEqual(Object.keys(settings.tdfPalettes), ['tdf:Good']);
});

test('parseSettings coerces transparentBg to boolean', () => {
  const file = { app: 'termbanner', version: 1, settings: { transparentBg: 0 } };
  const { settings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.transparentBg, false);
});

test('parseSettings uses defaults for missing keys without warning', () => {
  const file = { app: 'termbanner', version: 1, settings: { text: 'HI' } };
  const { settings, warnings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.fontKey, 'flf:ANSI_Shadow');
  assert.equal(warnings.length, 0);
});

test('gradient stop cap matches random-color constant', () => {
  const file = { app: 'termbanner', version: 1, settings: {
    gradientColors: Array.from({ length: MAX_GRADIENT_STOPS + 3 }, () => '#112233'),
  } };
  const { settings } = parseSettings(file, { defaults: DEFAULTS });
  assert.equal(settings.gradientColors.length, MAX_GRADIENT_STOPS);
});
