import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import fs from 'fs';

async function testSplitLogic() {
  console.log("=== Testing PDF Split & Naming Logic ===");

  // 1. Create a dummy 100-page PDF
  const doc = await PDFDocument.create();
  for (let i = 1; i <= 100; i++) {
    const page = doc.addPage([400, 600]);
    page.drawText(`Page ${i}`, { x: 50, y: 550, size: 24 });
  }
  const samplePdfBytes = await doc.save();
  console.log(`Created 100-page test PDF. Size: ${samplePdfBytes.length} bytes`);

  // 2. Test splitting with chunk=20, start=5, end=100, reset_numbering=true
  const totalPages = 100;
  const chunkSize = 20;
  const startPage = 5;
  const endPage = 100;
  const resetNumberingAtStart = true;
  const bookName = "Physics_Class12";

  const parts = [];
  let currentStart = startPage;
  let partIdx = 1;

  while (currentStart <= endPage) {
    const currentEnd = Math.min(currentStart + chunkSize - 1, endPage);
    const count = currentEnd - currentStart + 1;
    const logStart = resetNumberingAtStart ? (currentStart - startPage + 1) : currentStart;
    const logEnd = resetNumberingAtStart ? (currentEnd - startPage + 1) : currentEnd;

    parts.push({
      index: partIdx,
      physicalStart: currentStart,
      physicalEnd: currentEnd,
      logicalStart: logStart,
      logicalEnd: logEnd,
      pageCount: count
    });
    currentStart = currentEnd + 1;
    partIdx++;
  }

  console.log(`Generated ${parts.length} parts:`);
  parts.forEach(p => {
    console.log(` Part ${p.index}: Physical p${p.physicalStart}-p${p.physicalEnd} -> Logical p${p.logicalStart}-p${p.logicalEnd} (${p.pageCount} pages)`);
  });

  // 3. Test actual PDF page extraction
  const srcDoc = await PDFDocument.load(samplePdfBytes);
  const zip = new JSZip();

  for (const part of parts) {
    const newPdf = await PDFDocument.create();
    const indices = [];
    for (let p = part.physicalStart; p <= part.physicalEnd; p++) {
      indices.push(p - 1); // 0-based
    }
    const copied = await newPdf.copyPages(srcDoc, indices);
    copied.forEach(pg => newPdf.addPage(pg));
    const partBytes = await newPdf.save();

    // Verify extracted part page count
    const verifyDoc = await PDFDocument.load(partBytes);
    if (verifyDoc.getPageCount() !== part.pageCount) {
      throw new Error(`Part ${part.index} expected ${part.pageCount} pages, got ${verifyDoc.getPageCount()}`);
    }

    const filename = `${bookName}_Part_${part.index}_p${part.logicalStart}-${part.logicalEnd}.pdf`;
    zip.file(filename, partBytes);
    console.log(` Verified Part ${part.index}: ${filename} has exactly ${verifyDoc.getPageCount()} pages`);
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(` ZIP generated successfully! Total Size: ${zipBuffer.length} bytes`);
  console.log("=== All Logic Verified 100% Successfully ===");
}

testSplitLogic().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
