import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// Test function simulating the exact logic from App.jsx
function computeParts({ totalPages, startPageInput, endPageInput, splitMode, chunkSizeInput, customRangesInput, resetNumberingAtStart }) {
  if (!totalPages || totalPages <= 0) return [];

  const rawStart = parseInt(startPageInput, 10);
  const effectiveStart = isNaN(rawStart) || rawStart < 1 ? 1 : Math.min(rawStart, totalPages);

  const rawEnd = parseInt(endPageInput, 10);
  const effectiveEnd = isNaN(rawEnd) || rawEnd < effectiveStart ? totalPages : Math.min(rawEnd, totalPages);

  const parts = [];

  if (splitMode === 'chunk') {
    const rawChunk = parseInt(chunkSizeInput, 10);
    const size = isNaN(rawChunk) || rawChunk < 1 ? 20 : rawChunk;

    let currentStart = effectiveStart;
    let partIndex = 1;

    while (currentStart <= effectiveEnd) {
      const currentEnd = Math.min(currentStart + size - 1, effectiveEnd);
      const pageCount = currentEnd - currentStart + 1;

      const logicalStart = resetNumberingAtStart ? (currentStart - effectiveStart + 1) : currentStart;
      const logicalEnd = resetNumberingAtStart ? (currentEnd - effectiveStart + 1) : currentEnd;

      parts.push({
        index: partIndex,
        physicalStart: currentStart,
        physicalEnd: currentEnd,
        logicalStart,
        logicalEnd,
        pageCount,
      });

      currentStart = currentEnd + 1;
      partIndex++;
    }
  }
  return parts;
}

function getPartFileName({ part, totalParts, bookName, namingPreset, customTemplate, padZeroes }) {
  let cleanBook = (bookName || 'Document').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/[\s\t\n]+/g, '_');
  if (!cleanBook) cleanBook = 'Document';

  const digits = Math.max(2, String(totalParts).length);
  const partNumStr = padZeroes ? String(part.index).padStart(digits, '0') : String(part.index);

  let template = '{book}_Part_{part}';
  if (namingPreset === 'book_part') {
    template = '{book}_Part_{part}';
  } else if (namingPreset === 'book_pages') {
    template = '{book}_Pages_{start}-{end}';
  } else if (namingPreset === 'book_part_pages') {
    template = '{book}_Part_{part}_p{start}-p{end}';
  } else if (namingPreset === 'part_only') {
    template = 'Part_{part}';
  } else if (namingPreset === 'custom') {
    template = customTemplate || '{book}_Part_{part}';
  }

  const rendered = template
    .replace(/{book}/g, cleanBook)
    .replace(/{part}/g, partNumStr)
    .replace(/{start}/g, String(part.logicalStart))
    .replace(/{end}/g, String(part.logicalEnd))
    .replace(/{physical_start}/g, String(part.physicalStart))
    .replace(/{physical_end}/g, String(part.physicalEnd))
    .replace(/{total_parts}/g, String(totalParts))
    .replace(/{pages}/g, String(part.pageCount));

  let safeName = rendered.replace(/[\\/:*?"<>|]/g, '_');
  return safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
}

async function runTests() {
  console.log('--- TEST 1: Default 100 pages, Start 1, End 100, Chunk 20 ---');
  let parts = computeParts({
    totalPages: 100,
    startPageInput: '1',
    endPageInput: '100',
    splitMode: 'chunk',
    chunkSizeInput: '20',
    resetNumberingAtStart: true
  });
  console.log(`Generated ${parts.length} parts`);
  if (parts.length !== 5) throw new Error('Expected 5 parts');
  if (parts[0].physicalStart !== 1 || parts[0].physicalEnd !== 20) throw new Error('Part 1 range mismatch');
  if (parts[4].physicalStart !== 81 || parts[4].physicalEnd !== 100) throw new Error('Part 5 range mismatch');

  console.log('--- TEST 2: Start Page 5, End Page 45, Chunk 10, Offset ON ---');
  parts = computeParts({
    totalPages: 100,
    startPageInput: '5',
    endPageInput: '45',
    splitMode: 'chunk',
    chunkSizeInput: '10',
    resetNumberingAtStart: true
  });
  // Pages 5 to 45 = 41 pages.
  // Part 1: physical 5-14 (10 pages) -> logical 1-10
  // Part 2: physical 15-24 (10 pages) -> logical 11-20
  // Part 3: physical 25-34 (10 pages) -> logical 21-30
  // Part 4: physical 35-44 (10 pages) -> logical 31-40
  // Part 5: physical 45-45 (1 page) -> logical 41-41
  console.log(`Generated ${parts.length} parts`);
  if (parts.length !== 5) throw new Error('Expected 5 parts');
  if (parts[0].logicalStart !== 1 || parts[0].logicalEnd !== 10) throw new Error('Part 1 logical mismatch');
  if (parts[4].logicalStart !== 41 || parts[4].logicalEnd !== 41) throw new Error('Part 5 logical mismatch');

  console.log('--- TEST 3: Naming Presets & Leading Zeroes ---');
  const presets = ['book_part', 'book_pages', 'book_part_pages', 'part_only', 'custom'];
  for (const preset of presets) {
    const fn = getPartFileName({
      part: parts[0],
      totalParts: parts.length,
      bookName: 'Physics 12',
      namingPreset: preset,
      customTemplate: '{book}_Unit_{part}_{start}_to_{end}',
      padZeroes: true
    });
    console.log(`Preset [${preset}]: ${fn}`);
  }

  console.log('--- TEST 4: Sanitization of special characters ---');
  const sanitized = getPartFileName({
    part: parts[0],
    totalParts: 5,
    bookName: 'Maths: Chapter 1/2*3',
    namingPreset: 'book_part',
    padZeroes: true
  });
  console.log(`Sanitized filename: ${sanitized}`);
  if (sanitized.includes(':') || sanitized.includes('/') || sanitized.includes('*')) {
    throw new Error('Special characters were not sanitized!');
  }

  console.log('--- ALL AUTOMATED LOGICAL TESTS PASSED! ---');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
