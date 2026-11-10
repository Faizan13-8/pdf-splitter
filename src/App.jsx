import React, { useState, useMemo, useRef } from 'react';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import {
  FileText,
  Upload,
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
  Plus,
  Hash,
  Scissors,
  Check,
  RotateCcw,
  Layers,
  Settings2
} from 'lucide-react';

export default function App() {
  // File state
  const [file, setFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Split configurations (Strings to allow unhindered backspacing & typing)
  const [splitMode, setSplitMode] = useState('chunk'); // 'chunk' or 'ranges'
  const [chunkSizeInput, setChunkSizeInput] = useState('20');
  const [startPageInput, setStartPageInput] = useState('1');
  const [endPageInput, setEndPageInput] = useState('100');
  const [resetNumberingAtStart, setResetNumberingAtStart] = useState(true);
  const [customRangesInput, setCustomRangesInput] = useState('');

  // Naming configurations
  const [bookName, setBookName] = useState('');
  const [namingPreset, setNamingPreset] = useState('book_part'); // 'book_part', 'book_pages', 'book_part_pages', 'part_only', 'custom'
  const [customTemplate, setCustomTemplate] = useState('{book}_Part_{part}');
  const [padZeroes, setPadZeroes] = useState(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [toastMessage, setToastMessage] = useState('');

  // File input ref
  const fileInputRef = useRef(null);

  // Show temporary toast notification
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  // Universal File Saver (Works on both Native Android APK and Desktop/Web)
  const saveFileUniversally = async (dataBlob, fileName, mimeType = 'application/pdf') => {
    try {
      if (Capacitor.isNativePlatform()) {
        // 1. Convert blob to Base64 for Capacitor Filesystem
        const reader = new FileReader();
        const base64Data = await new Promise((resolve, reject) => {
          reader.onloadend = () => {
            const res = reader.result;
            const base64 = typeof res === 'string' ? res.split(',')[1] : '';
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(dataBlob);
        });

        // 2. Always write to Cache directory first (100% reliable across all Android OS versions without runtime permission popups)
        const cacheResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Cache,
          recursive: true
        });

        // Also attempt writing to Documents if allowed
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: base64Data,
            directory: Directory.Documents,
            recursive: true
          });
        } catch (docErr) {
          console.warn('Documents folder write skipped:', docErr);
        }

        // 3. Trigger native Android Share / Save Sheet
        try {
          await Share.share({
            title: fileName,
            text: `Exported ${fileName}`,
            url: cacheResult.uri,
            dialogTitle: `Save or Open ${fileName}`
          });
          showToast(`Saved: ${fileName}`);
        } catch (shareErr) {
          // If share dialog was dismissed by user, file is still saved in cache/documents
          showToast(`File ready: ${fileName}`);
        }
      } else {
        // Desktop / Mobile Web browser download
        saveAs(dataBlob, fileName);
        showToast(`Downloaded: ${fileName}`);
      }
    } catch (err) {
      console.error('Universal save error:', err);
      // Fallback
      saveAs(dataBlob, fileName);
      showToast(`Exported: ${fileName}`);
    }
  };

  // Handle PDF file selection
  const handleFileChange = async (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Please select a valid PDF file (.pdf)');
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

      // Start page defaults to 1, End page defaults to total pages
      setStartPageInput('1');
      setEndPageInput(String(pagesCount));

      // Clean default book name
      const rawName = selectedFile.name.replace(/\.[^/.]+$/, '').trim();
      const cleanName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim().replace(/\s+/g, '_') || 'Document';
      setBookName(cleanName);
      showToast(`Loaded "${selectedFile.name}" (${pagesCount} pages)`);
    } catch (err) {
      console.error(err);
      setErrorMessage('Failed to read PDF. The file may be password protected or corrupted.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Generate a sample 100-page PDF in memory for instant testing
  const handleLoadDemoPdf = async () => {
    setIsLoadingPdf(true);
    setErrorMessage('');
    try {
      const pdfDoc = await PDFDocument.create();
      for (let i = 1; i <= 100; i++) {
        const page = pdfDoc.addPage([595, 842]);
        page.drawText(`SAMPLE BOOK — PAGE ${i}`, { x: 50, y: 790, size: 20 });
        page.drawText(`This is page ${i} of 100 in this demo PDF.`, { x: 50, y: 750, size: 14 });
        page.drawText(`Split with PDF Splitter Pro into equal parts with custom naming.`, { x: 50, y: 720, size: 12 });
      }
      const pdfBytes = await pdfDoc.save();
      const demoBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const demoFile = new File([demoBlob], 'Sample_Book_100_Pages.pdf', { type: 'application/pdf' });

      setFile(demoFile);
      setFileBuffer(pdfBytes.buffer);
      setTotalPages(100);

      // Start Page MUST default to 1, End Page MUST default to 100
      setStartPageInput('1');
      setEndPageInput('100');
      setBookName('Sample_Book');
      setChunkSizeInput('20');
      setResetNumberingAtStart(true);
      showToast('Loaded 100-Page Sample Demo (Pages 1 to 100)');
    } catch (err) {
      console.error(err);
      setErrorMessage('Demo generation failed: ' + err.message);
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

  // Compute filename for a part dynamically
  const getPartFileName = (part, totalParts, customPreset = null) => {
    let cleanBook = (bookName || 'Document').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/[\s\t\n]+/g, '_');
    if (!cleanBook) cleanBook = 'Document';

    const digits = Math.max(2, String(totalParts || 1).length);
    const partNumStr = padZeroes ? String(part.index).padStart(digits, '0') : String(part.index);

    const activePreset = customPreset || namingPreset;
    let template = '{book}_Part_{part}';
    if (activePreset === 'book_part') {
      template = '{book}_Part_{part}';
    } else if (activePreset === 'book_pages') {
      template = '{book}_Pages_{start}-{end}';
    } else if (activePreset === 'book_part_pages') {
      template = '{book}_Part_{part}_p{start}-p{end}';
    } else if (activePreset === 'part_only') {
      template = 'Part_{part}';
    } else if (activePreset === 'custom') {
      template = customTemplate || '{book}_Part_{part}';
    }

    const rendered = template
      .replace(/{book}/g, cleanBook)
      .replace(/{part}/g, partNumStr)
      .replace(/{start}/g, String(part.logicalStart))
      .replace(/{end}/g, String(part.logicalEnd))
      .replace(/{physical_start}/g, String(part.physicalStart))
      .replace(/{physical_end}/g, String(part.physicalEnd))
      .replace(/{total_parts}/g, String(totalParts || 1))
      .replace(/{pages}/g, String(part.pageCount));

    let safeName = rendered.replace(/[\\/:*?"<>|]/g, '_');
    return safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`;
  };

  // Helper for sample part preview in preset cards
  const samplePartForCard = useMemo(() => {
    if (plannedParts.length > 0) return plannedParts[0];
    return {
      index: 1,
      physicalStart: 1,
      physicalEnd: 20,
      logicalStart: 1,
      logicalEnd: 20,
      pageCount: 20
    };
  }, [plannedParts]);

  // Extract a single part using pdf-lib
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
    const fileName = getPartFileName(part, plannedParts.length);
    setProgress({ current: 1, total: 1, text: `Exporting: ${fileName}` });

    try {
      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      const pdfBytes = await extractPdfPart(srcDoc, part);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      await saveFileUniversally(blob, fileName, 'application/pdf');
    } catch (err) {
      console.error(err);
      alert('Export failed: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Split and download all as ZIP
  const handleSplitAndDownloadAll = async () => {
    if (!fileBuffer || plannedParts.length === 0) return;

    setIsProcessing(true);
    const total = plannedParts.length;

    try {
      const zip = new JSZip();
      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

      for (let i = 0; i < total; i++) {
        const part = plannedParts[i];
        const fileName = getPartFileName(part, total);

        setProgress({
          current: i + 1,
          total,
          text: `Splitting Part ${i + 1} of ${total}: ${fileName}`,
        });

        const partBytes = await extractPdfPart(srcDoc, part);
        zip.file(fileName, partBytes);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }

      setProgress({ current: total, total, text: 'Packaging ZIP file...' });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const cleanBook = (bookName || 'Split_PDF').trim().replace(/[\\/:*?"<>|]/g, '_').replace(/[\s\t\n]+/g, '_') || 'Document';
      const zipFileName = `${cleanBook}_All_${total}_Parts.zip`;
      await saveFileUniversally(zipBlob, zipFileName, 'application/zip');
    } catch (err) {
      console.error(err);
      alert('Batch export error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset to full range (1 to totalPages)
  const handleResetToFullRange = () => {
    setStartPageInput('1');
    setEndPageInput(String(totalPages));
    showToast(`Reset range to 1 - ${totalPages}`);
  };

  // Reset all
  const handleReset = () => {
    setFile(null);
    setFileBuffer(null);
    setTotalPages(0);
    setErrorMessage('');
  };

  return (
    <div className="w-full min-h-screen bg-slate-900 text-slate-100 font-sans pb-36">
      {/* Sleek Header */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
        <div className="w-full max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Custom Modern Gradient Logo */}
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-indigo-400/30">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="8" y1="13" x2="16" y2="13" />
                <line x1="8" y1="17" x2="13" y2="17" />
              </svg>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full border-2 border-slate-900"></div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-black tracking-tight text-white">DOCSPLIT</span>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Smart Offline PDF Splitter</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              100% Offline
            </span>
          </div>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 max-w-sm mx-auto animate-bounce">
          <div className="bg-slate-800/95 border border-indigo-500/40 text-indigo-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs font-semibold backdrop-blur-md">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="w-full max-w-xl mx-auto px-4 py-4 space-y-4">
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
              className={`bg-slate-800/70 backdrop-blur-sm rounded-2xl border p-6 text-center transition-all ${
                isDragging ? 'border-indigo-400 bg-indigo-950/40 ring-4 ring-indigo-500/20' : 'border-slate-700/80'
              }`}
            >
              <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-900/60 to-violet-900/60 flex items-center justify-center text-indigo-400 border border-indigo-700/50 shadow-inner mb-3">
                <Upload className="w-8 h-8 text-indigo-300" />
              </div>

              <h2 className="text-lg font-bold text-white tracking-tight">Select PDF Document</h2>
              <p className="text-xs text-slate-400 mt-1 mb-5 leading-relaxed max-w-xs mx-auto">
                Upload any book or document. Split by page count, customize names, and export directly to your device.
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
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 active:from-indigo-700 active:to-violet-700 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 pointer-events-none transition"
                >
                  <FileText className="w-4 h-4" />
                  {isLoadingPdf ? 'Reading Document...' : 'Choose PDF File'}
                </button>
              </div>

              {/* Sample Demo Button */}
              <button
                type="button"
                onClick={handleLoadDemoPdf}
                disabled={isLoadingPdf}
                className="w-full h-11 rounded-xl bg-slate-900/80 hover:bg-slate-900 border border-slate-700 hover:border-indigo-500/50 text-indigo-300 font-semibold text-xs transition active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-indigo-400" />
                1-Click Test Demo (100-Page Sample PDF)
              </button>

              {errorMessage && (
                <div className="flex items-center gap-2 text-rose-300 bg-rose-950/50 border border-rose-800/80 rounded-xl p-3 text-xs text-left mt-3">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 text-center">
                <Scissors className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                <div className="text-white font-bold text-xs">Equal Chunks</div>
                <div className="text-[10px] text-slate-400 mt-0.5">e.g. 20 Pages Each</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 text-center">
                <Hash className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                <div className="text-white font-bold text-xs">Start Offset</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Count p5 as p1</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 text-center">
                <Layers className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
                <div className="text-white font-bold text-xs">Smart Naming</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Automated Labels</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Document Header Card */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-3.5 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-950/80 border border-indigo-700/60 flex items-center justify-center text-indigo-300 shrink-0">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-white text-sm truncate">
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                    <span className="font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800/60">
                      {totalPages} Pages
                    </span>
                    <span>•</span>
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-slate-400 hover:text-rose-400 p-2.5 rounded-xl hover:bg-slate-700/60 transition shrink-0"
                title="Select Another File"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Split Range & Page Configuration */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-4 space-y-4 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-bold text-white text-sm">1. Split Configuration</h2>
                </div>

                {/* Mode Selector Tabs */}
                <div className="flex bg-slate-900/90 p-0.5 rounded-lg text-xs font-semibold border border-slate-700/60">
                  <button
                    onClick={() => setSplitMode('chunk')}
                    className={`px-3 py-1 rounded-md transition text-xs ${
                      splitMode === 'chunk'
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Equal Chunks
                  </button>
                  <button
                    onClick={() => setSplitMode('ranges')}
                    className={`px-3 py-1 rounded-md transition text-xs ${
                      splitMode === 'ranges'
                        ? 'bg-indigo-600 text-white font-bold shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Custom Ranges
                  </button>
                </div>
              </div>

              {splitMode === 'chunk' ? (
                <div className="space-y-4">
                  {/* Pages Per Split File with Stepper Controls */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Pages Per Split File:</span>
                      <span className="text-indigo-400 font-extrabold text-sm">{chunkSizeInput || 20} pages</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentVal = parseInt(chunkSizeInput, 10) || 20;
                          const newVal = Math.max(1, currentVal - 5);
                          setChunkSizeInput(String(newVal));
                        }}
                        className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition shrink-0"
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={chunkSizeInput}
                        onChange={(e) => setChunkSizeInput(e.target.value.replace(/[^0-9]/g, ''))}
                        onBlur={() => {
                          if (!chunkSizeInput || parseInt(chunkSizeInput, 10) < 1) {
                            setChunkSizeInput('20');
                          }
                        }}
                        placeholder="20"
                        className="flex-1 h-11 px-3 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-base font-bold text-center focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />

                      <button
                        type="button"
                        onClick={() => {
                          const currentVal = parseInt(chunkSizeInput, 10) || 20;
                          const newVal = Math.min(totalPages, currentVal + 5);
                          setChunkSizeInput(String(newVal));
                        }}
                        className="w-11 h-11 rounded-xl bg-slate-900 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition shrink-0"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick Preset Chips */}
                    <div className="flex gap-1.5 pt-0.5">
                      {['5', '10', '20', '25', '50'].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setChunkSizeInput(sz)}
                          className={`flex-1 py-1.5 rounded-lg border text-xs font-semibold transition ${
                            chunkSizeInput === sz
                              ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-2xs'
                              : 'bg-slate-900/70 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start Page & End Page with Interactive Stepper Controls */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                      <span>Document Page Bounds:</span>
                      <button
                        type="button"
                        onClick={handleResetToFullRange}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset (1 to {totalPages})
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Start Page Stepper */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300 flex justify-between">
                          <span>Start Page:</span>
                          <span className="text-slate-400 text-[10px]">Min: 1</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = parseInt(startPageInput, 10) || 1;
                              const nextVal = Math.max(1, cur - 1);
                              setStartPageInput(String(nextVal));
                            }}
                            className="w-9 h-10 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition shrink-0"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={startPageInput}
                            onChange={(e) => setStartPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                            onBlur={() => {
                              const parsed = parseInt(startPageInput, 10);
                              if (isNaN(parsed) || parsed < 1) {
                                setStartPageInput('1');
                              } else if (parsed > totalPages) {
                                setStartPageInput(String(totalPages));
                              }
                            }}
                            placeholder="1"
                            className="flex-1 h-10 px-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const cur = parseInt(startPageInput, 10) || 1;
                              const maxEnd = parseInt(endPageInput, 10) || totalPages;
                              const nextVal = Math.min(maxEnd, cur + 1);
                              setStartPageInput(String(nextVal));
                            }}
                            className="w-9 h-10 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* End Page Stepper */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-300 flex justify-between">
                          <span>End Page:</span>
                          <span className="text-slate-400 text-[10px]">Max: {totalPages}</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              const cur = parseInt(endPageInput, 10) || totalPages;
                              const minStart = parseInt(startPageInput, 10) || 1;
                              const nextVal = Math.max(minStart, cur - 1);
                              setEndPageInput(String(nextVal));
                            }}
                            className="w-9 h-10 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition shrink-0"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={endPageInput}
                            onChange={(e) => setEndPageInput(e.target.value.replace(/[^0-9]/g, ''))}
                            onBlur={() => {
                              const parsed = parseInt(endPageInput, 10);
                              if (isNaN(parsed) || parsed < 1) {
                                setEndPageInput(String(totalPages));
                              } else if (parsed > totalPages) {
                                setEndPageInput(String(totalPages));
                              }
                            }}
                            placeholder={String(totalPages)}
                            className="flex-1 h-10 px-2 rounded-lg bg-slate-900/90 border border-slate-700 text-white text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const cur = parseInt(endPageInput, 10) || totalPages;
                              const nextVal = Math.min(totalPages, cur + 1);
                              setEndPageInput(String(nextVal));
                            }}
                            className="w-9 h-10 rounded-lg bg-slate-900 hover:bg-slate-700 border border-slate-700 active:scale-95 flex items-center justify-center text-slate-200 transition shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300">
                    Custom Page Ranges:
                  </label>
                  <input
                    type="text"
                    value={customRangesInput}
                    onChange={(e) => setCustomRangesInput(e.target.value)}
                    placeholder="e.g. 1-20, 21-50, 51-100"
                    className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400">
                    Enter comma-separated ranges: <span className="font-mono bg-slate-900 px-1 py-0.5 rounded text-indigo-300">1-20, 21-40, 41-100</span>
                  </p>
                </div>
              )}

              {/* Offset Switch: Start Page = Page 1 */}
              <div className="bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <span>Count Start Page as Page 1 (Offset Index)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    {resetNumberingAtStart
                      ? `Starting at PDF page ${startPageInput || '1'} will name files as p1-20, p21-40.`
                      : `Files will reflect actual physical PDF page numbers.`}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={resetNumberingAtStart}
                    onChange={(e) => setResetNumberingAtStart(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:bg-indigo-600 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                </label>
              </div>
            </div>

            {/* 2. Smart Naming Section */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-4 space-y-4 shadow-md">
              <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3">
                <FileCheck className="w-4 h-4 text-indigo-400" />
                <h2 className="font-bold text-white text-sm">2. Smart File Naming</h2>
              </div>

              {/* Document / Book Name Input with Zero Pad toggle */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>Document / Book Name:</span>
                  <label className="flex items-center gap-1.5 font-normal cursor-pointer text-[11px] text-slate-400">
                    <input
                      type="checkbox"
                      checked={padZeroes}
                      onChange={(e) => setPadZeroes(e.target.checked)}
                      className="rounded text-indigo-600 bg-slate-900 border-slate-700"
                    />
                    <span>Leading Zeroes (01, 02...)</span>
                  </label>
                </div>

                <input
                  type="text"
                  value={bookName}
                  onChange={(e) => setBookName(e.target.value)}
                  placeholder="Enter book title (e.g. Physics_Class12)"
                  className="w-full h-10 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Dynamic Preset Cards Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Preset 1: Book + Part */}
                <div
                  onClick={() => setNamingPreset('book_part')}
                  className={`p-3 rounded-xl border cursor-pointer transition text-left relative ${
                    namingPreset === 'book_part'
                      ? 'border-indigo-500 bg-indigo-950/70 ring-2 ring-indigo-500/50 shadow-md'
                      : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white">By Part Number</span>
                    {namingPreset === 'book_part' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono truncate">
                    {getPartFileName(samplePartForCard, plannedParts.length || 5, 'book_part')}
                  </div>
                </div>

                {/* Preset 2: Book + Pages */}
                <div
                  onClick={() => setNamingPreset('book_pages')}
                  className={`p-3 rounded-xl border cursor-pointer transition text-left relative ${
                    namingPreset === 'book_pages'
                      ? 'border-indigo-500 bg-indigo-950/70 ring-2 ring-indigo-500/50 shadow-md'
                      : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white">By Page Range</span>
                    {namingPreset === 'book_pages' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono truncate">
                    {getPartFileName(samplePartForCard, plannedParts.length || 5, 'book_pages')}
                  </div>
                </div>

                {/* Preset 3: Book + Part + Pages */}
                <div
                  onClick={() => setNamingPreset('book_part_pages')}
                  className={`p-3 rounded-xl border cursor-pointer transition text-left relative ${
                    namingPreset === 'book_part_pages'
                      ? 'border-indigo-500 bg-indigo-950/70 ring-2 ring-indigo-500/50 shadow-md'
                      : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white">Part + Pages</span>
                    {namingPreset === 'book_part_pages' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono truncate">
                    {getPartFileName(samplePartForCard, plannedParts.length || 5, 'book_part_pages')}
                  </div>
                </div>

                {/* Preset 4: Part Only */}
                <div
                  onClick={() => setNamingPreset('part_only')}
                  className={`p-3 rounded-xl border cursor-pointer transition text-left relative ${
                    namingPreset === 'part_only'
                      ? 'border-indigo-500 bg-indigo-950/70 ring-2 ring-indigo-500/50 shadow-md'
                      : 'border-slate-700/80 bg-slate-900/50 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-white">Simple Part Only</span>
                    {namingPreset === 'part_only' && (
                      <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-indigo-300 font-mono truncate">
                    {getPartFileName(samplePartForCard, plannedParts.length || 5, 'part_only')}
                  </div>
                </div>
              </div>

              {/* Custom Formula Option */}
              <div
                onClick={() => setNamingPreset('custom')}
                className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                  namingPreset === 'custom'
                    ? 'border-indigo-500 bg-indigo-950/60 ring-2 ring-indigo-500/50'
                    : 'border-slate-700/80 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-bold text-white">Custom Formula Editor</span>
                  </div>
                  {namingPreset === 'custom' && (
                    <span className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                  )}
                </div>

                {namingPreset === 'custom' && (
                  <div className="mt-3 space-y-2.5 pt-2 border-t border-slate-700/60" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={customTemplate}
                      onChange={(e) => setCustomTemplate(e.target.value)}
                      placeholder="{book}_Part_{part}_p{start}-p{end}"
                      className="w-full h-9 px-3 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                    />

                    {/* Tag Insertion Buttons */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { tag: '{book}', label: '+ Book' },
                        { tag: '{part}', label: '+ Part' },
                        { tag: '{start}', label: '+ Start' },
                        { tag: '{end}', label: '+ End' },
                        { tag: '{total_parts}', label: '+ Total Parts' },
                        { tag: '{pages}', label: '+ Page Count' }
                      ].map((item) => (
                        <button
                          key={item.tag}
                          type="button"
                          onClick={() => setCustomTemplate((prev) => prev + item.tag)}
                          className="text-[10px] font-mono bg-slate-800 hover:bg-indigo-900/80 text-indigo-300 px-2 py-1 rounded-md border border-slate-700 transition active:scale-95"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <span>Live Preview:</span>
                      <span className="font-mono text-emerald-400 font-bold">
                        {getPartFileName(samplePartForCard, plannedParts.length || 5, 'custom')}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Generated Split Preview Section */}
            <div className="bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-700 p-4 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-400" />
                  <h2 className="font-bold text-white text-sm">
                    3. Output Preview ({plannedParts.length} Parts)
                  </h2>
                </div>
                <span className="text-[11px] text-indigo-300 font-bold bg-indigo-950/80 border border-indigo-700/60 px-2.5 py-0.5 rounded-full">
                  {chunkSizeInput || 20} Pages/part
                </span>
              </div>

              {/* Parts List */}
              <div className="space-y-2">
                {plannedParts.map((part) => {
                  const fileName = getPartFileName(part, plannedParts.length);
                  return (
                    <div
                      key={part.index}
                      className="p-3 rounded-xl bg-slate-900/80 border border-slate-700/70 flex items-center justify-between gap-3 hover:border-slate-600 transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-700/60 text-xs font-bold flex items-center justify-center shrink-0">
                          #{padZeroes && plannedParts.length >= 10 ? String(part.index).padStart(2, '0') : part.index}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white font-mono truncate">
                            {fileName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Pages: <span className="font-bold text-indigo-400">p{part.logicalStart}-{part.logicalEnd}</span> • ({part.pageCount} pages)
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => downloadSinglePart(part)}
                        disabled={isProcessing}
                        className="text-xs font-bold text-indigo-300 bg-slate-800 hover:bg-indigo-950 border border-slate-700 hover:border-indigo-600 px-3 py-1.5 rounded-lg shrink-0 transition flex items-center gap-1 active:scale-95"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Save
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Processing Progress Bar */}
              {isProcessing && (
                <div className="p-3.5 bg-indigo-950/80 border border-indigo-700/80 rounded-xl space-y-2 animate-pulse mt-3">
                  <div className="flex justify-between text-xs font-bold text-indigo-200">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                      {progress.text || 'Processing document...'}
                    </span>
                    <span>
                      {progress.total > 0
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : ''}
                    </span>
                  </div>
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-indigo-800/50">
                    <div
                      className="bg-gradient-to-r from-indigo-500 to-violet-500 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Sticky Bottom Export Bar */}
      {file && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-4 py-3 shadow-2xl">
          <div className="w-full max-w-xl mx-auto">
            <button
              onClick={handleSplitAndDownloadAll}
              disabled={isProcessing || plannedParts.length === 0}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 active:from-indigo-700 active:to-violet-700 text-white font-bold text-sm shadow-xl shadow-indigo-600/30 transition flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              <FolderArchive className="w-5 h-5" />
              {isProcessing
                ? 'Packaging & Saving ZIP...'
                : `Download All as ZIP (${plannedParts.length} Parts)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
