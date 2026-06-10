import test from 'node:test';
import assert from 'node:assert/strict';
import { ansiLines, previewLines } from './render.js';

const rows = ['AAA', 'BBB'];
const colors = [{ r: 255, g: 0, b: 0 }, { r: 0, g: 0, b: 255 }];

test('previewLines pairs rows with colors', () => {
  assert.deepEqual(previewLines(rows, colors), [
    { text: 'AAA', color: 'rgb(255 0 0)' },
    { text: 'BBB', color: 'rgb(0 0 255)' },
  ]);
});

test('ansiLines appends reset after colored rows', () => {
  assert.deepEqual(ansiLines(rows, colors, '16'), [
    '\x1b[91mAAA\x1b[0m',
    '\x1b[94mBBB\x1b[0m',
  ]);
});

test('ansiLines supports plain output', () => {
  assert.deepEqual(ansiLines(rows, colors, 'plain'), rows);
});
