
import React, { useState, useEffect } from 'react';
import { Question, Subject, StudentIdentity, QuizResult, AppSettings, QuestionType, CognitiveLevel, ExternalLinks } from './types.ts';
import { INITIAL_QUESTIONS } from './constants.ts';
import QuizInterface from './components/QuizInterface.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import QuestionManager from './components/QuestionManager.tsx';
import AdminSettings from './components/AdminSettings.tsx';
import ConfirmIdentity from './components/ConfirmIdentity.tsx';
import AdminGuide from './components/AdminGuide.tsx';
import { generateResultPDF } from './services/pdfService.ts';
import { exportSubmissionsToExcel } from './services/excelService.ts';
import { 
  pushQuestionsToCloud, 
  updateLiveSettings, 
  getLiveExamData, 
  submitResultToCloud,
  getGlobalSettings,
  fetchAllQuestions,
  fetchSubmissionsByToken
} from './services/supabaseService.ts';

type ViewMode = 'login' | 'confirm-data' | 'quiz' | 'result' | 'admin-auth' | 'admin-panel';

const DEFAULT_LINKS: ExternalLinks = {
  passwordHelp: 'https://lynk.id/edupreneur25/n3yqk5e4er64',
  aiGenerator: 'https://ai.studio/apps/drive/13CnHs1wO_wbrWZYjpbUDvJ0ZKsTA1z0E?fullscreenApplet=true',
  adminEmailDisplay: 'asepsukanta25@guru.sd.belajar.id'
};

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [pullStatus, setPullStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  
  // Quick Recap States
  const [quickDownloadToken, setQuickDownloadToken] = useState('');
  const [quickDownloadSchool, setQuickDownloadSchool] = useState('');
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);

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
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('cbt_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('cbt_admin_pass', adminPassword);
  }, [adminPassword]);

  useEffect(() => {
    const syncWithCloud = async () => {
      try {
        const cloudSettings = await getGlobalSettings();
        if (cloudSettings) {
          if (cloudSettings.adminPassword) {
            setAdminPassword(cloudSettings.adminPassword);
          }
          setSettings(prev => ({
            ...prev,
            timerMinutes: cloudSettings.timerMinutes || prev.timerMinutes,
            externalLinks: cloudSettings.externalLinks || prev.externalLinks || DEFAULT_LINKS
          }));
        }
      } catch (err) {
        console.warn("Cloud Initialization Warning:", err);
      }
    };
    syncWithCloud();
  }, []);

  useEffect(() => {
    if (view === 'admin-panel') {
      setShowGuide(true);
      handleCloudPull();
    }
  }, [view]);

  const handleCloudSync = async () => {
    if (questions.length === 0) {
      const confirmClear = confirm("Bank soal lokal kosong. Kirim data kosong ke Cloud (Akan menghapus semua soal di server)?");
      if (!confirmClear) return;
    }

    setSyncStatus('loading');
    try {
      await pushQuestionsToCloud(questions);
      await updateLiveSettings({ ...settings, adminPassword });
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: any) {
      setSyncStatus('error');
      alert(`GAGAL SINKRONISASI!\n\nPesan: ${err.message}`);
    }
  };

  const handleCloudPull = async () => {
    setPullStatus('loading');
    try {
      const cloudQs = await fetchAllQuestions();
      setQuestions(cloudQs);
      setPullStatus('success');
      setTimeout(() => setPullStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Gagal menarik data:", err);
      setPullStatus('error');
      setTimeout(() => setPullStatus('idle'), 3000);
    }
  };

  /**
   * Fungsi Normalisasi Nama Sekolah Cerdas
   * Mengonversi teks ke lowercase, menghapus prefix umum (sdn, sd negeri, sd), 
   * dan menghapus semua simbol/spasi agar variasi penulisan tetap terdeteksi sama.
   */
  const normalizeSchoolName = (name: string): string => {
    if (!name) return "";
    return name.toLowerCase()
      .replace(/sd\s*negeri/g, '')
      .replace(/sdn/g, '')
      .replace(/sd/g, '')
      .replace(/[^a-z0-9]/g, '') // Menghapus simbol dan spasi
      .trim();
  };

  const handleQuickDownloadRecap = async () => {
    const token = quickDownloadToken.trim().toUpperCase();
    const inputSchool = quickDownloadSchool.trim();

    if (!token) {
      alert("Silakan masukkan Token paket soal terlebih dahulu.");
      return;
    }

    setIsQuickDownloading(true);
    try {
      const data = await fetchSubmissionsByToken(token);
      if (data && data.length > 0) {
        let filteredData = data;
        
        // Filter Cerdas Berdasarkan Nama Sekolah jika diinput oleh guru
        if (inputSchool) {
          const normalizedInput = normalizeSchoolName(inputSchool);
          filteredData = data.filter(s => {
            const studentSchool = s.school_origin || "";
            return normalizeSchoolName(studentSchool) === normalizedInput;
          });
        }

        if (filteredData.length > 0) {
          const fileName = `Rekap_Nilai_Cepat_${token}_${new Date().toISOString().split('T')[0]}`;
          exportSubmissionsToExcel(filteredData, fileName, questions);
          alert(`Berhasil mengunduh rekap untuk token ${token}${inputSchool ? ' di sekolah ' + inputSchool : ''}.`);
          setQuickDownloadToken('');
          setQuickDownloadSchool('');
        } else {
          alert(`Tidak ada data pengerjaan ditemukan untuk token "${token}" dengan kriteria sekolah "${inputSchool}".`);
        }
      } else {
        alert(`Tidak ada data pengerjaan ditemukan untuk token "${token}". Pastikan token sudah benar.`);
      }
    } catch (err: any) {
      alert(`Gagal mengambil data: ${err.message}`);
    } finally {
      setIsQuickDownloading(false);
    }
  };

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = identity.token.trim().toUpperCase();
    if (!token) {
      alert('Masukkan Token!');
      return;
    }
    
    setIsSyncing(true);
    try {
      const cloudData = await getLiveExamData(token);
      if (!cloudData) {
        alert(`TOKEN "${token}" TIDAK DITEMUKAN!`);
        return;
      }
      setSettings(cloudData.settings);
      setQuestions(cloudData.questions);
      setView('confirm-data');
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
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
    
    if (response.success) {
      setLastResult(result);
      setView('result');
    } else {
      alert(
        `GAGAL MENGIRIM KE SERVER!\n\n` +
        `Pesan Error: ${response.error}`
      );
    }
    setIsSyncing(false);
  };

  const handleDownloadStudentPDF = () => {
    if (lastResult) generateResultPDF(lastResult, questions.filter(q => !q.isDeleted));
  };

  const handleCentralSettings = async () => {
    const accessCode = prompt("Masukkan KODE AKSES PUSAT:");
    if (accessCode === "Indme&781l") {
      const choice = prompt(
        "MENU AKSES PUSAT:\n\n" +
        "1. Ubah Password Administrator\n" +
        "2. Konfigurasi Tautan & Identitas\n\n" +
        "Pilih nomor menu (1/2):"
      );

      if (choice === "1") {
        const newPass = prompt("PENGATURAN ULANG: Masukkan Password Admin Baru:", adminPassword);
        if (newPass && newPass.trim() !== "") {
          const trimmedPass = newPass.trim();
          setAdminPassword(trimmedPass);
          try {
            await updateLiveSettings({ ...settings, adminPassword: trimmedPass });
            alert("BERHASIL: Password diperbarui di Cloud.");
          } catch (e: any) {
            alert("Berhasil simpan di perangkat ini. (Gagal sinkron cloud: pastikan internet stabil)");
          }
        }
      } else if (choice === "2") {
        const currentLinks = settings.externalLinks || DEFAULT_LINKS;
        
        const newHelpLink = prompt("Link Bantuan Password:", currentLinks.passwordHelp);
        const newAiLink = prompt("Link Generate Soal AI:", currentLinks.aiGenerator);
        const newEmailDisplay = prompt("Teks Identitas Pengelola (Email/Nama):", currentLinks.adminEmailDisplay);

        if (newHelpLink !== null || newAiLink !== null || newEmailDisplay !== null) {
          const updatedLinks: ExternalLinks = {
            passwordHelp: (newHelpLink !== null ? newHelpLink.trim() : null) || currentLinks.passwordHelp,
            aiGenerator: (newAiLink !== null ? newAiLink.trim() : null) || currentLinks.aiGenerator,
            adminEmailDisplay: (newEmailDisplay !== null ? newEmailDisplay.trim() : null) || currentLinks.adminEmailDisplay
          };

          const newSettings = { ...settings, externalLinks: updatedLinks };
          setSettings(newSettings);
          localStorage.setItem('cbt_settings', JSON.stringify(newSettings));
          
          try {
            await updateLiveSettings({ ...newSettings, adminPassword });
            alert("BERHASIL: Pengaturan diperbarui.");
          } catch (e: any) {
            alert("Perubahan disimpan di perangkat ini.");
          }
        }
      }
    } else if (accessCode !== null) {
      alert("KODE AKSES PUSAT SALAH!");
    }
  };

  const normalizeImportedQuestions = (rawQs: any[]): Question[] => {
    return rawQs.map(q => {
      let level = q.level;
      let type = q.type;

      const typeMap: { [key: string]: QuestionType } = {
        'Pilihan Ganda': QuestionType.SINGLE,
        'Pilihan Jamak (MCMA)': QuestionType.MULTIPLE,
        'Pilihan Ganda Kompleks': QuestionType.COMPLEX_CATEGORY,
        'Pilihan Ganda Kompleks (B/S)': QuestionType.TRUE_FALSE_COMPLEX,
        '(Benar/Salah)': QuestionType.TRUE_FALSE_COMPLEX,
        '(Sesuai/Tidak Sesuai)': QuestionType.TRUE_FALSE_COMPLEX
      };

      if (typeMap[type]) {
        type = typeMap[type];
      }

      const levelMap: { [key: string]: string } = {
        'L1': CognitiveLevel.L1,
        'L2': CognitiveLevel.L2,
        'L3': CognitiveLevel.L3,
        'C1': CognitiveLevel.C1,
        'C2': CognitiveLevel.C2,
        'C3': CognitiveLevel.C3,
        'C4': CognitiveLevel.C4,
        'C5': CognitiveLevel.C5,
        'C6': CognitiveLevel.C6,
      };

      if (levelMap[level]) {
        level = levelMap[level];
      }

      let correctAnswer = q.correctAnswer;
      if (type === QuestionType.TRUE_FALSE_COMPLEX || type === QuestionType.COMPLEX_CATEGORY) {
        if (!Array.isArray(correctAnswer)) {
          correctAnswer = (q.options || []).map(() => false);
        }
      }

      return {
        ...q,
        id: q.id || `import_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        level: level,
        type: type as QuestionType,
        correctAnswer: correctAnswer,
        questionImage: q.questionImage || q.image || '',
        quizToken: (q.quizToken || 'UMUM').toUpperCase(),
        isDeleted: q.isDeleted || false,
        createdAt: q.createdAt || Date.now(),
        order: Number(q.order) || 1,
        tfLabels: q.tfLabels || (type === QuestionType.TRUE_FALSE_COMPLEX ? { true: 'Benar', false: 'Salah' } : undefined)
      };
    });
  };

  const handleImportQuestions = (newQs: any[], mode: 'replace' | 'append') => {
    const normalized = normalizeImportedQuestions(newQs);
    
    if (mode === 'replace') {
      setQuestions(normalized);
    } else {
      setQuestions(prev => {
        const merged = [...prev];
        normalized.forEach(newQ => {
          if (!merged.find(m => m.id === newQ.id)) {
            merged.push(newQ);
          }
        });
        return merged;
      });
    }
  };

  const currentLinks = settings.externalLinks || DEFAULT_LINKS;

  return (
    <div className="min-h-screen bg-slate-50">
      {view === 'admin-auth' && <AdminLogin onLogin={() => setView('admin-panel')} correctPassword={adminPassword} helpLink={currentLinks.passwordHelp} />}
      
      {view === 'admin-panel' && (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
          {showGuide && <AdminGuide onClose={() => setShowGuide(false)} />}
          <header className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
            <div className="font-black text-xl flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded"></div>
              CBT SERVER
            </div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/10 rounded-lg">
              {isMobileMenuOpen ? 'Tutup' : 'Menu'}
            </button>
          </header>
          <aside className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 bg-slate-900 text-white flex-col p-6 lg:sticky top-0 lg:h-screen z-40 transition-all`}>
            <div className="hidden lg:flex font-black text-2xl mb-12 items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
              CBT SERVER
            </div>
            <nav className="space-y-2 flex-1">
              <button className="w-full text-left p-4 bg-white/10 rounded-xl font-bold border-l-4 border-blue-500 uppercase text-[10px] tracking-widest">Bank Soal</button>
              <a href={currentLinks.aiGenerator} target="_blank" rel="noopener noreferrer" className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest text-purple-400 border border-transparent hover:border-purple-500/20 transition-all group">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Generate Soal AI ✨
              </a>
              <button onClick={() => setShowGuide(true)} className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest text-emerald-400 border border-transparent hover:border-emerald-500/20 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                Panduan Penggunaan
              </button>
            </nav>
            <div className="mt-8 lg:mt-auto space-y-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                 <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Koneksi Server</span>
                    <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div><span className="text-[9px] font-black text-green-500 uppercase">Live</span></div>
                 </div>
                 
                 <button onClick={handleCloudPull} disabled={pullStatus === 'loading'} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 border border-white/10 ${pullStatus === 'loading' ? 'bg-slate-700 text-slate-400' : pullStatus === 'success' ? 'bg-emerald-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
                   {pullStatus === 'loading' ? 'Tarik Data...' : pullStatus === 'success' ? 'DATA TERUPDATE' : 'TARIK DATA SERVER'}
                 </button>

                 <button onClick={handleCloudSync} disabled={syncStatus === 'loading'} className={`w-full py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl ${syncStatus === 'loading' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : syncStatus === 'success' ? 'bg-green-600 text-white' : syncStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                   {syncStatus === 'loading' ? 'Kirim...' : syncStatus === 'success' ? 'TERSIMPAN' : 'KIRIM KE CLOUD'}
                 </button>
              </div>
              <button onClick={() => { setView('login'); setIsMobileMenuOpen(false); }} className="w-full p-4 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-all text-left uppercase text-[10px] tracking-widest">Keluar</button>
            </div>
          </aside>
          <main className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar">
            <div className="flex flex-col lg:flex-row gap-8">
              <div className="flex-1 min-w-0">
                <div className="mb-8 flex justify-between items-end">
                  <div>
                    <h1 className="text-2xl lg:text-3xl font-black text-slate-800">Bank Soal Dinamis</h1>
                    <p className="text-slate-400 font-medium text-xs lg:text-sm italic">Soal tersinkronisasi antar perangkat melalui Cloud.</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest">{questions.length} TOTAL SOAL</span>
                  </div>
                </div>
                <QuestionManager 
                  questions={questions} 
                  activeToken="" 
                  onAdd={(q) => {
                    const sameToken = questions.filter(item => item.quizToken === q.quizToken && !item.isDeleted);
                    const nextOrder = q.order || (sameToken.length > 0 ? Math.max(...sameToken.map(i => i.order)) + 1 : 1);
                    
                    setQuestions(prev => [...prev, { 
                      ...q, 
                      id: Date.now().toString()+Math.random(), 
                      createdAt: Date.now(), 
                      isDeleted: false, 
                      order: nextOrder 
                    }]);
                  }} 
                  onUpdate={(updated) => setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))} 
                  onSoftDelete={(id) => setQuestions(prev => prev.map(item => item.id === id ? { ...item, isDeleted: true } : item))} 
                  onPermanentDelete={(id) => setQuestions(prev => prev.filter(item => item.id !== id))} 
                  onRestore={(id) => setQuestions(prev => prev.map(item => item.id === id ? { ...item, isDeleted: false } : item))} 
                />
              </div>
              <div className="w-full lg:w-80">
                <AdminSettings 
                  settings={settings} 
                  questions={questions} 
                  onUpdateSettings={(newSettings) => { setSettings(newSettings); updateLiveSettings({ ...newSettings, adminPassword }).catch(() => {}); }} 
                  onImportQuestions={handleImportQuestions} 
                  onReset={() => setQuestions([])} 
                />
              </div>
            </div>
          </main>
        </div>
      )}

      {view === 'login' && (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-inter">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
            <div className="md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full -mr-32 -mt-32 blur-3xl opacity-20"></div>
              <div className="relative z-10 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-12"><div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg">C</div><div className="font-black text-2xl tracking-tighter text-white">EduCBT Pro</div></div>
                <h1 className="text-4xl font-black mb-6 leading-tight">Computer Based Test</h1>
                <div className="bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-sm"><p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Sistem</p><p className="text-xl font-black text-white italic">Full Dynamic Partitioning</p></div>
              </div>
              <div className="mt-auto flex flex-col items-center">
                <button onClick={() => setView('admin-auth')} className="w-full bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all mb-4 text-white">Administrator</button>
                <a href={currentLinks.passwordHelp} target="_blank" rel="noopener noreferrer" className="mb-4 block text-[10px] text-center font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest leading-relaxed">klik di sini untuk mendapatkan<br/>password administrator</a>
                
                <button 
                  onClick={handleCentralSettings} 
                  className="text-[11px] font-black text-white hover:text-blue-400 transition-colors cursor-pointer mb-6 tracking-tight"
                >
                  {currentLinks.adminEmailDisplay}
                </button>
              </div>
            </div>
            <div className="md:w-7/12 p-12 bg-white max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
              <div className="max-w-md mx-auto text-center md:text-left flex-1">
                <h2 className="text-3xl font-black text-slate-800 mb-2">Login Peserta</h2>
                <p className="text-slate-400 font-medium mb-10 italic">Lengkapi identitas untuk memulai pengerjaan.</p>
                <form onSubmit={handleStartQuiz} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                      <input required type="text" placeholder="Nama Peserta" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-800 text-sm" value={identity.name} onChange={e => setIdentity({...identity, name: e.target.value})} />
                    </div>
                    <div className="space-y-1 text-left">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas</label>
                      <input required type="text" placeholder="Contoh: 6A" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-800 text-sm" value={identity.className} onChange={e => setIdentity({...identity, className: e.target.value})} />
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asal Sekolah</label>
                    <input required type="text" placeholder="Nama Sekolah / Institusi" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-800 text-sm" value={identity.schoolOrigin} onChange={e => setIdentity({...identity, schoolOrigin: e.target.value})} />
                  </div>
                  
                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Lahir</label>
                    <input required type="date" className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-800 text-sm" value={identity.birthDate} onChange={e => setIdentity({...identity, birthDate: e.target.value})} />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1 text-center block">Token Ujian</label>
                    <input required type="text" placeholder="KODE TOKEN" className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 text-center uppercase tracking-[0.3em] outline-none placeholder:opacity-30" value={identity.token} onChange={e => setIdentity({...identity, token: e.target.value})} />
                  </div>

                  <div className="pt-2">
                    <button disabled={isSyncing} className="w-full font-black py-4 rounded-[2rem] text-lg shadow-2xl transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200">
                      {isSyncing ? 'MENGHUBUNGKAN...' : 'MASUK KE UJIAN'}
                    </button>
                  </div>
                </form>

                {/* AREA REKAP - DIPERBARUI DENGAN FILTER NAMA SEKOLAH CERDAS */}
                <hr className="my-10 border-slate-100" />
                <div className="max-w-xs mx-auto">
                   <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl space-y-3">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] text-center mb-1">Download Rekap Cepat (Guru)</p>
                      <div className="space-y-2">
                        <input 
                         type="text" 
                         placeholder="Masukan Token" 
                         className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-500 text-blue-400"
                         value={quickDownloadToken}
                         onChange={(e) => setQuickDownloadToken(e.target.value)}
                        />
                        <input 
                         type="text" 
                         placeholder="Nama Sekolah (Opsional)" 
                         className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-center text-[10px] font-black uppercase tracking-widest outline-none focus:border-emerald-500 text-emerald-400"
                         value={quickDownloadSchool}
                         onChange={(e) => setQuickDownloadSchool(e.target.value)}
                        />
                      </div>
                      <button 
                       onClick={handleQuickDownloadRecap}
                       disabled={isQuickDownloading}
                       className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        {isQuickDownloading ? 'Processing...' : 'Download Rekap Nilai'}
                      </button>
                   </div>
                   <p className="text-[8px] text-slate-400 text-center mt-3 font-bold uppercase tracking-widest opacity-50">Hanya untuk pengelola ujian</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === 'confirm-data' && <ConfirmIdentity identity={identity} settings={settings} onConfirm={() => setView('quiz')} onCancel={() => setView('login')} />}
      {view === 'quiz' && <QuizInterface questions={questions.filter(q => !q.isDeleted)} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject || 'Ujian Digital'} onFinish={handleFinishQuiz} onViolation={handleViolation} />}
      
      {view === 'result' && lastResult && (
        <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-slate-200">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black">✓</div>
             <h2 className="text-3xl font-black mb-2 text-slate-800">Berhasil Dikirim</h2>
             <div className="bg-blue-600 p-8 rounded-[2.5rem] mb-8 shadow-2xl shadow-blue-100"><p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-2">Skor Anda</p><p className="text-7xl font-black text-white">{lastResult.score.toFixed(1)}</p></div>
             <div className="space-y-4">
                <button onClick={handleDownloadStudentPDF} className="w-full bg-blue-50 text-blue-600 font-black py-4 rounded-2xl border-2 border-blue-200 hover:bg-blue-100 transition-all flex items-center justify-center gap-2">DOWNLOAD HASIL PDF</button>
                <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all hover:bg-black uppercase tracking-widest text-xs">KEMBALI KE LOGIN</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
