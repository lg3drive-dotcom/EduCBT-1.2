
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Question, Subject, StudentIdentity, QuizResult, AppSettings, QuestionType, CognitiveLevel, ExternalLinks } from './types.ts';
import { INITIAL_QUESTIONS } from './constants.ts';
import QuizInterface from './components/QuizInterface.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import QuestionManager from './components/QuestionManager.tsx';
import AdminSettings from './components/AdminSettings.tsx';
import ConfirmIdentity from './components/ConfirmIdentity.tsx';
import AdminGuide from './components/AdminGuide.tsx';
import ExamPrintModal from './components/ExamPrintModal.tsx';
import { generateResultPDF } from './services/pdfService.ts';
import { exportSubmissionsToExcel, exportMultiSheetAnalysis } from './services/excelService.ts';
import { 
  pushQuestionsToCloud, 
  updateLiveSettings, 
  getLiveExamData, 
  submitResultToCloud,
  getGlobalSettings,
  fetchAllQuestions,
  fetchSubmissionsByToken,
  fetchQuestionsByToken
} from './services/supabaseService.ts';

import { 
  getDeviceStudents, 
  saveDeviceStudent, 
  removeDeviceStudent, 
  copyToClipboard, 
  DeviceStudent 
} from './utils.ts';
import { GEMINI_QUESTION_PROMPT_TEMPLATE } from './constants/aiPrompt.ts';

type ViewMode = 'login' | 'confirm-data' | 'quiz' | 'result' | 'admin-auth' | 'admin-panel' | 'analysis-panel';
type AdminSubView = 'bank-soal' | 'admin-pusat';

const DEFAULT_LINKS: ExternalLinks = {
  passwordHelp: 'https://lynk.id/edupreneur25/n3yqk5e4er64',
  aiGenerator: 'https://ai.studio/apps/drive/13CnHs1wO_wbrWZYjpbUDvJ0ZKsTA1z0E?fullscreenApplet=true',
  aiAnalysis: 'https://ai.studio/apps/drive/1afFf_jTM-k2WAA_dnF9ZYxR_LJ_0lQLr?fullscreenApplet=true',
  adminEmailDisplay: 'asepsukanta25@guru.sd.belajar.id'
};

