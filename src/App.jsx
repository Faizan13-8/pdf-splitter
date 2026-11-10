import React, { useState, useMemo, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  FileText,
  Upload,
  Split,
  Download,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Sparkles,
  RefreshCw,
  FolderArchive,
  Sliders,
  FileCheck,
  Eye,
  Trash2,
  Minus,
  Plus
} from 'lucide-react';

export default function App() {
  // File state
  const [file, setFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Split configurations (Stored as strings so user can freely delete and type!)
  const [splitMode, setSplitMode] = useState('chunk'); // 'chunk' or 'ranges'
  const [chunkSizeInput, setChunkSizeInput] = useState('20');
  const [startPageInput, setStartPageInput] = useState('1');
  const [endPageInput, setEndPageInput] = useState('');
  const [resetNumberingAtStart, setResetNumberingAtStart] = useState(true);
  const [customRangesInput, setCustomRangesInput] = useState('');

  // Naming configurations
  const [bookName, setBookName] = useState('');
  const [namingPreset, setNamingPreset] = useState('book_part');
  const [customTemplate, setCustomTemplate] = useState('{book}_Part_{part}');
  const [padZeroes, setPadZeroes] = useState(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [isSuccess, setIsSuccess] = useState(false);

  // File input ref
  const fileInputRef = useRef(null);

  // Handle PDF file selection
  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Kripya sirf valid PDF file upload karein (.pdf)');
      return;
    }

    setErrorMessage('');
    setIsLoadingPdf(true);
    try {
      const buffer = await selectedFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const pagesCount = pdfDoc.getPageCount();

      setFile(selectedFile);
      setFileBuffer(buffer);
      setTotalPages(pagesCount);
      setStartPageInput('1');
      setEndPageInput(String(pagesCount));

      // Clean default book name
      const rawName = selectedFile.name.replace(/\.[^/.]+$/, '').trim();
      const cleanName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Book';
      setBookName(cleanName);
      setIsSuccess(false);
    } catch (err) {
      console.error(err);
      setErrorMessage('PDF file padhne me samasya aayi. Kripya check karein file corrupt to nahi.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Generate a sample 100-page PDF in memory for instant demo
  const handleLoadDemoPdf = async () => {
    setIsLoadingPdf(true);
    setErrorMessage('');
    try {
      const pdfDoc = await PDFDocument.create();
      for (let i = 1; i <= 100; i++) {
        const page = pdfDoc.addPage([595, 842]);
        page.drawText(`Sample Book - Page ${i}`, { x: 50, y: 800, size: 20 });
        page.drawText(`Yeh 100 pages ki demo book ka Page ${i} hai.`, { x: 50, y: 760, size: 14 });
      }
      const pdfBytes = await pdfDoc.save();
      const demoBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const demoFile = new File([demoBlob], 'Sample_Book_100_Pages.pdf', { type: 'application/pdf' });

      setFile(demoFile);
      setFileBuffer(pdfBytes.buffer);
      setTotalPages(100);
      setStartPageInput('5');
      setEndPageInput('100');
      setBookName('Sample_Book');
      setChunkSizeInput('20');
      setResetNumberingAtStart(true);
      setIsSuccess(false);
    } catch (err) {
      console.error(err);
      setErrorMessage('Sample PDF generate karne me error: ' + err.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Calculate planned parts based on current settings
  const plannedParts = useMemo(() => {
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
    } else {
      const ranges = customRangesInput.split(',').map((r) => r.trim()).filter(Boolean);
      ranges.forEach((r, idx) => {
        const partsSplit = r.split('-').map((p) => parseInt(p.trim(), 10));
        let pStart = partsSplit[0];
        let pEnd = partsSplit[1] || pStart;

        if (!isNaN(pStart) && !isNaN(pEnd) && pStart >= 1 && pEnd <= totalPages && pStart <= pEnd) {
          const logicalStart = resetNumberingAtStart ? Math.max(1, pStart - effectiveStart + 1) : pStart;
          const logicalEnd = resetNumberingAtStart ? Math.max(1, pEnd - effectiveStart + 1) : pEnd;

          parts.push({
            index: idx + 1,
            physicalStart: pStart,
            physicalEnd: pEnd,
            logicalStart,
            logicalEnd,
            pageCount: pEnd - pStart + 1,
          });
        }
      });
    }

    return parts;
  }, [totalPages, startPageInput, endPageInput, splitMode, chunkSizeInput, customRangesInput, resetNumberingAtStart]);

  // Compute filename for a part
  const getPartFileName = (part, totalParts) => {
    const cleanBook = (bookName || 'Document').trim().replace(/[\s\t\n]+/g, '_');
    const partNumStr = padZeroes && totalParts >= 10
      ? String(part.index).padStart(2, '0')
      : String(part.index);

    let template = '{book}_Part_{part}';
    if (namingPreset === 'book_part') {
      template = '{book}_Part_{part}';
    } else if (namingPreset === 'book_pages') {
      template = '{book}_Pages_{start}-{end}';
    } else if (namingPreset === 'book_part_pages') {
      template = '{book}_Part_{part}_p{start}-p{end}';
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

    return rendered.endsWith('.pdf') ? rendered : `${rendered}.pdf`;
  };

  // Extract a single part
  const extractPdfPart = async (sourcePdfDoc, part) => {
    const newPdf = await PDFDocument.create();
    const pageIndices = [];
    for (let p = part.physicalStart; p <= part.physicalEnd; p++) {
      pageIndices.push(p - 1);
    }
    const copiedPages = await newPdf.copyPages(sourcePdfDoc, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    return await newPdf.save();
  };

  // Download single part
  const downloadSinglePart = async (part) => {
    if (!fileBuffer) return;
    setIsProcessing(true);
    setProgress({ current: 1, total: 1, text: `Creating Part ${part.index}...` });

    try {
      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      const pdfBytes = await extractPdfPart(srcDoc, part);
      const fileName = getPartFileName(part, plannedParts.length);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, fileName);
    } catch (err) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Split and download all as ZIP
  const handleSplitAndDownloadAll = async () => {
    if (!fileBuffer || plannedParts.length === 0) return;

    setIsProcessing(true);
    setIsSuccess(false);
    const total = plannedParts.length;

    try {
      const zip = new JSZip();
      const folderName = `${(bookName || 'Split_PDF').trim()}_parts`;
      const rootFolder = zip.folder(folderName);
      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

      for (let i = 0; i < total; i++) {
        const part = plannedParts[i];
        const fileName = getPartFileName(part, total);

        setProgress({
          current: i + 1,
          total,
          text: `Processing Part ${i + 1}/${total}: ${fileName}`,
        });

        const partBytes = await extractPdfPart(srcDoc, part);
        rootFolder.file(fileName, partBytes);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      setProgress({ current: total, total, text: 'Packing into ZIP...' });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const zipFileName = `${(bookName || 'Split_PDF').trim()}_all_${total}_parts.zip`;
      saveAs(zipBlob, zipFileName);
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      alert('Error during split: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset all
  const handleReset = () => {
    setFile(null);
    setFileBuffer(null);
    setTotalPages(0);
    setErrorMessage('');
    setIsSuccess(false);
  };

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col font-sans pb-28">
      {/* Sleek Native-Style Android AppBar */}
      <header className="sticky top-0 z-30 bg-indigo-600 text-white shadow-sm border-b border-indigo-700/40">
        <div className="w-full max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
              <Split className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">
                PDF Splitter Pro
              </h1>
              <p className="text-[11px] text-indigo-200 mt-0.5">100% Offline • Private</p>
            </div>
          </div>

          <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded-full border border-white/20">
            v1.1
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="w-full max-w-xl mx-auto px-3.5 py-4 space-y-4 flex-1">
        {/* Upload State */}
        {!file ? (
          <div className="space-y-4">
            {/* Upload Box */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files?.[0]) handleFileChange(e.dataTransfer.files[0]);
              }}
              className={`bg-white rounded-2xl shadow-sm border p-6 text-center transition-all ${
                isDragging ? 'border-indigo-500 bg-indigo-50/50 ring-2 ring-indigo-500/20' : 'border-slate-200/90'
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-xs mb-3">
                <Upload className="w-7 h-7" />
              </div>

              <h2 className="text-lg font-bold text-slate-900">Select PDF</h2>
              <p className="text-xs text-slate-500 mt-1 mb-4 leading-relaxed">
                Apni 100+ pages ki book ya PDF document select karein aur 20-20 pages ke tukdon me baantein.
              </p>

              {/* Native File Input Button */}
              <div className="relative mb-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  onClick={(e) => { e.currentTarget.value = ''; }}
                  onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }}
                  disabled={isLoadingPdf}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <button
                  type="button"
                  disabled={isLoadingPdf}
                  className="w-full h-12 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 pointer-events-none"
                >
                  <FileText className="w-4 h-4" />
                  {isLoadingPdf ? 'PDF Check ho rahi hai...' : 'Select PDF'}
                </button>
              </div>

              {/* Sample Demo Button */}
              <button
                type="button"
                onClick={handleLoadDemoPdf}
                disabled={isLoadingPdf}
                className="w-full h-10 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-indigo-700 font-semibold text-xs transition active:scale-[0.99] flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                1-Click Demo: 100-Page Sample Book Load Karein
              </button>

              {errorMessage && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-2.5 text-xs text-left mt-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Feature Cards Grid */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <div className="text-indigo-600 font-bold text-xs">20-20 Pages</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Equal Parts Split</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <div className="text-indigo-600 font-bold text-xs">Start Offset</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Page 5 = Page 1</div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs text-center">
                <div className="text-indigo-600 font-bold text-xs">Smart Names</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Auto ZIP Bundle</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Document Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 text-sm truncate">
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                    <span className="font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">
                      {totalPages} Pages
                    </span>
                    <span>•</span>
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-slate-500 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 transition shrink-0"
                title="Change File"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Split Configuration Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-indigo-600" />
                  <h2 className="font-bold text-slate-900 text-sm">1. Split Settings</h2>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setSplitMode('chunk')}
                    className={`px-2.5 py-1 rounded-md transition text-xs ${
                      splitMode === 'chunk'
                        ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    Equal Chunks
                  </button>
                  <button
                    onClick={() => setSplitMode('ranges')}
                    className={`px-2.5 py-1 rounded-md transition text-xs ${
                      splitMode === 'ranges'
                        ? 'bg-white text-indigo-600 shadow-2xs font-bold'
                        : 'text-slate-600'
                    }`}
                  >
                    Custom
                  </button>
                </div>
              </div>

              {splitMode === 'chunk' ? (
                <div className="space-y-3">
                  {/* Chunk Size with Steppers and Chips */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex justify-between">
                      <span>Pages per Split (Chunk Size)</span>
                      <span className="text-indigo-600 font-bold">{chunkSizeInput || 20} pages</span>
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.max(1, (parseInt(chunkSizeInput, 10) || 20) - 5);
                          setChunkSizeInput(String(val));
                        }}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 active:scale-95 transition shrink-0"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={chunkSizeInput}
                        onChange={(e) => setChunkSizeInput(e.target.value)}
                        onBlur={() => {
                          if (!chunkSizeInput || parseInt(chunkSizeInput, 10) < 1) {
                            setChunkSizeInput('20');
                          }
                        }}
                        placeholder="20"
                        className="flex-1 h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-sm font-bold text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const val = Math.min(totalPages, (parseInt(chunkSizeInput, 10) || 20) + 5);
                          setChunkSizeInput(String(val));
                        }}
                        className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 active:scale-95 transition shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex gap-1.5 pt-0.5">
                      {['10', '20', '25', '50'].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setChunkSizeInput(sz)}
                          className={`flex-1 py-1 rounded-lg border text-xs font-semibold transition ${
                            chunkSizeInput === sz
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start Page & End Page inputs */}
                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Start from Page:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={startPageInput}
                        onChange={(e) => setStartPageInput(e.target.value)}
                        onBlur={() => {
                          if (!startPageInput || parseInt(startPageInput, 10) < 1) {
                            setStartPageInput('1');
                          }
                        }}
                        placeholder="1"
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-400">e.g. 5 (Skip Cover)</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        End at Page:
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={endPageInput}
                        onChange={(e) => setEndPageInput(e.target.value)}
                        onBlur={() => {
                          if (!endPageInput || parseInt(endPageInput, 10) < 1) {
                            setEndPageInput(String(totalPages));
                          }
                        }}
                        placeholder={String(totalPages)}
                        className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-slate-400">Max: {totalPages}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">
                    Custom Page Ranges:
                  </label>
                  <input
                    type="text"
                    value={customRangesInput}
                    onChange={(e) => setCustomRangesInput(e.target.value)}
                    placeholder="e.g. 5-25, 26-50, 51-100"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-slate-900 text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Comma se alag karein, jaise: <span className="font-mono bg-slate-100 px-1 rounded">1-20, 21-40, 41-100</span>
                  </p>
                </div>
              )}

              {/* Reset Numbering Offset Switch */}
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-900">
                    Reset Page Numbering (Page {startPageInput || '1'} = Page 1)
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    {resetNumberingAtStart
                      ? `Page ${startPageInput || '1'} se start karke file name me p1-20, p21-40 likhega.`
                      : `Original physical page numbers use honge.`}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={resetNumberingAtStart}
                    onChange={(e) => setResetNumberingAtStart(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-slate-200 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                </label>
              </div>
            </div>

            {/* 2. Smart Naming Options Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 space-y-3.5">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2.5">
                <FileCheck className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-slate-900 text-sm">2. Smart File Naming</h2>
              </div>

              {/* Book Name Input with Pad Zeroes toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Book / Subject Name:</span>
                  <label className="flex items-center gap-1.5 font-normal cursor-pointer text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={padZeroes}
                      onChange={(e) => setPadZeroes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Zero Pad (01, 02)</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="Enter book name (e.g. Maths_12)"
                  className="w-full h-10 px-3.5 rounded-xl border border-slate-200 text-slate-900 text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Preset Selection Cards */}
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => setNamingPreset('book_part')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition text-left ${
                    namingPreset === 'book_part'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-900">By Part Number</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-0.5 truncate">
                    {bookName || 'Book'}_Part_1.pdf
                  </div>
                </div>

                <div
                  onClick={() => setNamingPreset('book_pages')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition text-left ${
                    namingPreset === 'book_pages'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-900">By Page Range</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-0.5 truncate">
                    {bookName || 'Book'}_Pages_1-20.pdf
                  </div>
                </div>

                <div
                  onClick={() => setNamingPreset('book_part_pages')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition text-left ${
                    namingPreset === 'book_part_pages'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-900">Part + Pages</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-0.5 truncate">
                    {bookName || 'Book'}_Part_1_p1-20.pdf
                  </div>
                </div>

                <div
                  onClick={() => setNamingPreset('custom')}
                  className={`p-2.5 rounded-xl border cursor-pointer transition text-left ${
                    namingPreset === 'custom'
                      ? 'border-indigo-600 bg-indigo-50/60 ring-1 ring-indigo-500'
                      : 'border-slate-200 bg-slate-50/50'
                  }`}
                >
                  <div className="text-[11px] font-bold text-slate-900">Custom Formula</div>
                  <div className="text-[10px] text-indigo-600 font-mono mt-0.5 truncate">
                    Formula Box
                  </div>
                </div>
              </div>

              {/* Custom Formula Editor */}
              {namingPreset === 'custom' && (
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <input
                    type="text"
                    value={customTemplate}
                    onChange={(e) => setCustomTemplate(e.target.value)}
                    placeholder="{book}_Part_{part}_p{start}-p{end}"
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-mono"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['{book}', '{part}', '{start}', '{end}', '{total_parts}'].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setCustomTemplate((prev) => prev + chip)}
                        className="text-[10px] font-mono bg-white text-indigo-700 px-1.5 py-0.5 rounded border border-slate-200"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Generated Split Preview Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <h2 className="font-bold text-slate-900 text-sm">
                    3. Split Preview ({plannedParts.length} Files)
                  </h2>
                </div>
                <span className="text-[11px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                  {chunkSizeInput || 20} Pages/file
                </span>
              </div>

              {/* Parts List */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
                {plannedParts.map((part) => {
                  const fileName = getPartFileName(part, plannedParts.length);
                  return (
                    <div
                      key={part.index}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                          #{part.index}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 font-mono truncate">
                            {fileName}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Book: <span className="font-bold text-indigo-600">p{part.logicalStart}-{part.logicalEnd}</span> • ({part.pageCount} pages)
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => downloadSinglePart(part)}
                        disabled={isProcessing}
                        className="text-xs font-bold text-indigo-600 bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0 shadow-2xs hover:bg-indigo-50"
                      >
                        Download
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Processing Progress Bar */}
              {isProcessing && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-1.5 animate-pulse">
                  <div className="flex justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      {progress.text || 'Processing...'}
                    </span>
                    <span>
                      {progress.total > 0
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : ''}
                    </span>
                  </div>
                  <div className="w-full bg-indigo-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {isSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Sabhi {plannedParts.length} PDFs download ho chuki hain!</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Action Bar (Fixed above Android navigation bar) */}
      {file && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 shadow-lg">
          <div className="w-full max-w-xl mx-auto flex gap-2">
            <button
              onClick={handleSplitAndDownloadAll}
              disabled={isProcessing || plannedParts.length === 0}
              className="w-full h-12 rounded-xl bg-indigo-600 active:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FolderArchive className="w-5 h-5" />
              {isProcessing
                ? 'Processing & Packing...'
                : `Download All as ZIP (${plannedParts.length} PDFs)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
