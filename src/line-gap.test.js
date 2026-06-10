import test from 'node:test';
import assert from 'node:assert/strict';
import { combineLineBlocks } from './line-gap.js';

test('combineLineBlocks inserts blank rows for positive line gap', () => {
  assert.deepEqual(
    combineLineBlocks([['A1', 'A2'], ['B1']], 2, () => ''),
    ['A1', 'A2', '', '', 'B1'],
  );
});

test('combineLineBlocks joins line blocks directly at zero line gap', () => {
  assert.deepEqual(
    combineLineBlocks([['A1', 'A2'], ['B1']], 0, () => ''),
    ['A1', 'A2', 'B1'],
  );
});

test('combineLineBlocks removes trailing rows for negative line gap', () => {
  assert.deepEqual(
    combineLineBlocks([['A1', 'A2', 'A3'], ['B1', 'B2']], -2, () => ''),
    ['A1', 'B1', 'B2'],
  );
});

test('combineLineBlocks does not remove rows before the start of output', () => {
  assert.deepEqual(
    combineLineBlocks([['A1'], ['B1']], -4, () => ''),
    ['B1'],
  );
});

test('combineLineBlocks supports line gap down to minus 8', () => {
  assert.deepEqual(
    combineLineBlocks([
      ['A1', 'A2', 'A3', 'A4', 'A5'],
      ['B1', 'B2'],
    ], -8, () => ''),
    ['B1', 'B2'],
  );
});
