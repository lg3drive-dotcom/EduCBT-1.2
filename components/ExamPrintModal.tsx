import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Question, QuestionType, AppSettings } from '../types.ts';
import MathText from './MathText.tsx';
import { fetchQuestionsByToken } from '../services/supabaseService.ts';
import { generateStandardExamPDF } from '../services/pdfService.ts';

interface ExamPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  questions: Question[];
  initialToken?: string;
  appSettings?: AppSettings;
}

export interface ExamHeaderConfig {
  institutionName: string;
  schoolName: string;
  schoolAddress: string;
  examTitle: string;
  academicYear: string;
  subjectName: string;
  className: string;
  examDate: string;
  timeAllocation: string;
  showOfficialKop: boolean;
  showInstructions: boolean;
  paperSize: 'A4' | 'F4';
  fontSize: 'compact' | 'normal' | 'large';
  optionsLayout: '1-col' | '2-col';
}

const STORAGE_KEY_KOP = 'epro_cbt_exam_kop_config';

const DEFAULT_HEADER_CONFIG: ExamHeaderConfig = {
  institutionName: 'PEMERINTAH KABUPATEN / KOTA\nDINAS PENDIDIKAN',
  schoolName: 'UPTD SATUAN PENDIDIKAN FORMAL',
  schoolAddress: 'Jl. Pendidikan No. 1 • NPSN: - • Telp: -',
  examTitle: 'ASESMEN SUMATIF AKHIR SEMESTER (ASAS)',
  academicYear: 'TAHUN PELAJARAN 2025/2026',
  subjectName: 'MATA PELAJARAN',
  className: 'Kelas VI (Enam)',
  examDate: new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  timeAllocation: '90 Menit',
  showOfficialKop: true,
  showInstructions: true,
  paperSize: 'A4',
  fontSize: 'normal',
  optionsLayout: '2-col'
};

