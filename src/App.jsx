import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Settings,
  Hash,
  BookOpen,
  Sparkles,
  RefreshCw,
  FolderArchive,
  ArrowRight,
  Sliders,
  FileCheck,
  Smartphone,
  Eye,
  Trash2,
  Copy,
  Info
} from 'lucide-react';

export default function App() {
  // File state
  const [file, setFile] = useState(null);
  const [fileBuffer, setFileBuffer] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Split configurations
  const [splitMode, setSplitMode] = useState('chunk'); // 'chunk' or 'ranges'
  const [chunkSize, setChunkSize] = useState(20);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(100);
  const [resetNumberingAtStart, setResetNumberingAtStart] = useState(true);
  const [customRangesInput, setCustomRangesInput] = useState('');

  // Naming configurations
  const [bookName, setBookName] = useState('');
  const [namingPreset, setNamingPreset] = useState('book_part'); 
  // 'book_part', 'book_pages', 'book_part_pages', 'custom'
  const [customTemplate, setCustomTemplate] = useState('{book}_Part_{part}');
  const [padZeroes, setPadZeroes] = useState(true);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, text: '' });
  const [isSuccess, setIsSuccess] = useState(false);
  const [customNamesMap, setCustomNamesMap] = useState({});
  const [showApkModal, setShowApkModal] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);

  // PWA install prompt support
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstallable(false);
      }
    }
  };

  const fileInputRef = useRef(null);

  // Generate a sample 100-page PDF in memory for instant testing
  const handleLoadDemoPdf = async () => {
    setIsLoadingPdf(true);
    setErrorMessage('');
    try {
      const pdfDoc = await PDFDocument.create();
      // Add 100 demo pages quickly
      for (let i = 1; i <= 100; i++) {
        const page = pdfDoc.addPage([595, 842]);
        page.drawText(`Sample Book - Page ${i}`, {
          x: 50,
          y: 800,
          size: 20,
        });
        page.drawText(`Yeh 100 pages ki demo book ka Page ${i} hai.\nPDF Splitter Pro test karne ke liye banaya gaya hai.`, {
          x: 50,
          y: 750,
          size: 14,
        });
      }
      const pdfBytes = await pdfDoc.save();
      const demoBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const demoFile = new File([demoBlob], 'Maths_Book_100_Pages.pdf', { type: 'application/pdf' });

      setFile(demoFile);
      setFileBuffer(pdfBytes.buffer);
      setTotalPages(100);
      setStartPage(5); // default to page 5 as requested by user
      setEndPage(100);
      setBookName('Maths_Book');
      setChunkSize(20);
      setResetNumberingAtStart(true);
      setCustomNamesMap({});
      setIsSuccess(false);
    } catch (err) {
      console.error(err);
      setErrorMessage('Sample PDF generate karne me error: ' + err.message);
    } finally {
      setIsLoadingPdf(false);
    }
  };

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
      setStartPage(1);
      setEndPage(pagesCount);

      // Clean default book name from file name (remove extension and sanitize)
      const rawName = selectedFile.name.replace(/\.[^/.]+$/, '').trim();
      const cleanName = rawName.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'Book';
      setBookName(cleanName);
      setCustomNamesMap({});
      setIsSuccess(false);
    } catch (err) {
      console.error(err);
      setErrorMessage('PDF file padhne me samasya aayi. Kripya check karein file corrupt to nahi.');
    } finally {
      setIsLoadingPdf(false);
    }
  };

  // Calculate planned parts based on current settings
  const plannedParts = useMemo(() => {
    if (!totalPages || totalPages <= 0) return [];

    const effectiveStart = Math.max(1, Math.min(startPage || 1, totalPages));
    const effectiveEnd = Math.max(effectiveStart, Math.min(endPage || totalPages, totalPages));

    const parts = [];

    if (splitMode === 'chunk') {
      const size = Math.max(1, parseInt(chunkSize, 10) || 20);
      let currentStart = effectiveStart;
      let partIndex = 1;

      while (currentStart <= effectiveEnd) {
        const currentEnd = Math.min(currentStart + size - 1, effectiveEnd);
        const pageCount = currentEnd - currentStart + 1;

        // Logical page numbers (if offset is applied, e.g. startPage is 5, then physical 5 is logical 1)
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
      // Custom ranges mode, e.g., "1-20, 21-40, 41-100"
      const ranges = customRangesInput
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);

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
  }, [totalPages, startPage, endPage, splitMode, chunkSize, customRangesInput, resetNumberingAtStart]);

  // Compute filename for a part
  const getPartFileName = (part, totalParts) => {
    // If manually overridden by user
    if (customNamesMap[part.index]) {
      return customNamesMap[part.index].endsWith('.pdf')
        ? customNamesMap[part.index]
        : `${customNamesMap[part.index]}.pdf`;
    }

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

  // Helper to extract a single PDF part as Uint8Array
  const extractPdfPart = async (sourcePdfDoc, part) => {
    const newPdf = await PDFDocument.create();
    // 0-indexed page indices in pdf-lib
    const pageIndices = [];
    for (let p = part.physicalStart; p <= part.physicalEnd; p++) {
      pageIndices.push(p - 1);
    }
    const copiedPages = await newPdf.copyPages(sourcePdfDoc, pageIndices);
    copiedPages.forEach((page) => newPdf.addPage(page));
    return await newPdf.save();
  };

  // Download a single part
  const downloadSinglePart = async (part) => {
    if (!fileBuffer) return;
    setIsProcessing(true);
    setProgress({ current: 1, total: 1, text: `Generating ${getPartFileName(part, plannedParts.length)}...` });

    try {
      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      const pdfBytes = await extractPdfPart(srcDoc, part);
      const fileName = getPartFileName(part, plannedParts.length);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      saveAs(blob, fileName);
    } catch (err) {
      console.error(err);
      alert('Error extracting part: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Split and download all as a ZIP archive
  const handleSplitAndDownloadAll = async () => {
    if (!fileBuffer || plannedParts.length === 0) return;

    setIsProcessing(true);
    setIsSuccess(false);
    const total = plannedParts.length;

    try {
      const zip = new JSZip();
      const folderName = `${(bookName || 'Splitted_PDF').trim()}_parts`;
      const rootFolder = zip.folder(folderName);

      const srcDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });

      for (let i = 0; i < total; i++) {
        const part = plannedParts[i];
        const fileName = getPartFileName(part, total);

        setProgress({
          current: i + 1,
          total,
          text: `Processing Part ${i + 1} of ${total}: ${fileName}`,
        });

        const partBytes = await extractPdfPart(srcDoc, part);
        rootFolder.file(fileName, partBytes);

        // Small yield so browser UI remains responsive
        await new Promise((resolve) => setTimeout(resolve, 20));
      }

      setProgress({
        current: total,
        total,
        text: 'Creating ZIP archive and preparing download...',
      });

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
      alert('Error during batch split: ' + err.message);
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
    setCustomNamesMap({});
  };

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-800 pb-20">
      {/* Mobile-Friendly App Header */}
      <header className="sticky top-0 z-30 bg-indigo-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              <Split className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-1.5 leading-snug">
                PDF Splitter Pro
                <span className="text-[10px] bg-indigo-500/80 px-2 py-0.5 rounded-full font-semibold border border-indigo-400/30">
                  Android & Web
                </span>
              </h1>
              <p className="text-xs text-indigo-200">100% Private & Offline (Fast Browser Engine)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (deferredPrompt) {
                  handleInstallClick();
                } else {
                  setShowApkModal(true);
                }
              }}
              className="flex items-center gap-1.5 text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition active:scale-95"
            >
              <Smartphone className="w-3.5 h-3.5" />
              1-Click Install App
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Prominent 1-Click Install Banner */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white p-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 border border-indigo-500/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20">
              <Smartphone className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                Mobile Phone me 1-Click Install Karein
                <span className="text-[10px] bg-emerald-500/90 text-white font-bold px-2 py-0.5 rounded-full">
                  Fast & Offline
                </span>
              </div>
              <div className="text-xs text-indigo-100">
                Play Store ki zaroorat nahi — seedha aapke phone me install ho jayegi
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              if (deferredPrompt) {
                handleInstallClick();
              } else {
                setShowApkModal(true);
              }
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5 shrink-0"
          >
            <Smartphone className="w-4 h-4" />
            Install / QR Code Dekhein
          </button>
        </div>

        {/* Step 1: Upload PDF */}
        {!file ? (
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileChange(e.dataTransfer.files[0]);
              }
            }}
            className={`bg-white rounded-2xl shadow-sm border p-6 md:p-10 text-center transition-all ${
              isDragging ? 'border-indigo-500 bg-indigo-50/40 ring-4 ring-indigo-500/10' : 'border-slate-200/80'
            }`}
          >
            <div className="max-w-md mx-auto space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100 shadow-sm">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Select PDF</h2>
                <p className="text-sm text-slate-500 mt-1">
                  100+ pages ki book upload karein. File aate hi 20-20 pages ke parts aur <strong>Download</strong> ka option samne aa jayega!
                </p>
              </div>

              <div className="space-y-3">
                {/* Primary Select PDF Button with native file picker overlay */}
                <div className="relative">
                  <input
                    id="pdf-file-picker"
                    type="file"
                    accept="application/pdf,.pdf"
                    onClick={(e) => {
                      e.currentTarget.value = '';
                    }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                    disabled={isLoadingPdf}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full inline-flex items-center justify-center px-6 py-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-base shadow-md shadow-indigo-200 transition pointer-events-none">
                    <FileText className="w-5 h-5 mr-2" />
                    {isLoadingPdf ? 'PDF Check ho rahi hai...' : 'Select PDF'}
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                  <span>ya phir</span>
                </div>

                {/* Instant 100 Page Demo Button */}
                <button
                  type="button"
                  onClick={handleLoadDemoPdf}
                  disabled={isLoadingPdf}
                  className="w-full inline-flex items-center justify-center px-4 py-3 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-indigo-700 font-semibold text-xs transition active:scale-[0.99]"
                >
                  <Sparkles className="w-4 h-4 mr-1.5 text-indigo-600" />
                  1-Click Demo: 100-Page Sample Book Load Karein (Instant Test)
                </button>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-left">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step indicator guide */}
              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-xl text-left text-xs text-amber-800 space-y-1">
                <div className="font-bold flex items-center gap-1 text-amber-900">
                  <Info className="w-3.5 h-3.5" />
                  Download Button Kahan Hai?
                </div>
                <p>
                  Jaise hi aap <strong>"Select PDF"</strong> ya <strong>"1-Click Demo"</strong> par click karenge, turant niche <strong>"Download All as ZIP"</strong> aur har 20-page part ka alag <strong>"Download"</strong> button display ho jayega!
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-left">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-indigo-600 font-bold text-sm">20-20 Pages</div>
                  <div className="text-[11px] text-slate-500">Auto Split in equal parts</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-indigo-600 font-bold text-sm">Start Index</div>
                  <div className="text-[11px] text-slate-500">Page 5 ko Page 1 maano</div>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <div className="text-indigo-600 font-bold text-sm">Smart Names</div>
                  <div className="text-[11px] text-slate-500">Auto rename + ZIP download</div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            {/* Active File Card */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 md:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base leading-snug break-all line-clamp-1">
                    {file.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {totalPages} Total Pages
                    </span>
                    <span>•</span>
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleReset}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
              >
                <Trash2 className="w-4 h-4" />
                Change File
              </button>
            </section>

            {/* Split Settings Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-slate-900 text-base">1. Split & Page Range Settings</h2>
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                  <button
                    onClick={() => setSplitMode('chunk')}
                    className={`px-3 py-1 rounded-md transition ${
                      splitMode === 'chunk'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Equal Chunks (20 Pages)
                  </button>
                  <button
                    onClick={() => setSplitMode('ranges')}
                    className={`px-3 py-1 rounded-md transition ${
                      splitMode === 'ranges'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Custom Ranges
                  </button>
                </div>
              </div>

              {splitMode === 'chunk' ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pages Per Split */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Pages per Split (Chunk)</span>
                      <span className="text-indigo-600 font-semibold">{chunkSize} pages</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max={totalPages}
                        value={chunkSize}
                        onChange={(e) => setChunkSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        placeholder="20"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      {[10, 20, 25, 50].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setChunkSize(sz)}
                          className={`text-[11px] px-2 py-0.5 rounded border transition font-medium ${
                            chunkSize === sz
                              ? 'bg-indigo-50 text-indigo-600 border-indigo-200 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start From Page */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>Start from Page (PDF Index)</span>
                      <span className="text-slate-400 font-normal">e.g. 5 (Skip Cover/Index)</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={startPage}
                      onChange={(e) => setStartPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500">Pages 1 to {Math.max(1, startPage - 1)} will be skipped</p>
                  </div>

                  {/* End Page */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>End at Page</span>
                      <span className="text-slate-400 font-normal">Max: {totalPages}</span>
                    </label>
                    <input
                      type="number"
                      min={startPage}
                      max={totalPages}
                      value={endPage}
                      onChange={(e) => setEndPage(Math.min(totalPages, parseInt(e.target.value, 10) || totalPages))}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <p className="text-[11px] text-slate-500">Till end of document</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">
                    Custom Page Ranges (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={customRangesInput}
                    onChange={(e) => setCustomRangesInput(e.target.value)}
                    placeholder="e.g. 1-20, 21-45, 46-80, 81-100"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500">
                    Example: Write <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">5-25, 26-50, 51-100</span> to split into specific custom sections.
                  </p>
                </div>
              )}

              {/* Offset Numbering Feature (Special user requirement!) */}
              <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-3.5 flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-900">
                      Reset Page Numbering from Start Page (Offset Mode)
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {resetNumberingAtStart ? (
                      <>
                        Agar PDF page <span className="font-bold text-indigo-700">{startPage}</span> se start ho rahi hai, to file ke naam me use <span className="font-bold text-indigo-700">Page 1</span> ginenge (1 se 20, fir 21 se 40).
                      </>
                    ) : (
                      <>
                        File ke naam me PDF ke original physical page numbers dikhenge ({startPage} to {Math.min(startPage + chunkSize - 1, endPage)}).
                      </>
                    )}
                  </p>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-0.5">
                  <input
                    type="checkbox"
                    checked={resetNumberingAtStart}
                    onChange={(e) => setResetNumberingAtStart(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </section>

            {/* Smart Naming Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                <h2 className="font-bold text-slate-900 text-base">2. Smart File Naming Options</h2>
              </div>

              {/* Book Base Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Book / Document Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={bookName}
                    onChange={(e) => setBookName(e.target.value)}
                    placeholder="Enter book name (e.g. Physics_12)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={padZeroes}
                      onChange={(e) => setPadZeroes(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Leading Zeroes (01, 02)</span>
                  </label>
                </div>
              </div>

              {/* Naming Style Radio Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">Naming Pattern Format</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Option 1: Book + Part */}
                  <div
                    onClick={() => setNamingPreset('book_part')}
                    className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                      namingPreset === 'book_part'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">By Part Number</div>
                    <div className="text-[11px] text-indigo-600 font-mono mt-1 break-all">
                      {bookName || 'Book'}_Part_1.pdf
                    </div>
                  </div>

                  {/* Option 2: Book + Pages */}
                  <div
                    onClick={() => setNamingPreset('book_pages')}
                    className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                      namingPreset === 'book_pages'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">By Page Range</div>
                    <div className="text-[11px] text-indigo-600 font-mono mt-1 break-all">
                      {bookName || 'Book'}_Pages_1-20.pdf
                    </div>
                  </div>

                  {/* Option 3: Book + Part + Pages */}
                  <div
                    onClick={() => setNamingPreset('book_part_pages')}
                    className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                      namingPreset === 'book_part_pages'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Part + Page Range</div>
                    <div className="text-[11px] text-indigo-600 font-mono mt-1 break-all">
                      {bookName || 'Book'}_Part_1_p1-20.pdf
                    </div>
                  </div>

                  {/* Option 4: Custom Template */}
                  <div
                    onClick={() => setNamingPreset('custom')}
                    className={`p-3 rounded-xl border cursor-pointer transition text-left ${
                      namingPreset === 'custom'
                        ? 'border-indigo-500 bg-indigo-50/50 ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">Custom Template</div>
                    <div className="text-[11px] text-indigo-600 font-mono mt-1 break-all">
                      Custom Formula
                    </div>
                  </div>
                </div>

                {/* If Custom Selected, show template editor */}
                {namingPreset === 'custom' && (
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-2">
                    <div className="text-xs font-semibold text-slate-700">Custom Template Formula:</div>
                    <input
                      type="text"
                      value={customTemplate}
                      onChange={(e) => setCustomTemplate(e.target.value)}
                      placeholder="{book}_Part_{part}_p{start}-p{end}"
                      className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:border-indigo-500"
                    />
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] text-slate-500">Click to insert:</span>
                      {['{book}', '{part}', '{start}', '{end}', '{total_parts}', '{pages}'].map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setCustomTemplate((prev) => prev + chip)}
                          className="text-[11px] font-mono bg-white hover:bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-slate-200 hover:border-indigo-200 transition"
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Generated Parts Preview Table */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 md:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-indigo-600" />
                  <h2 className="font-bold text-slate-900 text-base">
                    3. Generated Split Preview ({plannedParts.length} Files)
                  </h2>
                </div>
                <div className="text-xs text-slate-500 font-medium">
                  Har file ka naam preview me check karein
                </div>
              </div>

              {plannedParts.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm">
                  Koi parts nahi bane. Kripya chunk size ya page range check karein.
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {plannedParts.map((part) => {
                    const fileName = getPartFileName(part, plannedParts.length);
                    return (
                      <div
                        key={part.index}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                            #{part.index}
                          </span>
                          <div>
                            <div className="text-xs md:text-sm font-semibold text-slate-900 font-mono flex items-center gap-1.5">
                              <span>{fileName}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                              <span>
                                Physical: <strong className="text-slate-700">p{part.physicalStart}-{part.physicalEnd}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Logical Book: <strong className="text-indigo-600">p{part.logicalStart}-{part.logicalEnd}</strong>
                              </span>
                              <span>•</span>
                              <span>{part.pageCount} pages</span>
                            </div>
                          </div>
                        </div>

                        {/* Individual Part Download Button */}
                        <button
                          onClick={() => downloadSinglePart(part)}
                          disabled={isProcessing}
                          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 px-3 py-1.5 rounded-lg shadow-2xs transition flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Progress Bar (Visible during processing) */}
              {isProcessing && (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2 animate-pulse">
                  <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                    <span className="flex items-center gap-1.5">
                      <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                      {progress.text || 'Splitting PDFs in memory...'}
                    </span>
                    <span>
                      {progress.total > 0
                        ? `${Math.round((progress.current / progress.total) * 100)}%`
                        : ''}
                    </span>
                  </div>
                  <div className="w-full bg-indigo-200/70 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          progress.total > 0
                            ? Math.round((progress.current / progress.total) * 100)
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Success Notification */}
              {isSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  <div>
                    Sabhi {plannedParts.length} PDFs successfully split ho chuki hain aur ZIP download start ho gaya hai! Check your Downloads folder.
                  </div>
                </div>
              )}

              {/* Big Action Download Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSplitAndDownloadAll}
                  disabled={isProcessing || plannedParts.length === 0}
                  className="flex-1 py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-indigo-200 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FolderArchive className="w-5 h-5" />
                  {isProcessing
                    ? 'Processing & Packing...'
                    : `Download All as ZIP (${plannedParts.length} PDFs)`}
                </button>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Mobile / APK Info Modal */}
      {showApkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-base">
                <Smartphone className="w-5 h-5" />
                Mobile me kaise chalaye / App kaise banaye?
              </div>
              <button
                onClick={() => setShowApkModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold px-2 py-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 max-h-[75vh] overflow-y-auto pr-1">
              {/* Option 1: QR Code scan from phone */}
              <div className="p-4 bg-indigo-50/80 border border-indigo-100 rounded-2xl text-center space-y-3">
                <div className="font-bold text-indigo-950 text-sm flex items-center justify-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-indigo-600" />
                  Phone Camera se QR Code Scan Karein
                </div>
                <div className="p-2 bg-white rounded-xl shadow-xs inline-block border border-indigo-100">
                  <img
                    src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=http%3A%2F%2F10.70.178.85%3A3000"
                    alt="Scan to Install on Mobile"
                    className="w-36 h-36 mx-auto block"
                  />
                </div>
                <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                  Apne phone ka Camera is QR code par laayein, link open hoga aur <strong>"Install app"</strong> dabate hi seedha phone me app save ho jayegi!
                </p>

                {/* Direct Link & Copy button */}
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 p-2 bg-white rounded-lg font-mono text-indigo-700 font-bold border border-indigo-200 text-center text-xs overflow-hidden select-all">
                    http://10.70.178.85:3000
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText('http://10.70.178.85:3000');
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shrink-0 transition"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              </div>

              {/* Option 2: Direct Install on this device */}
              {deferredPrompt && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="font-bold text-emerald-900 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Is Device me 1-Click Install Ready hai!
                  </div>
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Smartphone className="w-4 h-4" />
                    Abhi Install Karein (1-Click)
                  </button>
                </div>
              )}

              {/* Option 3: APK build info */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div className="font-bold text-slate-900 text-xs">
                  📦 Standalone .APK File (Offline Installer)
                </div>
                <p className="text-[11px] text-slate-500">
                  Project me <strong>GitHub Actions</strong> (.github/workflows/build-apk.yml) file ready hai. GitHub repo me push karte hi 2 minute me free me <strong>app-debug.apk</strong> file build hokar download ho jati hai.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowApkModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition"
            >
              Samajh Gaya / Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