const PUSAT_SECRET_CODE = 'Indme&781l';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  const [adminSubView, setAdminSubView] = useState<AdminSubView>('bank-soal');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'dirty'>('idle');
  const [pullStatus, setPullStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [sidebarPromptCopied, setSidebarPromptCopied] = useState(false);

  const handleCopyPromptSidebar = async () => {
    const success = await copyToClipboard(GEMINI_QUESTION_PROMPT_TEMPLATE);
    if (success) {
      setSidebarPromptCopied(true);
      setTimeout(() => setSidebarPromptCopied(false), 2500);
    }
  };
  
  // Security States for Admin Pusat
  const [showPusatLock, setShowPusatLock] = useState(false);
  const [pusatInputCode, setPusatInputCode] = useState('');
  const [isPusatUnlocked, setIsPusatUnlocked] = useState(false);

  // Invalid Token Modal States
  const [showInvalidTokenModal, setShowInvalidTokenModal] = useState(false);
  const [invalidTokenEntered, setInvalidTokenEntered] = useState('');
  const [waNumberCopied, setWaNumberCopied] = useState(false);

  // Global Exam Print Modal State
  const [isGlobalPrintOpen, setIsGlobalPrintOpen] = useState(false);

  // Quick Recap States
  const [quickDownloadToken, setQuickDownloadToken] = useState('');
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);
  
  // Full Data States
  const [fullDownloadToken, setFullDownloadToken] = useState('');
  const [fullDownloadSchool, setFullDownloadSchool] = useState('');
  const [isFullDownloading, setIsFullDownloading] = useState(false);

  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem('cbt_admin_pass') || 'admin123';
  });

  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('cbt_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cbt_settings');
    const base = saved ? JSON.parse(saved) : { timerMinutes: 60 };
    return {
      ...base,
      externalLinks: base.externalLinks || DEFAULT_LINKS
    };
  });

  const [identity, setIdentity] = useState<StudentIdentity>({ 
    name: '', 
    className: '', 
    schoolOrigin: '', 
    birthDate: '', 
    token: '' 
  });
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    localStorage.setItem('cbt_questions', JSON.stringify(questions));
    if (syncStatus === 'success') setSyncStatus('dirty');
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('cbt_settings', JSON.stringify(settings));
    if (syncStatus === 'success') setSyncStatus('dirty');
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('cbt_admin_pass', adminPassword);
  }, [adminPassword]);

  useEffect(() => {
    // We removed automatic sync with cloud on mount to respect the user's request
    // for manual sync only. Settings and questions are now strictly local (localStorage)
    // until the user clicks "TARIK DATA SERVER" or "KIRIM KE CLOUD".
    setSyncStatus('idle');
  }, []);

  const handleCloudSync = async () => {
    if (questions.length === 0 && adminSubView === 'bank-soal') {
      const confirmClear = confirm("Bank soal lokal kosong. Kirim data kosong ke Cloud (Akan menghapus semua soal di server)?");
      if (!confirmClear) return;
    }

    setSyncStatus('loading');
    try {
      await pushQuestionsToCloud(questions);
      await updateLiveSettings({ ...settings, adminPassword });
      setSyncStatus('success');
      setLastSyncedAt(new Date().toLocaleTimeString());
    } catch (err: any) {
      setSyncStatus('error');
      alert(`GAGAL SINKRONISASI!\n\nPesan: ${err.message}`);
    }
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    if (newSettings.adminPassword) {
      setAdminPassword(newSettings.adminPassword);
    }
  };

  const handleDeleteQuestionsByTokens = (tokens: string[]) => {
    const cleanTokens = tokens.map(t => t.trim().toUpperCase());
    setQuestions(prev => prev.filter(q => !q.quizToken || !cleanTokens.includes(q.quizToken.trim().toUpperCase())));
  };

  const handleRenameToken = (oldToken: string, newToken: string) => {
    const cleanOld = oldToken.trim().toUpperCase();
    const cleanNew = newToken.trim().toUpperCase();
    setQuestions(prev => prev.map(q => {
      if (q.quizToken && q.quizToken.trim().toUpperCase() === cleanOld) {
        return { ...q, quizToken: cleanNew };
      }
      return q;
    }));
  };

  const handleCloudPull = async () => {
    setPullStatus('loading');
    try {
      // Pull questions
      const cloudQs = await fetchAllQuestions();
      setQuestions(cloudQs);
      
      // Also pull global settings (Password, Timer, Links)
      const cloudSettings = await getGlobalSettings();
      if (cloudSettings) {
        if (cloudSettings.adminPassword) {
          setAdminPassword(cloudSettings.adminPassword);
        }
        setSettings(prev => ({
          ...prev,
          timerMinutes: cloudSettings.timerMinutes || prev.timerMinutes,
          externalLinks: {
            ...DEFAULT_LINKS,
            ...(cloudSettings.externalLinks || {})
          }
        }));
      }

      setPullStatus('success');
      setSyncStatus('success');
      setLastSyncedAt(new Date().toLocaleTimeString());
      setTimeout(() => setPullStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Gagal menarik data:", err);
      setPullStatus('error');
      setTimeout(() => setPullStatus('idle'), 3000);
    }
  };

  const handlePusatAccess = () => {
    if (isPusatUnlocked) {
      setAdminSubView('admin-pusat');
      setIsMobileMenuOpen(false);
    } else {
      setShowPusatLock(true);
    }
  };

  const verifyPusatCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (pusatInputCode === PUSAT_SECRET_CODE) {
      setIsPusatUnlocked(true);
      setAdminSubView('admin-pusat');
      setShowPusatLock(false);
      setPusatInputCode('');
      setIsMobileMenuOpen(false);
    } else {
      alert("KODE AKSES SALAH!");
      setPusatInputCode('');
    }
  };

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = identity.token.trim().toUpperCase();
    const npsn = identity.schoolOrigin.trim();

    if (!npsn) return alert('Masukkan NPSN!');
    if (!/^\d+$/.test(npsn) || npsn.length !== 8) {
      return alert('NPSN harus diisi dengan angka dan berjumlah tepat 8 karakter!');
    }
    
    if (!token) return alert('Masukkan Token!');
    setIsSyncing(true);
    try {
      const cloudData = await getLiveExamData(token);
      if (!cloudData) { 
        // Cek juga apakah paket soal ada di memori bank soal lokal
        const localMatch = questions.filter(q => !q.isDeleted && q.quizToken?.trim().toUpperCase() === token);
        if (localMatch.length > 0) {
          if (identity.name.trim()) {
            saveDeviceStudent({
              name: identity.name,
              className: identity.className,
              schoolOrigin: identity.schoolOrigin,
              birthDate: identity.birthDate
            });
            setDeviceStudents(getDeviceStudents());
          }
          setSettings(prev => ({ ...prev, activeSubject: localMatch[0].subject || 'Ujian Digital' }));
          setQuestions(localMatch);
          setView('confirm-data');
          return;
        }

        // Jika tidak ditemukan di cloud maupun lokal, munculkan popup pemberitahuan
        setInvalidTokenEntered(token);
        setShowInvalidTokenModal(true);
        return; 
      }
      if (identity.name.trim()) {
        saveDeviceStudent({
          name: identity.name,
          className: identity.className,
          schoolOrigin: identity.schoolOrigin,
          birthDate: identity.birthDate
        });
        setDeviceStudents(getDeviceStudents());
      }
      setSettings(cloudData.settings);
      setQuestions(cloudData.questions);
      setView('confirm-data');
    } catch (err: any) { 
      // Jika terjadi kendala koneksi ke server, cek bank soal lokal terlebih dahulu
      const localMatch = questions.filter(q => !q.isDeleted && q.quizToken?.trim().toUpperCase() === token);
      if (localMatch.length > 0) {
        if (identity.name.trim()) {
          saveDeviceStudent({
            name: identity.name,
            className: identity.className,
            schoolOrigin: identity.schoolOrigin,
            birthDate: identity.birthDate
          });
          setDeviceStudents(getDeviceStudents());
        }
        setSettings(prev => ({ ...prev, activeSubject: localMatch[0].subject || 'Ujian Digital' }));
        setQuestions(localMatch);
        setView('confirm-data');
        return;
      }
      
      // Munculkan popup jika token tidak ditemukan / terjadi kesalahan token
      setInvalidTokenEntered(token);
      setShowInvalidTokenModal(true);
    }
    finally { setIsSyncing(false); }
  };

  const handleViolation = (reason: string) => {
    if (document.fullscreenElement) document.exitFullscreen();
    alert(`UJIAN DIBATALKAN!\n\n${reason}`);
    setView('login');
    setIdentity({ name: '', className: '', schoolOrigin: '', birthDate: '', token: '' });
  };

  const handleFinishQuiz = async (result: QuizResult) => {
    setIsSyncing(true);
    const response = await submitResultToCloud(result, settings.activeSubject);
    if (response.success) { setLastResult(result); setView('result'); }
    else alert(`GAGAL MENGIRIM KE SERVER!\n\n` + `Pesan Error: ${response.error}`);
    setIsSyncing(false);
  };

  const handleQuickDownloadRecap = async () => {
    if (!quickDownloadToken.trim()) return alert("Silakan masukkan token.");
    setIsQuickDownloading(true);
    try {
      const data = await fetchSubmissionsByToken(quickDownloadToken.toUpperCase());
      if (data && data.length > 0) {
        exportSubmissionsToExcel(data, `Rekap_Ringkas_${quickDownloadToken.toUpperCase()}`, questions);
      } else alert("Data tidak ditemukan.");
    } catch (err: any) { alert(`Error: ${err.message}`); }
    finally { setIsQuickDownloading(false); }
  };

  const handleFullDataDownload = async () => {
    const token = fullDownloadToken.trim().toUpperCase();
    if (!token) return alert("Silakan masukkan token.");
    
    setIsFullDownloading(true);
    try {
      // Ambil jawaban siswa
      let submissions = await fetchSubmissionsByToken(token);
      
      // Filter sekolah jika diisi
      if (fullDownloadSchool.trim()) {
        const schoolFilter = fullDownloadSchool.trim().toLowerCase();
        submissions = submissions.filter(s => (s.school_origin || '').toLowerCase().includes(schoolFilter));
      }

      if (!submissions || submissions.length === 0) {
        alert("Data pengerjaan siswa tidak ditemukan pada token (atau filter sekolah) tersebut.");
        setIsFullDownloading(false);
        return;
      }

      // Ambil bank soal dari cloud untuk referensi kunci & pembahasan
      const cloudQuestions = await fetchQuestionsByToken(token);
      if (!cloudQuestions || cloudQuestions.length === 0) {
        alert("Bank soal untuk token ini tidak ditemukan di cloud. Harap pastikan soal sudah di-sinkron.");
        setIsFullDownloading(false);
        return;
      }

      // Jalankan ekspor multi-sheet
      const fileName = `Analisis_EProCBT_${token}_${fullDownloadSchool.trim() ? fullDownloadSchool.replace(/\s+/g, '_') : 'SEMUA'}`;
      exportMultiSheetAnalysis(submissions, cloudQuestions, fileName);
      
      alert("Laporan Analisis Multi-Sheet (.xlsx) berhasil dibuat.");
    } catch (err: any) { 
      alert(`Gagal membuat laporan: ${err.message}`); 
    } finally { 
      setIsFullDownloading(false); 
    }
  };

  const handleImportQuestions = (imported: Question[], mode: 'append' | 'replace' = 'append') => {
    setQuestions(prev => {
      const existingIds = new Set(prev.map(q => q.id));

      // Hitung urutan (order) tertinggi per token saat ini
      const tokenMaxOrder: { [key: string]: number } = {};
      prev.forEach(q => {
        const t = (q.quizToken || 'UMUM').toUpperCase();
        if ((q.order || 0) > (tokenMaxOrder[t] || 0)) {
          tokenMaxOrder[t] = q.order || 0;
        }
      });

      // Token yang ada pada data impor baru
      const importedTokens = new Set(imported.map(q => (q.quizToken || 'UMUM').toUpperCase()));

      // Jika mode === 'replace', hapus hanya soal-soal lama yang tokennya sama dengan yang diimpor
      const baseList = mode === 'replace'
        ? prev.filter(q => !importedTokens.has((q.quizToken || 'UMUM').toUpperCase()))
        : [...prev];

      // Sanitasi dan pastikan ID anti-bentrok serta auto-order berurutan
      const sanitized: Question[] = [];
      for (const q of imported) {
        const t = (q.quizToken || 'UMUM').toUpperCase();
        const currentMax = tokenMaxOrder[t] || 0;

        // Pastikan ID selalu unik di seluruh database
        let newId = q.id;
        if (!newId || existingIds.has(newId) || mode === 'append') {
          if (!newId || existingIds.has(newId)) {
            newId = `q_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
          }
        }
        existingIds.add(newId);

        // Penomoran urut otomatis (jika order bentrok atau belum diatur)
        let newOrder = Number(q.order);
        if (!newOrder || (mode === 'append' && newOrder <= currentMax)) {
          newOrder = currentMax + 1;
        }
        tokenMaxOrder[t] = Math.max(currentMax, newOrder);

        sanitized.push({
          ...q,
          id: newId,
          order: newOrder,
          quizToken: t,
          bottomImage: q.bottomImage || (q as any).questionImageBottom || (q as any).bottom_image || undefined,
          isDeleted: false,
          createdAt: q.createdAt || Date.now()
        });
      }

      return [...baseList, ...sanitized];
    });
  };

  const [deviceStudents, setDeviceStudents] = useState<DeviceStudent[]>([]);
  const [nameSuggestions, setNameSuggestions] = useState<DeviceStudent[]>([]);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [isManualClass, setIsManualClass] = useState(false);

  useEffect(() => {
    const list = getDeviceStudents();
    setDeviceStudents(list);
  }, [view]);

  const handleNameFocus = () => {
    setIsNameFocused(true);
    const students = getDeviceStudents();
    setDeviceStudents(students);
    const input = identity.name.trim().toLowerCase();
    if (input.length > 0) {
      setNameSuggestions(
        students.filter(s => s.name.toLowerCase().includes(input)).slice(0, 6)
      );
    } else {
      setNameSuggestions(students.slice(0, 6));
    }
  };

  const handleNameChange = (val: string) => {
    setIdentity(prev => ({ ...prev, name: val }));
    const input = val.trim().toLowerCase();
    if (input.length > 0) {
      const filtered = deviceStudents.filter(student =>
        student.name.toLowerCase().includes(input)
      ).slice(0, 6);
      setNameSuggestions(filtered);
    } else {
      setNameSuggestions(deviceStudents.slice(0, 6));
    }
  };

  const selectSuggestion = (student: DeviceStudent) => {
    const standardClasses = ['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B'];
    if (student.className) {
      if (standardClasses.includes(student.className)) {
        setIsManualClass(false);
      } else {
        setIsManualClass(true);
      }
    }

    setIdentity(prev => ({
      ...prev,
      name: student.name,
      className: student.className || prev.className,
      schoolOrigin: student.schoolOrigin || prev.schoolOrigin,
      birthDate: student.birthDate || prev.birthDate
    }));
    setNameSuggestions([]);
    setIsNameFocused(false);
  };

  const handleDeleteDeviceStudent = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    const updated = removeDeviceStudent(name);
    setDeviceStudents(updated);
    setNameSuggestions(prev => prev.filter(s => s.name.toLowerCase() !== name.toLowerCase()));
  };

  const handleNameBlur = () => {
    // Delay hiding suggestions to allow mouse down events on suggestions to fire
    setTimeout(() => {
      setIsNameFocused(false);
      setNameSuggestions([]);
    }, 250);
  };

  const currentLinks = settings.externalLinks || DEFAULT_LINKS;

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-800">
      {view === 'admin-auth' && <AdminLogin onLogin={() => setView('admin-panel')} correctPassword={adminPassword} helpLink={currentLinks.passwordHelp} />}
      
      {view === 'admin-panel' && (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
          {showGuide && <AdminGuide onClose={() => setShowGuide(false)} />}
          
          {showPusatLock && (
            <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6">
              <div className="bg-white rounded-[3rem] p-10 max-md w-full shadow-2xl border border-slate-200 text-center animate-in zoom-in duration-300">
                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Akses Sangat Rahasia</h3>
                <p className="text-slate-500 text-xs font-medium mt-2 mb-8 italic">Masukkan kode khusus untuk membuka panel Admin Pusat.</p>
                <form onSubmit={verifyPusatCode} className="space-y-4">
                  <input 
                    type="password" 
                    value={pusatInputCode}
                    onChange={e => setPusatInputCode(e.target.value)}
                    placeholder="Ketik Kode Akses..." 
                    className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-center font-black outline-none focus:border-red-500 transition-all"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowPusatLock(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Batal</button>
                    <button type="submit" className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">Verifikasi</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <header className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
            <div className="font-black text-xl flex items-center gap-2"><div className="w-6 h-6 bg-blue-600 rounded"></div>E-PRO CBT SERVER</div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/10 rounded-lg">Menu</button>
          </header>

          <aside className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 bg-slate-900 text-white flex-col p-6 lg:sticky top-0 lg:h-screen z-40 transition-all`}>
            <div className="hidden lg:flex font-black text-2xl mb-12 items-center gap-2"><div className="w-8 h-8 bg-blue-600 rounded-lg"></div>E-PRO CBT SERVER</div>
            <nav className="space-y-2 flex-1">
              <button 
                onClick={() => {setAdminSubView('bank-soal'); setIsMobileMenuOpen(false);}}
                className={`w-full text-left p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${adminSubView === 'bank-soal' ? 'bg-white/10 border-l-4 border-blue-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}
              >
                Bank Soal
              </button>
              <button 
                onClick={handlePusatAccess}
                className={`w-full text-left p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all ${adminSubView === 'admin-pusat' ? 'bg-white/10 border-l-4 border-emerald-500 text-white' : 'text-slate-400 hover:bg-white/5'}`}
              >
                Admin Pusat
              </button>
              <a href={currentLinks.aiGenerator} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest text-purple-400 border border-transparent hover:border-purple-500/20 transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Generate Soal AI ✨
              </a>
              <button 
                onClick={handleCopyPromptSidebar}
                className={`w-full flex items-center justify-between p-4 rounded-xl font-bold uppercase text-[10px] tracking-widest transition-all border ${
                  sidebarPromptCopied
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg'
                    : 'text-purple-300 bg-purple-950/20 border-purple-500/20 hover:bg-purple-900/30 hover:text-white'
                }`}
                title="Salin template master prompt pembuat soal untuk Gemini"
              >
                <span className="flex items-center gap-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Salin Prompt Gemini
                </span>
                <span className={`text-[8px] font-black px-2 py-0.5 rounded transition-all ${sidebarPromptCopied ? 'bg-white text-emerald-800' : 'bg-purple-500/30 text-purple-200'}`}>
                  {sidebarPromptCopied ? 'TERSALIN!' : 'COPY'}
                </span>
              </button>
              <button 
                onClick={() => setIsGlobalPrintOpen(true)}
                className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest text-sky-400 border border-transparent hover:border-sky-500/20 transition-all text-left cursor-pointer"
                title="Cetak Naskah Soal Ujian Sekolah Standar Berdasarkan Token"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-sky-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Cetak Naskah Ujian 🖨️</span>
              </button>
              <button onClick={() => setShowGuide(true)} className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest text-emerald-400 border border-transparent hover:border-emerald-500/20 transition-all">Panduan</button>
            </nav>

            <div className="mt-8 lg:mt-auto space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl mb-2">
                 <div className="flex items-center justify-between mb-3">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Server Status</span>
                    <div className="flex items-center gap-1.5">
                       <div className={`w-2 h-2 rounded-full ${
                          syncStatus === 'loading' ? 'bg-blue-400 animate-pulse' :
                          syncStatus === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                          syncStatus === 'dirty' ? 'bg-yellow-500 animate-pulse' :
                          syncStatus === 'error' ? 'bg-red-500' : 'bg-slate-600'
                       }`}></div>
                       <span className={`text-[8px] font-black uppercase ${
                          syncStatus === 'success' ? 'text-green-500' : 
                          syncStatus === 'dirty' ? 'text-yellow-500' : 'text-slate-400'
                       }`}>
                          {syncStatus === 'loading' ? 'Syncing...' : 
                           syncStatus === 'success' ? 'Synced' : 
                           syncStatus === 'dirty' ? 'Local Changes' : 
                           syncStatus === 'error' ? 'Error' : 'Offline'}
                       </span>
                    </div>
                 </div>
                 {lastSyncedAt && (
                    <p className="text-[7px] text-slate-500 font-bold uppercase text-center">Last Sync: {lastSyncedAt}</p>
                 )}
              </div>

              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                 <button 
                   onClick={handleCloudPull} 
                   disabled={pullStatus === 'loading'}
                   className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                     pullStatus === 'loading' ? 'bg-slate-700 cursor-wait' : 
                     pullStatus === 'success' ? 'bg-emerald-500' : 
                     'bg-white/5 hover:bg-white/10'
                   } text-white`}
                 >
                   {pullStatus === 'loading' ? 'MENARIK...' : pullStatus === 'success' ? '✓ DATA DIAMBIL' : 'TARIK DATA SERVER'}
                 </button>
                 
                 <button 
                   onClick={handleCloudSync} 
                   disabled={syncStatus === 'loading'}
                   className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                     syncStatus === 'loading' ? 'bg-blue-400 cursor-wait' : 
                     syncStatus === 'success' ? 'bg-emerald-500' : 
                     syncStatus === 'dirty' ? 'bg-blue-600 shadow-lg' : 
                     'bg-white/10 hover:bg-white/20'
                   } text-white`}
                 >
                   {syncStatus === 'loading' ? 'MENGIRIM...' : syncStatus === 'success' ? '✓ BERHASIL TERKIRIM' : syncStatus === 'dirty' ? 'KIRIM KE CLOUD' : 'KIRIM KE CLOUD'}
                 </button>
              </div>
              <button onClick={() => { setView('login'); setIsPusatUnlocked(false); }} className="w-full p-4 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-all text-left uppercase text-[10px] tracking-widest">Keluar</button>
            </div>
          </aside>

          <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
            {adminSubView === 'bank-soal' ? (
              <QuestionManager 
                questions={questions} 
                activeToken="" 
                onAdd={(q) => setQuestions(prev => [...prev, { ...q, id: Date.now().toString(), isDeleted: false }])} 
                onUpdate={(updated) => setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))} 
                onSoftDelete={(id) => setQuestions(prev => prev.map(item => item.id === id ? { ...item, isDeleted: true } : item))} 
                onPermanentDelete={(id) => setQuestions(prev => prev.filter(item => item.id !== id))} 
                onRestore={(id) => setQuestions(prev => prev.map(item => item.id === id ? { ...item, isDeleted: false } : item))} 
                onImportQuestions={handleImportQuestions}
              />
            ) : (
              <AdminSettings 
                settings={settings}
                questions={questions}
                onUpdateSettings={handleUpdateSettings}
                onImportQuestions={handleImportQuestions}
                onReset={() => setQuestions([])}
                onDeleteQuestionsByTokens={handleDeleteQuestionsByTokens}
                onRenameToken={handleRenameToken}
              />
            )}
          </main>
        </div>
      )}

      {view === 'login' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col-reverse md:flex-row border border-slate-200">
            <div className="md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-12"><div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black">C</div><div className="font-black text-2xl">E-Pro CBT</div></div>
                <h1 className="text-4xl font-black mb-6 leading-tight">Computer Based Test</h1>
              </div>
              <div className="space-y-4">
                <button onClick={() => setView('admin-auth')} className="w-full bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all text-white">Administrator</button>
                <button onClick={() => setView('analysis-panel')} className="w-full bg-blue-600/10 hover:bg-blue-600/20 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-blue-500/30 transition-all text-blue-400">📊 ANALISIS HASIL</button>
                <p className="text-[10px] text-center font-bold text-slate-500 uppercase">{currentLinks.adminEmailDisplay}</p>
              </div>
            </div>
            <div className="md:w-7/12 p-8 lg:p-12 bg-white flex flex-col justify-center">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Login Peserta</h2>
              <p className="text-slate-400 font-medium mb-10 italic">Lengkapi identitas untuk memulai pengerjaan.</p>
              <form onSubmit={handleStartQuiz} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <input 
                      required 
                      type="text" 
                      placeholder="Nama Peserta" 
                      className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" 
                      value={identity.name} 
                      onChange={e => handleNameChange(e.target.value)}
                      onFocus={handleNameFocus}
                      onBlur={handleNameBlur}
                      autoComplete="off"
                    />
                    {isNameFocused && nameSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border-2 border-blue-100 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-100">
                        <div className="px-3.5 py-2 bg-slate-50 flex items-center justify-between text-[10px] font-black text-slate-500 uppercase tracking-wider">
                          <span className="flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Riwayat di Perangkat Ini
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold lowercase">pilih nama</span>
                        </div>
                        <div className="max-h-56 overflow-y-auto">
                          {nameSuggestions.map((student, idx) => (
                            <div
                              key={idx}
                              onMouseDown={() => selectSuggestion(student)}
                              className="w-full px-4 py-2.5 hover:bg-blue-50/80 cursor-pointer transition-colors flex items-center justify-between group text-left border-b last:border-0 border-slate-50"
                            >
                              <div className="flex-1 min-w-0 pr-2">
                                <p className="text-xs font-black text-slate-800 group-hover:text-blue-700 truncate">
                                  {student.name}
                                </p>
                                {(student.className || student.schoolOrigin) && (
                                  <p className="text-[10px] font-bold text-slate-400 truncate">
                                    {student.className ? `Kelas ${student.className}` : ''}
                                    {student.className && student.schoolOrigin ? ' • ' : ''}
                                    {student.schoolOrigin ? `NPSN: ${student.schoolOrigin}` : ''}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onMouseDown={(e) => handleDeleteDeviceStudent(e, student.name)}
                                title="Hapus dari riwayat perangkat"
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    {!isManualClass ? (
                      <>
                        <select 
                          required 
                          className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold appearance-none pr-10"
                          value={identity.className}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'Lainnya') {
                              setIsManualClass(true);
                              setIdentity({...identity, className: ''});
                            } else {
                              setIdentity({...identity, className: val});
                            }
                          }}
                        >
                          <option value="" disabled>Pilih Kelas</option>
                          {['1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B', '5A', '5B', '6A', '6B', 'Lainnya'].map(grade => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </>
                    ) : (
                      <div className="relative">
                        <input 
                          required 
                          autoFocus
                          type="text" 
                          placeholder="Kelas (e.g. 6C)" 
                          className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold pr-12" 
                          value={identity.className} 
                          onChange={e => setIdentity({...identity, className: e.target.value})} 
                        />
                        <button 
                          type="button"
                          onClick={() => setIsManualClass(false)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-red-100 text-red-500 rounded-xl transition-colors"
                          title="Kembali ke daftar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <input 
                  required 
                  type="text" 
                  placeholder="NPSN" 
                  maxLength={8}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" 
                  value={identity.schoolOrigin} 
                  onChange={e => setIdentity({...identity, schoolOrigin: e.target.value})} 
                />
                <div className="relative">
                  <span className="absolute left-4 -top-2.5 px-2 bg-white text-[10px] font-black text-blue-600 uppercase tracking-widest z-10 border border-slate-100 rounded-full">Tanggal Lahir</span>
                  <input required type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-700 min-h-[60px]" value={identity.birthDate} onChange={e => setIdentity({...identity, birthDate: e.target.value})} />
                </div>
                <input required type="text" placeholder="KODE TOKEN" className="w-full p-5 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 text-center uppercase tracking-[0.3em] outline-none" value={identity.token} onChange={e => setIdentity({...identity, token: e.target.value})} />
                <button disabled={isSyncing} className="w-full font-black py-4 rounded-[2rem] text-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xl transition-all">MASUK KE UJIAN</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {view === 'analysis-panel' && (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
          <div className="bg-white rounded-[4rem] p-12 max-w-5xl w-full shadow-2xl overflow-hidden relative">
             <div className="relative">
                <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">Panel Evaluasi & Analisis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                   <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 text-left space-y-6">
                      <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                        Rekap Nilai Cepat (.CSV)
                      </h3>
                      <div className="space-y-3">
                         <input type="text" placeholder="Input Token..." className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:border-emerald-500" value={quickDownloadToken} onChange={e => setQuickDownloadToken(e.target.value)} />
                         <button onClick={handleQuickDownloadRecap} disabled={isQuickDownloading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                            {isQuickDownloading ? 'MEMPROSES...' : 'DOWNLOAD REKAP RINGKAS'}
                         </button>
                      </div>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 text-left space-y-6">
                      <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                         <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                         Analisis Terpadu (.XLSX)
                      </h3>
                      <div className="space-y-3">
                         <input type="text" placeholder="Input Token..." className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:border-blue-500 mb-2" value={fullDownloadToken} onChange={e => setFullDownloadToken(e.target.value)} />
                         <input type="text" placeholder="Filter NPSN (Opsional)" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-blue-500" value={fullDownloadSchool} onChange={e => setFullDownloadSchool(e.target.value)} />
                         <p className="text-[9px] text-slate-400 font-medium italic mt-1 px-1">Menghasilkan file Excel dengan sheet Jawaban Siswa & Referensi Soal.</p>
                         <button onClick={handleFullDataDownload} disabled={isFullDownloading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                            {isFullDownloading ? 'MENGEKSTRAK...' : 'DOWNLOAD DATA LENGKAP'}
                         </button>
                      </div>
                   </div>
                </div>

                <div className="mb-10">
                   <a 
                     href={currentLinks.aiAnalysis} 
                     target="_blank" 
                     rel="noopener noreferrer"
                     className="w-full inline-flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-black py-5 px-10 rounded-[2rem] shadow-xl shadow-blue-900/20 transition-all active:scale-95 text-xs uppercase tracking-[0.2em]"
                   >
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                     Buka Dashboard Analisis AI Studio
                   </a>
                </div>

                <button onClick={() => setView('login')} className="text-slate-400 hover:text-slate-600 font-black text-xs uppercase tracking-widest">Kembali ke Login</button>
             </div>
          </div>
        </div>
      )}

      {view === 'confirm-data' && (
        <ConfirmIdentity 
          identity={identity} 
          settings={settings} 
          onConfirm={() => {
            if (identity.name.trim()) {
              saveDeviceStudent({
                name: identity.name,
                className: identity.className,
                schoolOrigin: identity.schoolOrigin,
                birthDate: identity.birthDate
              });
            }
            setView('quiz');
          }} 
          onCancel={() => setView('login')} 
        />
      )}
      {view === 'quiz' && <QuizInterface questions={questions.filter(q => !q.isDeleted)} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject || 'Ujian Digital'} onFinish={handleFinishQuiz} onViolation={handleViolation} />}
      
      {view === 'result' && lastResult && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-slate-200 text-center">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black">✓</div>
             <h2 className="text-3xl font-black mb-8 text-slate-800">Berhasil Dikirim</h2>
             <div className="bg-blue-600 p-8 rounded-[2.5rem] mb-10 shadow-xl">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Skor Anda</p>
                <p className="text-7xl font-black text-white">{lastResult.score.toFixed(1)}</p>
             </div>
             <div className="space-y-4">
                <button onClick={() => generateResultPDF(lastResult, questions.filter(q => !q.isDeleted))} className="w-full bg-blue-50 text-blue-600 font-black py-4 rounded-2xl border-2 border-blue-200 uppercase text-[10px] tracking-widest">DOWNLOAD HASIL PDF</button>
                <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[10px]">KEMBALI KE LOGIN</button>
             </div>
          </div>
        </div>
      )}

      {/* POP-UP PEMBERITAHUAN TOKEN SALAH / BERUBAH */}
      {showInvalidTokenModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[300] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl border border-amber-200 text-center flex flex-col p-6 sm:p-8 animate-in zoom-in-95 duration-200">
            {/* Header Icon */}
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-amber-50 mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Token Tidak Ditemukan</h3>

            {/* Token Badge */}
            {invalidTokenEntered && (
              <div className="inline-flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 px-3 py-1 rounded-xl font-black text-xs uppercase tracking-widest my-2 mx-auto">
                <span className="text-[10px] text-red-400">Input:</span>
                <span className="line-through">{invalidTokenEntered}</span>
              </div>
            )}

            {/* Message Body */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-4 my-3 text-left">
              <p className="text-slate-800 text-xs sm:text-sm font-bold leading-relaxed">
                Token yang Anda masukkan salah atau mungkin sudah berubah.
              </p>
              <p className="text-slate-600 text-xs mt-1.5 font-medium leading-relaxed">
                Silakan hubungi <strong>Admin Pusat</strong> untuk mendapatkan token yang benar.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 mt-1">
              <a
                href={`https://wa.me/6287763999351?text=${encodeURIComponent(`Halo Admin Pusat E-Pro CBT, saya ${identity.name || 'peserta ujian'}. Token "${invalidTokenEntered}" tidak ditemukan / salah. Mohon bantuan token yang benar.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl shadow-emerald-200 transition-all flex items-center justify-center gap-2.5 active:scale-95 group cursor-pointer"
              >
                <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>Hubungi via WhatsApp (087763999351)</span>
              </a>

              {/* Box Nomor Manual */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 flex items-center justify-between gap-2">
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Catat / Ketik Nomor Manual:</p>
                  <p className="font-mono text-sm font-black text-slate-800 tracking-wider">087763999351</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboard('087763999351');
                    setWaNumberCopied(true);
                    setTimeout(() => setWaNumberCopied(false), 2000);
                  }}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-black text-[10px] rounded-xl uppercase tracking-wider transition-all active:scale-95 shrink-0 cursor-pointer"
                >
                  {waNumberCopied ? '✓ Tersalin' : 'Salin Nomor'}
                </button>
              </div>

              {/* Tombol Tutup */}
              <button
                type="button"
                onClick={() => setShowInvalidTokenModal(false)}
                className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer"
              >
                Tutup & Coba Lagi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GLOBAL EXAM PRINT MODAL (STANDAR UJIAN SEKOLAH) */}
      <ExamPrintModal
        isOpen={isGlobalPrintOpen}
        onClose={() => setIsGlobalPrintOpen(false)}
        questions={questions}
        appSettings={settings}
      />
    </div>
  );
};

export default App;
