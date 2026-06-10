// Vertical line-gap overlap for plain text rows: merge a row from the line
// below onto a row from the line above, character by character. Spaces in the
// lower line let the upper line's glyph show through instead of blanking it.
export function overlayTextRow(baseRow, overlayRow) {
  const len = Math.max(baseRow.length, overlayRow.length);
  let merged = '';
  for (let i = 0; i < len; i += 1) {
    const overlayChar = overlayRow[i] ?? ' ';
    merged += overlayChar !== ' ' ? overlayChar : (baseRow[i] ?? ' ');
  }
  return merged;
}

// `mergeRow(baseRow, overlayRow)` is optional; when given, negative gap overlaps
// rows by merging cell-by-cell instead of truncating the previous block, so
// transparent (blank) cells in the new block let the previous block show
// through rather than erasing it.
export function combineLineBlocks(blocks, gap, blankRow, mergeRow) {
  const parsedGap = Number.parseInt(gap ?? 0, 10) || 0;
  const combined = [];

  for (const block of blocks) {
    if (combined.length > 0) {
      if (parsedGap > 0) {
        for (let i = 0; i < parsedGap; i += 1) {
          combined.push(blankRow());
        }
      } else if (parsedGap < 0 && mergeRow) {
        const overlap = Math.min(-parsedGap, combined.length, block.length);
        for (let i = 0; i < overlap; i += 1) {
          const targetIndex = combined.length - overlap + i;
          combined[targetIndex] = mergeRow(combined[targetIndex], block[i]);
        }
        combined.push(...block.slice(overlap));
        continue;
      } else if (parsedGap < 0) {
        combined.splice(Math.max(0, combined.length + parsedGap));
      }
    }

    combined.push(...block);
  }

  return combined;
}