const ExamPrintModal: React.FC<ExamPrintModalProps> = ({
  isOpen,
  onClose,
  questions,
  initialToken,
  appSettings
}) => {
  // Load saved kop from localStorage if available
  const [headerConfig, setHeaderConfig] = useState<ExamHeaderConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_KOP);
      if (saved) {
        return { ...DEFAULT_HEADER_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      // fallback
    }
    return DEFAULT_HEADER_CONFIG;
  });

  const [selectedToken, setSelectedToken] = useState<string>(initialToken || '');
  const [printMode, setPrintMode] = useState<'student' | 'master' | 'key_only' | 'ljk'>('student');
  const [activeTab, setActiveTab] = useState<'preview' | 'settings'>('preview');
  const [isFetchingCloud, setIsFetchingCloud] = useState(false);
  const [cloudQuestions, setCloudQuestions] = useState<Question[] | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Available unique tokens from questions
  const availableTokensWithCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of questions) {
      if (!q.isDeleted && q.quizToken) {
        const t = q.quizToken.trim().toUpperCase();
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries()).map(([token, count]) => ({ token, count }));
  }, [questions]);

  // Set initial token if provided or default to the first available token
  useEffect(() => {
    if (initialToken) {
      setSelectedToken(initialToken.trim().toUpperCase());
    } else if (!selectedToken && availableTokensWithCount.length > 0) {
      setSelectedToken(availableTokensWithCount[0].token);
    }
  }, [initialToken, availableTokensWithCount]);

  // Sync subject and duration when selected token changes
  useEffect(() => {
    if (!selectedToken) return;
    const tokenQuestions = questions.filter(
      q => !q.isDeleted && q.quizToken?.trim().toUpperCase() === selectedToken
    );
    if (tokenQuestions.length > 0) {
      const first = tokenQuestions[0];
      setHeaderConfig(prev => ({
        ...prev,
        subjectName: first.subject || prev.subjectName || 'Ujian Digital',
        timeAllocation: appSettings?.timerMinutes ? `${appSettings.timerMinutes} Menit` : prev.timeAllocation
      }));
    }
  }, [selectedToken, questions, appSettings]);

  // Save kop config when updated
  const updateHeaderConfig = (updates: Partial<ExamHeaderConfig>) => {
    setHeaderConfig(prev => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY_KOP, JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  // Filtered questions for the selected token
  const tokenQuestions: Question[] = useMemo(() => {
    if (cloudQuestions && cloudQuestions.length > 0) {
      return cloudQuestions;
    }
    if (!selectedToken) return [];
    return questions
      .filter(q => !q.isDeleted && q.quizToken?.trim().toUpperCase() === selectedToken.trim().toUpperCase())
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [selectedToken, questions, cloudQuestions]);

  // Fetch from Supabase cloud if token has 0 questions locally
  const handleFetchFromCloud = async () => {
    if (!selectedToken.trim()) return;
    setIsFetchingCloud(true);
    try {
      const fetched = await fetchQuestionsByToken(selectedToken.trim().toUpperCase());
      if (fetched && fetched.length > 0) {
        setCloudQuestions(fetched);
        if (fetched[0]?.subject) {
          setHeaderConfig(prev => ({ ...prev, subjectName: fetched[0].subject }));
        }
      } else {
        alert(`Tidak ada soal ditemukan di Cloud untuk token "${selectedToken}".`);
      }
    } catch (err: any) {
      alert(`Gagal mengambil soal dari server: ${err.message}`);
    } finally {
      setIsFetchingCloud(false);
    }
  };

  // Group questions by type for neat exam sectioning
  const categorizedQuestions = useMemo(() => {
    const single = tokenQuestions.filter(q => q.type === QuestionType.SINGLE);
    const multiple = tokenQuestions.filter(q => q.type === QuestionType.MULTIPLE);
    const trueFalse = tokenQuestions.filter(q => q.type === QuestionType.TRUE_FALSE);
    const match = tokenQuestions.filter(q => q.type === QuestionType.MATCH);
    const others = tokenQuestions.filter(
      q => q.type !== QuestionType.SINGLE &&
           q.type !== QuestionType.MULTIPLE &&
           q.type !== QuestionType.TRUE_FALSE &&
           q.type !== QuestionType.MATCH
    );
    return { single, multiple, trueFalse, match, others, total: tokenQuestions.length };
  }, [tokenQuestions]);

  // Handle native browser print
  const handleNativePrint = () => {
    if (!printAreaRef.current) return;
    
    // Create hidden iframe for pure, isolated print
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (!doc) return;

    // Get html content from printAreaRef
    const content = printAreaRef.current.innerHTML;

    // Build print HTML document with standard school styling
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${headerConfig.examTitle} - ${headerConfig.subjectName} (${selectedToken})</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: ${headerConfig.paperSize === 'F4' ? '215mm 330mm' : 'A4'};
              margin: 15mm 15mm 15mm 15mm;
            }
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              font-size: ${headerConfig.fontSize === 'compact' ? '10pt' : headerConfig.fontSize === 'large' ? '12pt' : '11pt'};
              line-height: 1.35;
              color: #000;
              background: #fff;
              margin: 0;
              padding: 0;
            }
            .kop-container {
              text-align: center;
              margin-bottom: 8px;
            }
            .kop-header {
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 16px;
              margin-bottom: 6px;
            }
            .kop-title {
              font-size: 13pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              line-height: 1.25;
            }
            .kop-school {
              font-size: 15pt;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.8px;
              line-height: 1.2;
              margin: 2px 0;
            }
            .kop-address {
              font-size: 8.5pt;
              font-style: italic;
              color: #222;
              line-height: 1.2;
            }
            .kop-divider {
              border-top: 3px double #000;
              margin: 8px 0 12px 0;
            }
            .exam-banner {
              text-align: center;
              margin-bottom: 12px;
            }
            .exam-banner-title {
              font-size: 12pt;
              font-weight: bold;
              text-transform: uppercase;
              text-decoration: underline;
            }
            .exam-banner-year {
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
            }
            .table-identity {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5pt;
              margin-bottom: 12px;
            }
            .table-identity td {
              padding: 2.5px 4px;
              vertical-align: top;
            }
            .instructions-box {
              border: 1px solid #333;
              padding: 6px 10px;
              font-size: 8.5pt;
              margin-bottom: 14px;
              border-radius: 4px;
              background-color: #fafafa;
            }
            .instructions-box ol {
              margin: 3px 0 0 18px;
              padding: 0;
            }
            .section-header {
              font-weight: bold;
              font-size: 10pt;
              text-transform: uppercase;
              background-color: #e5e5e5;
              padding: 4px 8px;
              border: 1px solid #000;
              margin: 12px 0 8px 0;
              page-break-after: avoid;
            }
            .question-item {
              margin-bottom: 12px;
              page-break-inside: avoid;
              display: flex;
              gap: 8px;
              align-items: flex-start;
            }
            .q-num {
              font-weight: bold;
              width: 22px;
              flex-shrink: 0;
              text-align: right;
            }
            .q-body {
              flex: 1;
            }
            .q-text {
              margin-bottom: 6px;
            }
            .q-image {
              max-width: 260px;
              max-height: 180px;
              display: block;
              margin: 6px 0;
              border: 1px solid #ddd;
            }
            .options-grid {
              display: grid;
              gap: 4px 14px;
              margin-top: 6px;
            }
            .grid-1-col {
              grid-template-columns: 1fr;
            }
            .grid-2-col {
              grid-template-columns: 1fr 1fr;
            }
            .opt-item {
              display: flex;
              gap: 6px;
              align-items: flex-start;
              font-size: 10pt;
            }
            .opt-letter {
              font-weight: bold;
              width: 18px;
              flex-shrink: 0;
            }
            .key-badge {
              font-weight: bold;
              color: #047857;
              background: #d1fae5;
              padding: 1px 5px;
              border-radius: 3px;
              font-size: 8pt;
              margin-left: 6px;
              display: inline-block;
            }
            .table-match {
              width: 100%;
              border-collapse: collapse;
              margin-top: 6px;
              font-size: 9pt;
            }
            .table-match th, .table-match td {
              border: 1px solid #000;
              padding: 4px 8px;
            }
            .table-match th {
              background-color: #f0f0f0;
              text-align: center;
              font-weight: bold;
            }
            .essay-lines {
              margin-top: 6px;
              border-bottom: 1px dotted #888;
              height: 20px;
            }
            .key-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9.5pt;
              margin-top: 10px;
            }
            .key-table th, .key-table td {
              border: 1px solid #000;
              padding: 5px 8px;
              text-align: center;
            }
            .key-table th {
              background-color: #f0f0f0;
            }
            .footer-info {
              text-align: right;
              font-size: 8pt;
              font-style: italic;
              color: #666;
              margin-top: 20px;
              border-top: 1px solid #ccc;
              padding-top: 4px;
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    doc.close();

    // Trigger print once iframe loaded
    printFrame.contentWindow?.focus();
    setTimeout(() => {
      printFrame.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 400);
  };

  // Handle direct PDF generation via jsPDF
  const handleDownloadPdf = async () => {
    if (tokenQuestions.length === 0) {
      alert("Tidak ada soal untuk dicetak pada token ini.");
      return;
    }
    setIsDownloadingPdf(true);
    try {
      await generateStandardExamPDF(tokenQuestions, headerConfig, printMode, selectedToken);
    } catch (err: any) {
      alert(`Gagal membuat PDF: ${err.message}`);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[2.5rem] w-full max-w-6xl h-[92vh] max-h-[900px] overflow-hidden shadow-2xl flex flex-col border border-slate-200">
        
        {/* Top Header Bar */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/30">
              🖨️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg tracking-tight">Cetak Naskah Soal Ujian Sekolah</h3>
                <span className="bg-blue-500/20 text-blue-300 text-[10px] font-black px-2.5 py-0.5 rounded-full border border-blue-400/30 uppercase tracking-wider">
                  Standar Nasional
                </span>
              </div>
              <p className="text-slate-400 text-xs font-medium">
                Format resmi sesuai sistematika penulisan naskah ujian sekolah (Kop, Petunjuk, Soal & Kunci)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNativePrint}
              disabled={tokenQuestions.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              title="Cetak langsung ke printer atau Simpan PDF lewat browser"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>CETAK / PRINT</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={tokenQuestions.length === 0 || isDownloadingPdf}
              className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
              title="Unduh langsung sebagai file dokumen PDF"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>{isDownloadingPdf ? 'MENYUSUN...' : 'UNDUH PDF'}</span>
            </button>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors ml-2"
              title="Tutup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Controls & Configuration Toolbar */}
        <div className="bg-slate-100 p-3 sm:px-6 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Token Selector */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Pilih Token:</label>
            <div className="relative">
              <select
                value={selectedToken}
                onChange={(e) => {
                  setSelectedToken(e.target.value);
                  setCloudQuestions(null);
                }}
                className="bg-white border-2 border-slate-200 text-slate-800 text-xs font-black rounded-xl px-3 py-2 outline-none focus:border-blue-600 pr-8 uppercase"
              >
                {availableTokensWithCount.length === 0 && (
                  <option value="">(Belum ada token soal)</option>
                )}
                {availableTokensWithCount.map(({ token, count }) => (
                  <option key={token} value={token}>
                    {token} ({count} Soal)
                  </option>
                ))}
              </select>
            </div>

            {/* Input custom token if needed */}
            <input
              type="text"
              placeholder="Atau ketik token..."
              value={selectedToken}
              onChange={(e) => {
                setSelectedToken(e.target.value.toUpperCase());
                setCloudQuestions(null);
              }}
              className="w-36 bg-white border-2 border-slate-200 text-slate-800 text-xs font-black rounded-xl px-3 py-2 outline-none focus:border-blue-600 uppercase"
            />

            {tokenQuestions.length === 0 && selectedToken && (
              <button
                type="button"
                onClick={handleFetchFromCloud}
                disabled={isFetchingCloud}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
              >
                {isFetchingCloud ? 'Mencari...' : 'Tarik dari Cloud'}
              </button>
            )}

            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-xl text-xs font-black">
              Total: {tokenQuestions.length} Soal
            </div>
          </div>

          {/* Mode Selector (Student vs Master Teacher vs Key) */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setPrintMode('student')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                printMode === 'student' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📄 Naskah Siswa
            </button>
            <button
              onClick={() => setPrintMode('master')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                printMode === 'master' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              🔑 Master & Kunci
            </button>
            <button
              onClick={() => setPrintMode('key_only')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                printMode === 'key_only' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📊 Tabel Kunci
            </button>
            <button
              onClick={() => setPrintMode('ljk')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${
                printMode === 'ljk' ? 'bg-amber-600 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              📝 Lembar Jawab (LJK)
            </button>
          </div>

          {/* Tab Switcher: Preview vs Header Customization */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'preview' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              👁️ Pratinjau Kertas
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'settings' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-200'
              }`}
            >
              ⚙️ Pengaturan Kop
            </button>
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-hidden flex bg-slate-200">
          
          {/* TAB 1: PREVIEW KERTAS UJIAN */}
          {activeTab === 'preview' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center custom-scrollbar">
              
              {/* Paper Sheet Container (A4 / F4 simulation) */}
              <div
                ref={printAreaRef}
                className="bg-white text-slate-900 shadow-2xl p-8 sm:p-12 w-full max-w-[210mm] min-h-[297mm] border border-slate-300 font-serif"
                style={{
                  fontSize: headerConfig.fontSize === 'compact' ? '10pt' : headerConfig.fontSize === 'large' ? '12pt' : '11pt',
                  lineHeight: '1.4'
                }}
              >
                
                {/* 1. KOP NASKAH SOAL RESMI */}
                {headerConfig.showOfficialKop && (
                  <div className="mb-4 text-center">
                    <div className="flex items-center justify-between pb-2 border-b-4 border-double border-slate-900">
                      {/* Logo Instansi Kiri */}
                      <div className="w-16 h-16 rounded-xl border border-slate-200 flex items-center justify-center p-1 bg-slate-50 shrink-0">
                        <svg className="w-12 h-12 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z M5 13.18v4L12 21l7-3.82v-4L12 17 5 13.18z"/>
                        </svg>
                      </div>

                      {/* Teks Kop Surat */}
                      <div className="flex-1 px-4 text-center">
                        <p className="font-bold text-[11pt] tracking-wider uppercase leading-tight whitespace-pre-line">
                          {headerConfig.institutionName}
                        </p>
                        <h2 className="font-black text-[14pt] tracking-wider uppercase leading-tight my-1 text-slate-950">
                          {headerConfig.schoolName}
                        </h2>
                        <p className="text-[8.5pt] italic text-slate-700 leading-tight">
                          {headerConfig.schoolAddress}
                        </p>
                      </div>

                      {/* Logo Pendidikan Kanan */}
                      <div className="w-16 h-16 rounded-xl border border-slate-200 flex items-center justify-center p-1 bg-slate-50 shrink-0">
                        <svg className="w-12 h-12 text-slate-700" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2L2 7l10 5 10-5-10-5zm0 8.5L4.5 7 12 3.5 19.5 7 12 10.5z M3 10.5v6.2c0 2.5 4 4.3 9 4.3s9-1.8 9-4.3v-6.2L12 15 3 10.5z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. JUDUL UJIAN & IDENTITAS */}
                <div className="text-center mb-4">
                  <h3 className="font-black text-[12pt] uppercase tracking-wide underline underline-offset-4 text-slate-950">
                    {headerConfig.examTitle}
                  </h3>
                  <p className="font-bold text-[10pt] uppercase text-slate-800 mt-0.5">
                    {headerConfig.academicYear}
                  </p>
                </div>

                {/* 3. TABEL IDENTITAS MATA PELAJARAN & PESERTA */}
                <table className="w-full text-[9.5pt] mb-4 border-collapse font-sans">
                  <tbody>
                    <tr>
                      <td className="w-28 py-0.5 font-bold text-slate-800">Mata Pelajaran</td>
                      <td className="w-3 py-0.5">:</td>
                      <td className="py-0.5 font-black text-slate-950 uppercase">{headerConfig.subjectName}</td>
                      <td className="w-28 py-0.5 font-bold text-slate-800">Hari, Tanggal</td>
                      <td className="w-3 py-0.5">:</td>
                      <td className="py-0.5 text-slate-900">{headerConfig.examDate}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-800">Kelas / Fase</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 text-slate-900">{headerConfig.className}</td>
                      <td className="py-0.5 font-bold text-slate-800">Alokasi Waktu</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 text-slate-900">{headerConfig.timeAllocation}</td>
                    </tr>
                    <tr>
                      <td className="py-0.5 font-bold text-slate-800">Kode / Token</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 font-black text-blue-700 uppercase tracking-widest">{selectedToken || '-'}</td>
                      <td className="py-0.5 font-bold text-slate-800">Nama Peserta</td>
                      <td className="py-0.5">:</td>
                      <td className="py-0.5 text-slate-400 border-b border-dotted border-slate-400">................................................</td>
                    </tr>
                  </tbody>
                </table>

                {/* 4. PETUNJUK UMUM STANDAR UJIAN SEKOLAH */}
                {headerConfig.showInstructions && (
                  <div className="border border-slate-700 rounded p-2.5 mb-5 text-[8.5pt] bg-slate-50/50 font-sans">
                    <p className="font-black uppercase tracking-wider text-slate-900 mb-1">PETUNJUK UMUM:</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-slate-800 leading-relaxed pl-1">
                      <li>Berdoalah terlebih dahulu sebelum mulai mengerjakan soal.</li>
                      <li>Tulislah nama, nomor peserta, dan kelas pada lembar jawaban yang telah disediakan.</li>
                      <li>Periksa dan bacalah setiap butir soal dengan cermat dan saksama sebelum menjawab.</li>
                      <li>Dahulukan menjawab soal-soal yang Anda anggap lebih mudah.</li>
                      <li>Laporkan kepada pengawas ujian apabila terdapat naskah soal yang kurang jelas, rusak, atau jumlah halaman tidak lengkap.</li>
                      <li>Periksalah kembali seluruh pekerjaan Anda sebelum diserahkan kepada pengawas ujian.</li>
                    </ol>
                  </div>
                )}

                {/* MODE 1 & 2: BUTIR SOAL (SISWA ATAU MASTER GURU) */}
                {(printMode === 'student' || printMode === 'master') && (
                  <div className="space-y-5">
                    {tokenQuestions.length === 0 ? (
                      <div className="py-16 text-center text-slate-400">
                        <p className="font-bold text-base">Tidak ada soal pada token ini.</p>
                        <p className="text-xs mt-1">Silakan pilih token yang memiliki bank soal aktif.</p>
                      </div>
                    ) : (
                      tokenQuestions.map((q, idx) => {
                        const questionNumber = q.order || idx + 1;
                        return (
                          <div key={q.id || idx} className="question-item flex gap-2.5 items-start text-justify">
                            {/* Nomor Soal */}
                            <span className="font-bold text-[10.5pt] w-6 shrink-0 text-right">
                              {questionNumber}.
                            </span>

                            {/* Isi Soal */}
                            <div className="flex-1 min-w-0">
                              
                              {/* Master Teacher Badge Info */}
                              {printMode === 'master' && (
                                <div className="mb-1.5 flex flex-wrap gap-1 font-sans text-[8pt] text-slate-500 font-bold">
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200">
                                    {q.type}
                                  </span>
                                  {q.level && (
                                    <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                                      {q.level}
                                    </span>
                                  )}
                                  {q.material && (
                                    <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                                      Materi: {q.material}
                                    </span>
                                  )}
                                </div>
                              )}

                              {/* Gambar Soal Atas (Jika ada) */}
                              {q.questionImage && (
                                <div className="mb-2">
                                  <img
                                    src={q.questionImage}
                                    alt={`Gambar Soal Atas ${questionNumber}`}
                                    className="max-w-[320px] max-h-[190px] object-contain border border-slate-300 rounded"
                                  />
                                </div>
                              )}

                              {/* Teks Soal / Stimulus */}
                              <div className="text-[10.5pt] text-slate-900 leading-relaxed mb-1.5">
                                <MathText text={q.text} />
                              </div>

                              {/* Gambar Soal Bawah (Jika ada, sebelum opsi) */}
                              {q.bottomImage && (
                                <div className="my-2">
                                  <img
                                    src={q.bottomImage}
                                    alt={`Gambar Soal Bawah ${questionNumber}`}
                                    className="max-w-[320px] max-h-[190px] object-contain border border-slate-300 rounded"
                                  />
                                </div>
                              )}

                              {/* PILIHAN GANDA (SINGLE CHOICE) */}
                              {q.type === QuestionType.SINGLE && q.options && q.options.length > 0 && (
                                <div
                                  className={`mt-2 grid gap-1.5 ${
                                    headerConfig.optionsLayout === '2-col' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
                                  }`}
                                >
                                  {q.options.map((opt, optIdx) => {
                                    const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                                    const isCorrect = q.correctAnswer === optIdx;
                                    return (
                                      <div
                                        key={optIdx}
                                        className={`flex items-start gap-1.5 text-[10pt] ${
                                          printMode === 'master' && isCorrect ? 'font-bold text-emerald-800' : 'text-slate-800'
                                        }`}
                                      >
                                        <span className={`w-5 font-bold ${printMode === 'master' && isCorrect ? 'text-emerald-700' : ''}`}>
                                          {letter}.
                                        </span>
                                        <div className="flex-1">
                                          <MathText text={opt} />
                                          {printMode === 'master' && isCorrect && (
                                            <span className="ml-2 text-[8pt] font-sans bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black border border-emerald-300">
                                              ✓ KUNCI
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* PILIHAN JAMAK / KOMPLEKS (MCMA) */}
                              {q.type === QuestionType.MULTIPLE && q.options && q.options.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-[8.5pt] italic text-slate-600 font-sans mb-1">
                                    *(Berilah tanda centang [✓] pada setiap pilihan yang benar!)
                                  </p>
                                  {q.options.map((opt, optIdx) => {
                                    const isCorrect = Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optIdx);
                                    return (
                                      <div key={optIdx} className="flex items-start gap-2 text-[10pt]">
                                        <span className="w-4 h-4 border border-slate-700 flex items-center justify-center text-[9pt] font-bold shrink-0 mt-0.5">
                                          {printMode === 'master' && isCorrect ? '✓' : ''}
                                        </span>
                                        <div className="flex-1">
                                          <MathText text={opt} />
                                          {printMode === 'master' && isCorrect && (
                                            <span className="ml-2 text-[8pt] font-sans bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-black border border-emerald-300">
                                              ✓ BENAR
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {/* BENAR / SALAH ATAU SESUAI / TIDAK SESUAI (TABEL) */}
                              {(q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH) && q.options && (
                                <div className="mt-2.5 overflow-x-auto">
                                  <table className="w-full text-[9pt] border border-slate-900 border-collapse font-sans">
                                    <thead>
                                      <tr className="bg-slate-100">
                                        <th className="border border-slate-900 p-1 text-center w-8">No</th>
                                        <th className="border border-slate-900 p-1 text-left">Pernyataan</th>
                                        <th className="border border-slate-900 p-1 text-center w-16">
                                          {q.tfLabels?.true || 'Benar'}
                                        </th>
                                        <th className="border border-slate-900 p-1 text-center w-16">
                                          {q.tfLabels?.false || 'Salah'}
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {q.options.map((statement, sIdx) => {
                                        const ans = Array.isArray(q.correctAnswer) ? q.correctAnswer[sIdx] : null;
                                        const optImg = q.optionImages?.[sIdx];
                                        return (
                                          <tr key={sIdx}>
                                            <td className="border border-slate-900 p-1 text-center align-top">{sIdx + 1}</td>
                                            <td className="border border-slate-900 p-1">
                                              <div>
                                                {statement && <MathText text={statement} />}
                                                {optImg && (
                                                  <div className="mt-1">
                                                    <img src={optImg} alt={`Pernyataan ${sIdx + 1}`} className="max-h-24 max-w-xs object-contain border border-slate-300 rounded" />
                                                  </div>
                                                )}
                                              </div>
                                            </td>
                                            <td className="border border-slate-900 p-1 text-center font-bold align-middle">
                                              {printMode === 'master' && ans === true ? '✓' : ''}
                                            </td>
                                            <td className="border border-slate-900 p-1 text-center font-bold align-middle">
                                              {printMode === 'master' && ans === false ? '✓' : ''}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {/* PEMBAHASAN / ALASAN JAWABAN (HANYA DI MODE MASTER GURU) */}
                              {printMode === 'master' && q.explanation && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[9pt] font-sans text-amber-900">
                                  <b>💡 Pembahasan / Pedoman Penskoran:</b> {q.explanation}
                                </div>
                              )}

                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* MODE 3: TABEL KUNCI JAWABAN LENGKAP */}
                {printMode === 'key_only' && (
                  <div className="space-y-4">
                    <div className="text-center font-bold uppercase tracking-wider text-sm border-b pb-2">
                      LEMBAR KUNCI JAWABAN DAN PEDOMAN PENILAIAN
                    </div>
                    <table className="w-full text-[9.5pt] border border-slate-900 border-collapse font-sans text-center">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="border border-slate-900 p-2 w-12">No</th>
                          <th className="border border-slate-900 p-2 w-28">Tipe Soal</th>
                          <th className="border border-slate-900 p-2">Kunci Jawaban</th>
                          <th className="border border-slate-900 p-2 w-24">Level</th>
                          <th className="border border-slate-900 p-2 w-16">Bobot</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tokenQuestions.map((q, idx) => {
                          let keyText = '-';
                          if (q.type === QuestionType.SINGLE) {
                            keyText = q.correctAnswer !== undefined ? String.fromCharCode(65 + q.correctAnswer) : '-';
                          } else if (q.type === QuestionType.MULTIPLE) {
                            keyText = Array.isArray(q.correctAnswer)
                              ? q.correctAnswer.map(i => String.fromCharCode(65 + i)).join(', ')
                              : '-';
                          } else if (q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH) {
                            if (Array.isArray(q.correctAnswer)) {
                              const tLabel = q.tfLabels?.true || 'B';
                              const fLabel = q.tfLabels?.false || 'S';
                              keyText = q.correctAnswer
                                .map((v, i) => `${i + 1}:${v === true ? tLabel : v === false ? fLabel : '-'}`)
                                .join(' | ');
                            }
                          }

                          return (
                            <tr key={idx} className={idx % 2 === 1 ? 'bg-slate-50' : ''}>
                              <td className="border border-slate-900 p-1.5 font-bold">{q.order || idx + 1}</td>
                              <td className="border border-slate-900 p-1.5 text-xs text-slate-700">{q.type}</td>
                              <td className="border border-slate-900 p-1.5 font-black text-emerald-800 text-sm">
                                {keyText}
                              </td>
                              <td className="border border-slate-900 p-1.5 text-xs text-slate-600">{q.level || '-'}</td>
                              <td className="border border-slate-900 p-1.5 font-bold">1</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* MODE 4: LEMBAR JAWAB UJIAN (LJK MINI STANDAR) */}
                {printMode === 'ljk' && (
                  <div className="space-y-4">
                    <div className="text-center font-bold uppercase tracking-wider text-sm border-b pb-2">
                      LEMBAR JAWABAN PESERTA UJIAN (LJK MANUAL)
                    </div>
                    <div className="grid grid-cols-2 gap-4 font-sans text-xs mb-3">
                      <div className="border border-slate-400 p-3 rounded space-y-2">
                        <p>NAMA PESERTA : .............................................................</p>
                        <p>NOMOR PESERTA: .............................................................</p>
                        <p>KELAS / ROMBEL: .............................................................</p>
                      </div>
                      <div className="border border-slate-400 p-3 rounded space-y-2">
                        <p>MATA PELAJARAN: {headerConfig.subjectName}</p>
                        <p>HARI, TANGGAL : {headerConfig.examDate}</p>
                        <p>PARAF PENGAWAS: .............................................................</p>
                      </div>
                    </div>

                    <p className="text-[9pt] italic font-sans text-slate-600">
                      *Silang (X) atau lingkarilah huruf pilihan jawaban yang Anda anggap paling tepat!
                    </p>

                    {/* Grid Kotak Jawaban Siswa 1-50 */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-sans text-[10pt]">
                      {tokenQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-center justify-between border border-slate-200 p-1 rounded">
                          <span className="font-bold w-6">{idx + 1}.</span>
                          <div className="flex gap-1 font-bold text-slate-700">
                            <span className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[8pt]">A</span>
                            <span className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[8pt]">B</span>
                            <span className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[8pt]">C</span>
                            <span className="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[8pt]">D</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer Kertas Ujian */}
                <div className="mt-12 pt-3 border-t border-slate-400 flex items-center justify-between text-[8pt] text-slate-500 font-sans">
                  <span>Dokumen Ujian Resmi • {headerConfig.schoolName}</span>
                  <span>Token: {selectedToken} • Halaman 1 dari 1</span>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: PENGATURAN KOP & FORMAT CETAK */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 max-w-3xl mx-auto custom-scrollbar">
              <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-md border border-slate-200 space-y-6">
                <div>
                  <h4 className="text-xl font-black text-slate-800">Pengaturan Kop Surat & Lembar Naskah</h4>
                  <p className="text-slate-500 text-xs font-medium mt-1">
                    Sesuaikan identitas sekolah dan ujian. Konfigurasi ini tersimpan otomatis di perangkat Anda.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Nama Instansi / Dinas Pendidikan (Baris 1 & 2)
                    </label>
                    <textarea
                      rows={2}
                      value={headerConfig.institutionName}
                      onChange={(e) => updateHeaderConfig({ institutionName: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Nama Satuan Pendidikan / Sekolah (Baris 3 - Huruf Besar)
                    </label>
                    <input
                      type="text"
                      value={headerConfig.schoolName}
                      onChange={(e) => updateHeaderConfig({ schoolName: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600 uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                      Alamat Lengkap Sekolah & Kontak (Baris 4)
                    </label>
                    <input
                      type="text"
                      value={headerConfig.schoolAddress}
                      onChange={(e) => updateHeaderConfig({ schoolAddress: e.target.value })}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Judul Asesmen / Ujian
                      </label>
                      <input
                        type="text"
                        value={headerConfig.examTitle}
                        onChange={(e) => updateHeaderConfig({ examTitle: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600 uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Tahun Pelajaran
                      </label>
                      <input
                        type="text"
                        value={headerConfig.academicYear}
                        onChange={(e) => updateHeaderConfig({ academicYear: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600 uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Mata Pelajaran
                      </label>
                      <input
                        type="text"
                        value={headerConfig.subjectName}
                        onChange={(e) => updateHeaderConfig({ subjectName: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600 uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Kelas / Rombel
                      </label>
                      <input
                        type="text"
                        value={headerConfig.className}
                        onChange={(e) => updateHeaderConfig({ className: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Alokasi Waktu
                      </label>
                      <input
                        type="text"
                        value={headerConfig.timeAllocation}
                        onChange={(e) => updateHeaderConfig({ timeAllocation: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Tata Letak Pilihan Ganda
                      </label>
                      <select
                        value={headerConfig.optionsLayout}
                        onChange={(e: any) => updateHeaderConfig({ optionsLayout: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600"
                      >
                        <option value="2-col">2 Kolom (Hemat Kertas - Rekomendasi)</option>
                        <option value="1-col">1 Kolom (Vertikal Berderet ke Bawah)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
                        Ukuran Teks Naskah
                      </label>
                      <select
                        value={headerConfig.fontSize}
                        onChange={(e: any) => updateHeaderConfig({ fontSize: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-600"
                      >
                        <option value="compact">Kecil / Ringkas (10pt - Hemat Kertas)</option>
                        <option value="normal">Standar Ujian (11pt - Times New Roman)</option>
                        <option value="large">Besar (12pt)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={headerConfig.showOfficialKop}
                        onChange={(e) => updateHeaderConfig({ showOfficialKop: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Tampilkan Kop Surat Resmi</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={headerConfig.showInstructions}
                        onChange={(e) => updateHeaderConfig({ showInstructions: e.target.checked })}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span>Tampilkan Petunjuk Umum</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={() => setActiveTab('preview')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-black text-xs px-6 py-3 rounded-xl shadow-lg transition-all"
                  >
                    Simpan & Lihat Pratinjau →
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ExamPrintModal;
