
import React, { useState, useEffect } from 'react';
import { Question, Subject, StudentIdentity, QuizResult, AppSettings } from './types.ts';
import { INITIAL_QUESTIONS } from './constants.ts';
import QuizInterface from './components/QuizInterface.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import QuestionManager from './components/QuestionManager.tsx';
import AdminSettings from './components/AdminSettings.tsx';
import ConfirmIdentity from './components/ConfirmIdentity.tsx';
import { generateResultPDF } from './services/pdfService.ts';
import { 
  pushQuestionsToCloud, 
  updateLiveSettings, 
  getLiveExamData, 
  submitResultToCloud
} from './services/supabaseService.ts';

type ViewMode = 'login' | 'confirm-data' | 'quiz' | 'result' | 'admin-auth' | 'admin-panel';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persistence for Admin Password
  const [adminPassword, setAdminPassword] = useState(() => {
    return localStorage.getItem('cbt_admin_pass') || 'admin123';
  });

  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('cbt_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cbt_settings');
    return saved ? JSON.parse(saved) : { timerMinutes: 60 };
  });

  const [identity, setIdentity] = useState<StudentIdentity>({ name: '', className: '', birthDate: '', token: '' });
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

  const handleCloudSync = async () => {
    if (questions.length === 0) {
      alert("Bank soal kosong! Tambahkan minimal satu soal sebelum melakukan sinkronisasi.");
      return;
    }

    setSyncStatus('loading');
    try {
      await pushQuestionsToCloud(questions);
      await updateLiveSettings(settings);
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Dashboard Sync Error:", err);
      setSyncStatus('error');
      alert(`GAGAL SINKRONISASI!\n\nPesan: ${err.message}`);
    }
  };

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = identity.token.trim().toUpperCase();
    if (!token) {
      alert('Silakan masukkan Token Paket Soal!');
      return;
    }
    
    setIsSyncing(true);
    try {
      const cloudData = await getLiveExamData(token);
      if (!cloudData) {
        alert(`TOKEN "${token}" TIDAK DITEMUKAN!\n\nPastikan Anda sudah menekan tombol "SINKRONISASI CLOUD" di Panel Admin setelah membuat soal.`);
        return;
      }
      setSettings(cloudData.settings);
      setQuestions(cloudData.questions);
      setView('confirm-data');
    } catch (err: any) {
      alert(`Gagal mengambil data: ${err.message || 'Cek koneksi internet Anda.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleViolation = (reason: string) => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
    
    alert(`UJIAN DIBATALKAN!\n\n${reason}\n\nSistem mengeluarkan Anda secara otomatis demi integritas ujian.`);
    setView('login');
    setIdentity({ name: '', className: '', birthDate: '', token: '' });
  };

  const handleFinishQuiz = async (result: QuizResult) => {
    setIsSyncing(true);
    const success = await submitResultToCloud(result);
    if (success) {
      setLastResult(result);
      setView('result');
    } else {
      alert('Jawaban tersimpan secara lokal, tapi gagal terkirim ke server. Jangan tutup halaman ini dan coba tekan Selesai lagi.');
    }
    setIsSyncing(false);
  };

  const handleDownloadStudentPDF = () => {
    if (lastResult) {
      generateResultPDF(lastResult, questions.filter(q => !q.isDeleted));
    }
  };

  const handleChangeAdminPass = () => {
    const accessCode = prompt("Masukkan KODE AKSES PUSAT:");
    if (accessCode === "Indme&781l") {
      const newPass = prompt("PENGATURAN ULANG: Masukkan Password Admin Baru:", adminPassword);
      if (newPass && newPass.trim() !== "") {
        setAdminPassword(newPass.trim());
        alert("SISTEM: Password administrator berhasil diperbarui.");
      }
    } else if (accessCode !== null) {
      alert("KODE AKSES PUSAT SALAH!");
    }
  };

  if (view === 'admin-auth') return <AdminLogin onLogin={() => setView('admin-panel')} correctPassword={adminPassword} />;
  
  if (view === 'admin-panel') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
        {/* Mobile Header */}
        <header className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
          <div className="font-black text-xl flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-600 rounded"></div>
            CBT SERVER
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 bg-white/10 rounded-lg">
            {isMobileMenuOpen ? 'Tutup' : 'Menu'}
          </button>
        </header>

        {/* Adaptive Sidebar */}
        <aside className={`${isMobileMenuOpen ? 'flex' : 'hidden'} lg:flex w-full lg:w-72 bg-slate-900 text-white flex-col p-6 lg:sticky top-0 lg:h-screen z-40 transition-all`}>
          <div className="hidden lg:flex font-black text-2xl mb-12 items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
            CBT SERVER
          </div>
          
          <nav className="space-y-2 flex-1">
            <button className="w-full text-left p-4 bg-white/10 rounded-xl font-bold border-l-4 border-blue-500 uppercase text-[10px] tracking-widest">Bank Soal</button>
            
            <a 
              href="https://ai.studio/apps/drive/13CnHs1wO_wbrWZYjpbUDvJ0ZKsTA1z0E?fullscreenApplet=true" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 p-4 hover:bg-white/5 rounded-xl font-bold uppercase text-[10px] tracking-widest text-purple-400 border border-transparent hover:border-purple-500/20 transition-all group"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Soal Otomatis ✨
            </a>
          </nav>

          <div className="mt-8 lg:mt-auto space-y-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
               <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status Cloud</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-green-500 uppercase">Online</span>
                  </div>
               </div>
               <button onClick={handleCloudSync} disabled={syncStatus === 'loading'} className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl ${syncStatus === 'loading' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : syncStatus === 'success' ? 'bg-green-600 text-white' : syncStatus === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                 {syncStatus === 'loading' ? 'Sedang Sync...' : syncStatus === 'success' ? 'BERHASIL DISYNC' : 'SINKRONISASI CLOUD'}
               </button>
            </div>
            <button onClick={() => { setView('login'); setIsMobileMenuOpen(false); }} className="w-full p-4 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-all text-left uppercase text-[10px] tracking-widest">Keluar</button>
          </div>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 p-4 lg:p-8 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0">
              <div className="mb-8">
                <h1 className="text-2xl lg:text-3xl font-black text-slate-800">Bank Soal Dinamis</h1>
                <p className="text-slate-400 font-medium text-xs lg:text-sm italic">Mode Anti-Cheat Fullscreen otomatis aktif untuk setiap siswa yang login.</p>
              </div>
              <QuestionManager 
                questions={questions} 
                activeToken="" 
                onAdd={(q) => setQuestions(prev => [...prev, { ...q, id: Date.now().toString()+Math.random(), createdAt: Date.now(), isDeleted: false, order: q.order || (prev.length + 1) }])} 
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
                onUpdateSettings={setSettings} 
                onImportQuestions={(newQs) => setQuestions(newQs)} 
                onReset={() => setQuestions([])} 
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-inter">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
          <div className="md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full -mr-32 -mt-32 blur-3xl opacity-20"></div>
            <div className="relative z-10 text-center md:text-left">
              <div className="flex items-center justify-center md:justify-start gap-3 mb-12">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg">C</div>
                <div className="font-black text-2xl tracking-tighter text-white">EduCBT Pro</div>
              </div>
              <h1 className="text-4xl font-black mb-6 leading-tight">Computer Based Test</h1>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Sistem</p>
                <p className="text-xl font-black text-white italic">Full Dynamic Partitioning</p>
              </div>
            </div>
            
            <div className="mt-auto flex flex-col items-center">
              <button 
                onClick={() => setView('admin-auth')} 
                className="w-full bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all mb-4"
              >
                Administrator
              </button>
              
              {/* TOMBOL MERAH RAHASIA - TANPA TEKS, TANPA TOOLTIP */}
              <button 
                onClick={handleChangeAdminPass}
                className="w-1.5 h-1.5 bg-red-600 rounded-full opacity-30 hover:opacity-100 transition-opacity cursor-pointer mb-2"
                aria-hidden="true"
              ></button>
            </div>
          </div>
          <div className="md:w-7/12 p-12 bg-white">
            <div className="max-w-md mx-auto text-center md:text-left">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Login Peserta</h2>
              <p className="text-slate-400 font-medium mb-10 italic">Masukkan identitas dan token ujian dari Guru.</p>
              <form onSubmit={handleStartQuiz} className="space-y-5">
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input required type="text" placeholder="Nama Lengkap Anda" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-800" value={identity.name} onChange={e => setIdentity({...identity, name: e.target.value})} />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas</label>
                  <input required type="text" placeholder="Contoh: 6A" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-800" value={identity.className} onChange={e => setIdentity({...identity, className: e.target.value})} />
                </div>
                <div className="space-y-1 text-left">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Token Ujian</label>
                  <input required type="text" placeholder="....." className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 text-center uppercase tracking-[0.3em] outline-none placeholder:opacity-30" value={identity.token} onChange={e => setIdentity({...identity, token: e.target.value})} />
                </div>
                <div className="pt-4">
                  <button disabled={isSyncing} className="w-full font-black py-5 rounded-[2rem] text-xl shadow-2xl transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200">
                    {isSyncing ? 'MENGHUBUNGKAN...' : 'MASUK KE UJIAN'}
                  </button>

                  <a 
                    href="http://lynk.id/edupreneur25/n3yqk5e4er64" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="mt-8 block text-[11px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-widest"
                  >
                    klik di sini untuk mendapatkan password administrator
                  </a>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'confirm-data') return <ConfirmIdentity identity={identity} settings={settings} onConfirm={() => setView('quiz')} onCancel={() => setView('login')} />;
  if (view === 'quiz') return <QuizInterface questions={questions.filter(q => !q.isDeleted)} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject || 'Ujian Digital'} onFinish={handleFinishQuiz} onViolation={handleViolation} />;
  
  if (view === 'result' && lastResult) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl max-w-md w-full border border-slate-200">
           <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 text-white text-3xl font-black">✓</div>
           <h2 className="text-3xl font-black mb-2 text-slate-800">Berhasil Dikirim</h2>
           <p className="text-slate-400 mb-8 font-medium italic">Data pengerjaan Anda telah tersimpan di Cloud.</p>
           <div className="bg-blue-600 p-8 rounded-[2.5rem] mb-8 shadow-2xl shadow-blue-100">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-2">Skor Anda</p>
              <p className="text-7xl font-black text-white">{lastResult.score.toFixed(1)}</p>
           </div>
           
           <div className="space-y-4">
              <button 
                onClick={handleDownloadStudentPDF}
                className="w-full bg-blue-50 text-blue-600 font-black py-4 rounded-2xl border-2 border-blue-200 hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg>
                DOWNLOAD HASIL PDF
              </button>
              
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all hover:bg-black uppercase tracking-widest text-xs">KEMBALI KE LOGIN</button>
           </div>
        </div>
      </div>
    );
  }
  return null;
};

export default App;
