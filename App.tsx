
import React, { useState, useEffect } from 'react';
import { Question, Subject, StudentIdentity, QuizResult, AppSettings } from './types.ts';
import { INITIAL_QUESTIONS } from './constants.ts';
import QuizInterface from './components/QuizInterface.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import QuestionManager from './components/QuestionManager.tsx';
import AdminSettings from './components/AdminSettings.tsx';
import TeacherPanel from './components/TeacherPanel.tsx';
import ConfirmIdentity from './components/ConfirmIdentity.tsx';
import AiQuestionLab from './components/AiQuestionLab.tsx';
import { generateResultPDF } from './services/pdfService.ts';
import { 
  pushQuestionsToCloud, 
  updateLiveSettings, 
  getLiveExamData, 
  submitResultToCloud,
  listenToSubmissions
} from './services/supabaseService.ts';

type ViewMode = 'login' | 'confirm-data' | 'quiz' | 'result' | 'admin-auth' | 'admin-panel' | 'teacher-auth' | 'teacher-panel' | 'ai-lab' | 'ai-choice';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  const [authCode, setAuthCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // State Management
  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('cbt_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cbt_settings');
    return saved ? JSON.parse(saved) : { 
      timerMinutes: 60, 
      activeToken: 'ABCDE',
      activeSubject: Subject.PANCASILA
    };
  });

  const [submissions, setSubmissions] = useState<QuizResult[]>(() => {
    const saved = localStorage.getItem('cbt_submissions');
    return saved ? JSON.parse(saved) : [];
  });

  const [identity, setIdentity] = useState<StudentIdentity>({ name: '', className: '', birthDate: '', token: '' });
  const [lastResult, setLastResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    localStorage.setItem('cbt_questions', JSON.stringify(questions));
    if (view === 'admin-panel') {
      pushQuestionsToCloud(questions);
    }
  }, [questions, view]);

  useEffect(() => {
    localStorage.setItem('cbt_settings', JSON.stringify(settings));
    if (view === 'admin-panel') {
      updateLiveSettings(settings);
    }
  }, [settings, view]);

  useEffect(() => {
    localStorage.setItem('cbt_submissions', JSON.stringify(submissions));
  }, [submissions]);

  useEffect(() => {
    if (view === 'teacher-panel') {
      const channel = listenToSubmissions((newSub) => {
        setSubmissions(prev => {
            const exists = prev.find(s => s.id === newSub.id);
            if (exists) return prev;
            const mapped: QuizResult = {
                id: newSub.id,
                identity: { name: newSub.student_name, className: newSub.class_name, birthDate: '', token: newSub.subject },
                score: newSub.score,
                totalQuestions: 0, 
                answers: newSub.answers,
                manualCorrections: {},
                timestamp: newSub.timestamp,
                duration: 0,
                isCorrected: false
            };
            return [mapped, ...prev];
        });
      });
      return () => { channel.unsubscribe(); };
    }
  }, [view]);

  const handleTeacherAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authCode === 'guru123') {
      setView('teacher-panel');
    } else {
      alert('Kode Akses Guru Salah!');
    }
  };

  const handleUpdateScore = (resultId: string, corrections: { [key: string]: number }) => {
    setSubmissions(prev => prev.map(res => {
      if (res.id === resultId) {
        const qCount = questions.filter(q => !q.isDeleted).length || 1;
        const totalPoints = Object.values(corrections).reduce((sum, val) => sum + val, 0);
        return { 
          ...res, 
          manualCorrections: corrections, 
          score: totalPoints / qCount,
          isCorrected: true 
        };
      }
      return res;
    }));
  };

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    try {
      const cloudData = await getLiveExamData();
      if (!cloudData) {
        alert('Server sedang tidak aktif atau token belum diatur oleh admin.');
        return;
      }
      if (identity.token.toUpperCase() !== cloudData.settings.activeToken.toUpperCase()) {
        alert('Token Ujian Tidak Valid! Mintalah token terbaru ke pengawas.');
        return;
      }
      setSettings(cloudData.settings);
      setQuestions(cloudData.questions);
      if (cloudData.questions.length === 0) {
        alert(`Belum ada soal untuk mata pelajaran ${cloudData.settings.activeSubject}.`);
        return;
      }
      setView('confirm-data');
    } catch (err) {
      alert('Gagal terhubung ke server ujian. Periksa koneksi internet Anda.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFinishQuiz = async (result: QuizResult) => {
    setIsSyncing(true);
    const success = await submitResultToCloud(result);
    if (success) {
      setLastResult(result);
      setView('result');
    } else {
      alert('Gagal mengirim ke server! Silakan tekan tombol Selesai lagi.');
    }
    setIsSyncing(false);
  };

  const handleImportQuestions = (newQuestions: Question[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setQuestions(newQuestions.map(q => ({ ...q, createdAt: Date.now() })));
    } else {
      setQuestions(prev => {
        const existingIds = new Set(prev.map(q => q.id));
        const filteredNew = newQuestions.filter(q => !existingIds.has(q.id));
        const uniqueNew = filteredNew.map(q => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9) + Date.now(),
          createdAt: Date.now()
        }));
        return [...prev, ...uniqueNew];
      });
    }
  };

  if (view === 'ai-lab') return <AiQuestionLab onBack={() => setView('admin-panel')} />;
  
  if (view === 'ai-choice') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600 rounded-full -mr-48 -mt-48 blur-[100px] opacity-20"></div>
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl p-12 text-center relative z-10 border border-slate-200">
          <div className="w-20 h-20 bg-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-purple-200">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <h2 className="text-3xl font-black text-slate-800 mb-4">Pilih Metode Generate</h2>
          <p className="text-slate-500 font-medium mb-10">Gunakan AI Lab internal untuk generate otomatis ke sistem, atau buka halaman eksternal untuk pengelolaan lanjutan.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <button onClick={() => setView('ai-lab')} className="group p-8 bg-slate-50 hover:bg-purple-600 border-2 border-slate-100 hover:border-purple-400 rounded-[2.5rem] transition-all flex flex-col items-center gap-4 shadow-sm hover:shadow-xl hover:shadow-purple-200">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
                </div>
                <div>
                   <p className="font-black text-slate-800 group-hover:text-white transition-colors text-sm">Lab Generator Internal</p>
                   <p className="text-[10px] font-black text-slate-400 group-hover:text-purple-200 uppercase tracking-widest mt-1">Sistem Otomatis</p>
                </div>
             </button>
             <button onClick={() => window.open('https://ai.studio/apps/drive/184oMWbuP21ZRBGJr6ZSe-30eT2UgyfAz?fullscreenApplet=true', '_blank')} className="group p-8 bg-slate-50 hover:bg-blue-600 border-2 border-slate-100 hover:border-blue-400 rounded-[2.5rem] transition-all flex flex-col items-center gap-4 shadow-sm hover:shadow-xl hover:shadow-blue-200">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </div>
                <div>
                   <p className="font-black text-slate-800 group-hover:text-white transition-colors text-sm">Halaman Generate</p>
                   <p className="text-[10px] font-black text-slate-400 group-hover:text-blue-200 uppercase tracking-widest mt-1">Eksternal Applet</p>
                </div>
             </button>
          </div>
          <button onClick={() => setView('admin-panel')} className="mt-12 text-slate-400 hover:text-slate-600 font-black text-xs uppercase tracking-[0.2em] transition-colors">Batal & Kembali</button>
        </div>
      </div>
    );
  }

  if (view === 'admin-auth') return <AdminLogin onLogin={() => setView('admin-panel')} />;

  if (view === 'admin-panel') {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="w-72 bg-slate-900 text-white flex flex-col p-6 sticky top-0 h-screen">
          <div className="font-black text-2xl mb-12 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
            CBT SERVER
          </div>
          <nav className="space-y-2">
            <button className="w-full text-left p-4 bg-white/10 rounded-xl font-bold border-l-4 border-blue-500">BANK SOAL</button>
            <button onClick={() => setView('teacher-panel')} className="w-full text-left p-4 text-slate-400 hover:text-white font-bold transition-all">PANEL MONITORING</button>
            <button onClick={() => setView('ai-choice')} className="w-full text-left p-4 text-purple-400 hover:text-purple-300 font-black flex items-center gap-2 transition-all">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
               GENERATOR AI
            </button>
            <div className="pt-8 pb-2 px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Koneksi Server</div>
            <div className="px-4 flex items-center gap-2">
               <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
               <span className="text-xs font-bold text-green-500">Online & Sinkron</span>
            </div>
          </nav>
          <button onClick={() => setView('login')} className="mt-auto p-4 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-all">KELUAR</button>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h1 className="text-3xl font-black text-slate-800">Manajemen Pusat Soal</h1>
                  <p className="text-slate-400 font-medium text-sm">Setiap soal baru akan di-upload otomatis ke Cloud.</p>
                </div>
              </div>
              <QuestionManager 
                questions={questions}
                onAdd={(q) => setQuestions(prev => [...prev, { ...q, id: Date.now().toString()+Math.random(), createdAt: Date.now(), isDeleted: false, order: q.order || (prev.length + 1) }])}
                onUpdate={(updated) => setQuestions(prev => prev.map(q => q.id === updated.id ? updated : q))}
                onSoftDelete={(id) => setQuestions(prev => prev.map(item => item.id === id ? { ...item, isDeleted: true } : item))}
                onPermanentDelete={(id) => setQuestions(prev => prev.filter(item => item.id !== id))}
                onRestore={(id) => setQuestions(prev => prev.map(item => item.id === id ? { ...item, isDeleted: false } : item))}
              />
            </div>
            <div className="lg:w-80">
              <AdminSettings 
                settings={settings} 
                questions={questions}
                onUpdateSettings={setSettings} 
                onImportQuestions={handleImportQuestions}
                onReset={() => { setQuestions([]); }} 
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
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-500/20">C</div>
                <div className="font-black text-2xl tracking-tighter">EduCBT Pro</div>
              </div>
              <h1 className="text-4xl font-black mb-6 leading-tight">Selamat Datang di Ruang Ujian Digital.</h1>
              <div className="space-y-4">
                <div className="bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Sistem</p>
                  <p className="text-xl font-black text-white">Online Synchronized</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Server Cloud Aktif</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-auto space-y-3 relative z-10">
               <div className="flex gap-2">
                 <button onClick={() => setView('admin-auth')} className="flex-1 bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 transition-all border border-white/5 uppercase tracking-widest">Administrator</button>
                 <button onClick={() => setView('teacher-auth')} className="flex-1 bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black flex items-center justify-center gap-2 transition-all border border-white/5 uppercase tracking-widest">Monitoring Guru</button>
               </div>
            </div>
          </div>
          <div className="md:w-7/12 p-12 bg-white">
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Login Peserta</h2>
              <p className="text-slate-400 font-medium mb-10 italic">Masukkan Token terbaru untuk menarik data soal dari Cloud.</p>
              
              <form onSubmit={handleStartQuiz} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap Siswa</label>
                  <input required type="text" placeholder="Masukkan nama sesuai absen" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" onChange={e => setIdentity({...identity, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas / Rombel</label>
                  <input required type="text" placeholder="Contoh: 6A / 6B" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" onChange={e => setIdentity({...identity, className: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tanggal Lahir</label>
                    <input required type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-500" onChange={e => setIdentity({...identity, birthDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Token Ujian</label>
                    <input required type="text" placeholder="5 DIGIT" className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 text-center uppercase tracking-[0.3em] outline-none focus:ring-4 focus:ring-blue-500/10" onChange={e => setIdentity({...identity, token: e.target.value})} />
                  </div>
                </div>
                <div className="pt-4">
                  <button disabled={isSyncing} className={`w-full font-black py-5 rounded-[2rem] text-xl shadow-2xl transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 disabled:opacity-50`}>
                    {isSyncing ? 'MENGHUBUNGKAN...' : 'MASUK KE RUANG UJIAN'}
                  </button>
                </div>
              </form>
              <p className="text-center mt-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">EduCBT Cloud Engine • © 2025</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'confirm-data') {
    return (
      <ConfirmIdentity 
        identity={identity} 
        settings={settings} 
        onConfirm={() => setView('quiz')} 
        onCancel={() => setView('login')} 
      />
    );
  }

  if (view === 'teacher-auth') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleTeacherAuth} className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-sm">
          <h2 className="text-2xl font-black text-center mb-6 text-slate-800">Panel Monitoring Guru</h2>
          <p className="text-slate-400 text-center text-xs font-bold mb-8 uppercase tracking-widest">Masukkan kode akses pengawas</p>
          <input type="password" autoFocus className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl mb-4 text-center font-black tracking-[0.5em] text-2xl outline-none focus:border-blue-600" placeholder="••••••" onChange={e => setAuthCode(e.target.value)} />
          <button className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-black transition-all">VERIFIKASI & MASUK</button>
          <button type="button" onClick={() => setView('login')} className="w-full mt-4 text-slate-400 font-black text-xs uppercase tracking-widest">Batal</button>
        </form>
      </div>
    );
  }

  if (view === 'teacher-panel') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto p-8">
          <div className="flex justify-between items-center mb-10">
            <div>
              <h1 className="text-3xl font-black text-slate-800">Monitoring Real-time</h1>
              <p className="text-slate-400 font-medium">Data dari Cloud akan muncul otomatis tanpa refresh.</p>
            </div>
            <div className="flex gap-3">
               <button onClick={() => setView('login')} className="bg-slate-900 text-white font-black px-6 py-3 rounded-2xl shadow-lg text-xs uppercase tracking-widest">Logout</button>
            </div>
          </div>
          <TeacherPanel results={submissions} questions={questions.filter(q => !q.isDeleted)} onUpdateScore={handleUpdateScore} />
        </div>
      </div>
    );
  }

  if (view === 'quiz') return <QuizInterface questions={questions.filter(q => !q.isDeleted && q.subject === settings.activeSubject).sort((a, b) => (a.order || 0) - (b.order || 0))} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject} onFinish={handleFinishQuiz} />;

  if (view === 'result' && lastResult) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center max-w-md w-full border border-slate-200">
           <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
           </div>
           <h2 className="text-3xl font-black mb-2 text-slate-800">Jawaban Terkirim</h2>
           <p className="text-slate-400 mb-10 font-medium italic">Data Anda telah sinkron dengan server pusat.</p>
           
           <div className="bg-blue-600 p-8 rounded-[2.5rem] mb-10 shadow-2xl shadow-blue-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-12 -mt-12"></div>
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-2 relative z-10">Skor Anda</p>
              <p className="text-7xl font-black text-white relative z-10 leading-none">{lastResult.score.toFixed(1)}</p>
           </div>
           
           <div className="grid grid-cols-2 gap-3 mb-4">
             <button onClick={() => generateResultPDF(lastResult, questions.filter(q => !q.isDeleted && q.subject === settings.activeSubject))} className="bg-slate-50 text-slate-700 font-black py-4 rounded-2xl border border-slate-200 text-xs uppercase tracking-widest hover:bg-slate-100 transition-all">Download PDF</button>
             <button onClick={() => window.location.reload()} className="bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg text-xs uppercase tracking-widest">Selesai</button>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
