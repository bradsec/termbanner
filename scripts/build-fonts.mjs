import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { parseTdfFont } from '../src/tdf.js';
import { compactTdfFont, isKnownUnsupportedTdf, tdfIndexEntry } from './tdf-build-data.mjs';
import { parseFlfFont } from './flf-parser.mjs';
import { compactFlfFont, flfIndexEntry } from './flf-build-data.mjs';

const glyphHeight = 7;

const root = process.cwd();
const manifestPath = resolve(root, 'reference/textchars.txt');
const regularPath = resolve(root, 'reference/ansiregular.txt');
const outputPath = resolve(root, 'public/fonts/ansi-fonts.json');
const tdfSourceDir = resolve(root, 'fonts/tdf');
const tdfOutputDir = resolve(root, 'public/fonts/tdf');
const tdfIndexPath = resolve(root, 'public/fonts/tdf/index.json');
const flfSourceDir = resolve(root, 'fonts/flf');
const flfOutputDir = resolve(root, 'public/fonts/flf');
const flfIndexPath = resolve(root, 'public/fonts/flf/index.json');

function splitLines(data) {
  return data.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n');
}

function parseManifest(data) {
  return splitLines(data).map((line, index) => {
    const chars = [...line];
    if (chars.length !== 1) {
      throw new Error(`textchars.txt line ${index + 1} must contain exactly one character`);
    }
    return chars[0];
  });
}

function parseFont(key, name, manifest, data) {
  const lines = splitLines(data);
  if (lines.length % glyphHeight !== 0) {
    throw new Error(`${key} has ${lines.length} lines, not divisible by ${glyphHeight}`);
  }

  const glyphCount = lines.length / glyphHeight;
  if (glyphCount !== manifest.length) {
    throw new Error(`${key} has ${glyphCount} glyphs but textchars.txt has ${manifest.length} characters`);
  }

  const glyphs = {};
  for (let i = 0; i < manifest.length; i += 1) {
    const start = i * glyphHeight;
    glyphs[manifest[i]] = lines.slice(start, start + glyphHeight);
  }

  return {
    name,
    height: glyphHeight,
    advanceGap: 1,
    glyphs,
  };
}

const manifest = parseManifest(await readFile(manifestPath, 'utf8'));
const fonts = {
  regular: parseFont('regular', 'ANSI Regular', manifest, await readFile(regularPath, 'utf8')),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(fonts, null, 2)}\n`, 'utf8');

async function buildTdfFonts() {
  let files;
  try {
    files = (await readdir(tdfSourceDir))
      .filter((file) => file.toLowerCase().endsWith('.tdf'))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  await rm(tdfOutputDir, { recursive: true, force: true });
  await mkdir(tdfOutputDir, { recursive: true });

  const index = [];
  const skipped = [];

  for (const file of files) {
    const key = basename(file, '.tdf').toLocaleLowerCase('en-US');
    let font;
    try {
      font = parseTdfFont(await readFile(join(tdfSourceDir, file)), { key });
    } catch (error) {
      if (error.message === 'invalid TheDraw font') {
        console.warn(`Skipping invalid TDF font: ${file}`);
        skipped.push(file);
        continue;
      }

      throw error;
    }

    const outputFile = `${key}.json`;
    await writeFile(join(tdfOutputDir, outputFile), `${JSON.stringify(compactTdfFont(font))}\n`, 'utf8');
    index.push(tdfIndexEntry(font, outputFile));
  }

  await writeFile(tdfIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} unsupported TDF fonts: ${skipped.join(', ')}`);
  }

  console.log(`Built ${index.length} TDF fonts`);
}

async function buildFlfFonts() {
  let files;
  try {
    files = (await readdir(flfSourceDir))
      .filter((file) => file.toLowerCase().endsWith('.flf'))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  await rm(flfOutputDir, { recursive: true, force: true });
  await mkdir(flfOutputDir, { recursive: true });

  const index = [];
  const skipped = [];

  for (const file of files) {
    const key = basename(file, '.flf');
    const name = key.replace(/[_-]/g, ' ');
    let font;
    try {
      const source = await readFile(join(flfSourceDir, file), 'utf8');
      const parsed = parseFlfFont(source);
      font = { ...parsed, name };
    } catch (error) {
      console.warn(`Skipping invalid FLF font ${file}: ${error.message}`);
      skipped.push(file);
      continue;
    }

    const outputFile = `${key}.json`;
    await writeFile(
      join(flfOutputDir, outputFile),
      `${JSON.stringify(compactFlfFont(font, key))}\n`,
      'utf8',
    );
    index.push(flfIndexEntry(font, key, outputFile));
  }

  await writeFile(flfIndexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');

  if (skipped.length > 0) {
    console.warn(`Skipped ${skipped.length} FLF fonts: ${skipped.join(', ')}`);
  }

  console.log(`Built ${index.length} FLF fonts`);
}

await buildTdfFonts();
await buildFlfFonts();
