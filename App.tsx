
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
import { exportSubmissionsToExcel, exportFullSubmissionsToCSV } from './services/excelService.ts';
import { 
  pushQuestionsToCloud, 
  updateLiveSettings, 
  getLiveExamData, 
  submitResultToCloud,
  getGlobalSettings,
  fetchAllQuestions,
  fetchSubmissionsByToken
} from './services/supabaseService.ts';

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
  
  // Security States for Admin Pusat
  const [showPusatLock, setShowPusatLock] = useState(false);
  const [pusatInputCode, setPusatInputCode] = useState('');
  const [isPusatUnlocked, setIsPusatUnlocked] = useState(false);

  // Quick Recap States
  const [quickDownloadToken, setQuickDownloadToken] = useState('');
  const [quickDownloadSchool, setQuickDownloadSchool] = useState('');
  const [isQuickDownloading, setIsQuickDownloading] = useState(false);
  
  // Full Data States
  const [fullDownloadToken, setFullDownloadToken] = useState('');
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
    // Jika data berubah (bukan dari sync), set status dirty
    if (syncStatus === 'success') setSyncStatus('dirty');
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
            externalLinks: {
              ...DEFAULT_LINKS,
              ...(cloudSettings.externalLinks || {})
            }
          }));
        }
      } catch (err) {
        console.warn("Cloud Initialization Warning:", err);
      }
    };
    syncWithCloud();
  }, []);

  const handleCloudSync = async () => {
    if (questions.length === 0 && adminSubView === 'bank-soal') {
      const confirmClear = confirm("Bank soal lokal kosong. Kirim data kosong ke Cloud (Akan menghapus semua soal di server)?");
      if (!confirmClear) return;
    }

    setSyncStatus('loading');
    try {
      if (adminSubView === 'bank-soal') {
        await pushQuestionsToCloud(questions);
      }
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

  const handleCloudPull = async () => {
    setPullStatus('loading');
    try {
      const cloudQs = await fetchAllQuestions();
      setQuestions(cloudQs);
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
    if (!token) return alert('Masukkan Token!');
    setIsSyncing(true);
    try {
      const cloudData = await getLiveExamData(token);
      if (!cloudData) { alert(`TOKEN "${token}" TIDAK DITEMUKAN!`); return; }
      setSettings(cloudData.settings);
      setQuestions(cloudData.questions);
      setView('confirm-data');
    } catch (err: any) { alert(`Gagal: ${err.message}`); }
    finally { setIsSyncing(false); }
  };

  const handleFinishQuiz = async (result: QuizResult) => {
    setIsSyncing(true);
    const response = await submitResultToCloud(result, settings.activeSubject);
    if (response.success) { setLastResult(result); setView('result'); }
    else alert(`GAGAL MENGIRIM KE SERVER!\n\n` + `Pesan Error: ${response.error}`);
    setIsSyncing(false);
  };

  const handleImportQuestions = (imported: Question[]) => {
    const sanitized = imported.map(q => ({
      ...q,
      id: q.id || Date.now().toString() + Math.random().toString(36).substr(2, 5),
      isDeleted: false,
      createdAt: q.createdAt || Date.now()
    }));
    setQuestions(prev => [...prev, ...sanitized]);
  };

  // Add missing handlers for result analysis and quiz violation
  
  /**
   * Mengunduh rekap ringkas hasil ujian berdasarkan token yang diinput user.
   */
  const handleQuickDownloadRecap = async () => {
    if (!quickDownloadToken.trim()) return alert("Silakan masukkan token terlebih dahulu.");
    setIsQuickDownloading(true);
    try {
      const data = await fetchSubmissionsByToken(quickDownloadToken);
      if (data && data.length > 0) {
        exportSubmissionsToExcel(data, `Rekap_Ringkas_${quickDownloadToken}_${new Date().toISOString().split('T')[0]}`, questions);
      } else {
        alert("Tidak ada data hasil ujian yang ditemukan untuk token tersebut.");
      }
    } catch (err: any) {
      alert(`Gagal menarik data: ${err.message}`);
    } finally {
      setIsQuickDownloading(false);
    }
  };

  /**
   * Mengunduh data lengkap hasil ujian (format CSV/JSON) untuk analisis butir soal.
   */
  const handleFullDataDownload = async () => {
    if (!fullDownloadToken.trim()) return alert("Silakan masukkan token terlebih dahulu.");
    setIsFullDownloading(true);
    try {
      const data = await fetchSubmissionsByToken(fullDownloadToken);
      if (data && data.length > 0) {
        exportFullSubmissionsToCSV(data, `Data_Lengkap_${fullDownloadToken}_${new Date().toISOString().split('T')[0]}`);
      } else {
        alert("Tidak ada data hasil ujian yang ditemukan untuk token tersebut.");
      }
    } catch (err: any) {
      alert(`Gagal menarik data: ${err.message}`);
    } finally {
      setIsFullDownloading(false);
    }
  };

  /**
   * Menangani pelanggaran integritas (seperti keluar dari mode fullscreen) selama ujian.
   */
  const handleViolation = (reason: string) => {
    alert(reason);
    // Secara default, CBT akan mereset halaman untuk menjaga integritas jika terdeteksi pelanggaran fatal
    window.location.reload();
  };

  const currentLinks = settings.externalLinks || DEFAULT_LINKS;

  return (
    <div className="min-h-screen bg-slate-50 font-inter">
      {view === 'admin-auth' && <AdminLogin onLogin={() => setView('admin-panel')} correctPassword={adminPassword} helpLink={currentLinks.passwordHelp} />}
      
      {view === 'admin-panel' && (
        <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row relative">
          {showGuide && <AdminGuide onClose={() => setShowGuide(false)} />}
          
          <header className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
            <div className="font-black text-xl flex items-center gap-2"><div className="w-6 h-6 bg-blue-600 rounded"></div>CBT SERVER</div>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/10 rounded-lg">Menu</button>
          </header>

          <aside className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 bg-slate-900 text-white flex-col p-6 lg:sticky top-0 lg:h-screen z-40 transition-all`}>
            <div className="hidden lg:flex font-black text-2xl mb-12 items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>CBT SERVER
            </div>
            
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
            </nav>

            <div className="mt-8 lg:mt-auto space-y-4">
              {/* STATUS INDICATOR SECTION */}
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
                   {pullStatus === 'loading' ? 'Menarik...' : 'Tarik Data Server'}
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
                   {syncStatus === 'loading' ? 'Mengirim...' : 'Kirim Ke Cloud'}
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
              />
            )}
          </main>
        </div>
      )}

      {/* Login, confirm, quiz, etc remain same... */}
      {view === 'login' && (
        <div className="min-h-screen flex items-center justify-center p-4">
          {/* ... existing login UI ... */}
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
            <div className="md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-12"><div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black">C</div><div className="font-black text-2xl">EduCBT Pro</div></div>
                <h1 className="text-4xl font-black mb-6 leading-tight">Computer Based Test</h1>
                <p className="text-slate-400 font-medium italic">Sistem Ujian Digital</p>
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
                  <input required type="text" placeholder="Nama Peserta" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" value={identity.name} onChange={e => setIdentity({...identity, name: e.target.value})} />
                  <input required type="text" placeholder="Kelas" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" value={identity.className} onChange={e => setIdentity({...identity, className: e.target.value})} />
                </div>
                <input required type="text" placeholder="Asal Sekolah" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" value={identity.schoolOrigin} onChange={e => setIdentity({...identity, schoolOrigin: e.target.value})} />
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
          {/* ... existing analysis panel UI ... */}
           <div className="bg-white rounded-[4rem] p-12 max-w-4xl w-full shadow-2xl overflow-hidden relative">
             <div className="relative">
                <h2 className="text-3xl font-black text-slate-800 mb-2 uppercase tracking-tight">Panel Evaluasi & Analisis</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                   {/* ... recap buttons ... */}
                   <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 text-left space-y-6">
                      <div>
                         <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Rekap Nilai Cepat</h3>
                      </div>
                      <div className="space-y-3">
                         <input type="text" placeholder="Input Token Rekap" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:border-emerald-500" value={quickDownloadToken} onChange={e => setQuickDownloadToken(e.target.value)} />
                         <button onClick={handleQuickDownloadRecap} disabled={isQuickDownloading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">
                            {isQuickDownloading ? 'Memproses...' : 'Download Rekap Ringkas'}
                         </button>
                      </div>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[2.5rem] border-2 border-slate-100 text-left space-y-6">
                      <div>
                         <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest">Data Lengkap (CSV)</h3>
                      </div>
                      <div className="space-y-3">
                         <input type="text" placeholder="Input Token Data Lengkap" className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest outline-none focus:border-blue-500" value={fullDownloadToken} onChange={e => setFullDownloadToken(e.target.value)} />
                         <button onClick={handleFullDataDownload} disabled={isFullDownloading} className="w-full bg-slate-900 hover:bg-black text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                            {isFullDownloading ? 'Mengekstrak...' : 'Download Data Lengkap'}
                         </button>
                      </div>
                   </div>
                </div>
                <button onClick={() => setView('login')} className="text-slate-400 hover:text-slate-600 font-black text-xs uppercase tracking-widest">Kembali ke Login</button>
             </div>
          </div>
        </div>
      )}

      {view === 'confirm-data' && <ConfirmIdentity identity={identity} settings={settings} onConfirm={() => setView('quiz')} onCancel={() => setView('login')} />}
      {view === 'quiz' && <QuizInterface questions={questions.filter(q => !q.isDeleted)} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject || 'Ujian Digital'} onFinish={handleFinishQuiz} onViolation={handleViolation} />}
      
      {view === 'result' && lastResult && (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-slate-200">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black">✓</div>
             <h2 className="text-3xl font-black mb-8 text-slate-800">Berhasil Dikirim</h2>
             <div className="bg-blue-600 p-8 rounded-[2.5rem] mb-10 shadow-xl">
                <p className="text-[10px] font-black text-blue-200 uppercase tracking-widest mb-2">Skor Anda</p>
                <p className="text-7xl font-black text-white">{lastResult.score.toFixed(1)}</p>
             </div>
             <div className="space-y-4">
                <button onClick={() => generateResultPDF(lastResult, questions.filter(q => !q.isDeleted))} className="w-full bg-blue-50 text-blue-600 font-black py-4 rounded-2xl border-2 border-blue-200 uppercase text-[10px] tracking-widest">Download Hasil PDF</button>
                <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[10px]">Kembali Ke Login</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
