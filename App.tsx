
import React, { useState, useEffect } from 'react';
import { Question, Subject, StudentIdentity, QuizResult, AppSettings } from './types.ts';
import { INITIAL_QUESTIONS } from './constants.ts';
import QuizInterface from './components/QuizInterface.tsx';
import AdminLogin from './components/AdminLogin.tsx';
import QuestionManager from './components/QuestionManager.tsx';
import AdminSettings from './components/AdminSettings.tsx';
import TeacherPanel from './components/TeacherPanel.tsx';
import ConfirmIdentity from './components/ConfirmIdentity.tsx';
import { 
  pushQuestionsToCloud, 
  updateLiveSettings, 
  getLiveExamData, 
  submitResultToCloud,
  listenToSubmissions
} from './services/supabaseService.ts';

type ViewMode = 'login' | 'confirm-data' | 'quiz' | 'result' | 'admin-auth' | 'admin-panel' | 'teacher-auth' | 'teacher-panel';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('cbt_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cbt_settings');
    return saved ? JSON.parse(saved) : { timerMinutes: 60 };
  });

  const [submissions, setSubmissions] = useState<QuizResult[]>(() => {
    const saved = localStorage.getItem('cbt_submissions');
    return saved ? JSON.parse(saved) : [];
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
    localStorage.setItem('cbt_submissions', JSON.stringify(submissions));
  }, [submissions]);

  const handleCloudSync = async () => {
    if (questions.length === 0) {
      alert("Bank soal kosong! Tambahkan minimal satu soal sebelum melakukan sinkronisasi.");
      return;
    }

    setSyncStatus('loading');
    try {
      // 1. Kirim Soal
      await pushQuestionsToCloud(questions);
      // 2. Kirim Pengaturan Waktu
      await updateLiveSettings(settings);
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000);
    } catch (err: any) {
      console.error("Dashboard Sync Error:", err);
      setSyncStatus('error');
      // Menampilkan pesan error detail agar Admin tahu penyebabnya
      alert(`GAGAL SINKRONISASI!\n\nPesan: ${err.message}\n\nPastikan koneksi internet stabil dan format data soal benar.`);
    }
  };

  useEffect(() => {
    if (view === 'teacher-panel') {
      const channel = listenToSubmissions((newSub) => {
        setSubmissions(prev => {
            if (prev.find(s => s.id === newSub.id)) return prev;
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

  const handleFinishQuiz = async (result: QuizResult) => {
    setIsSyncing(true);
    const success = await submitResultToCloud(result);
    if (success) {
      setLastResult(result);
      setView('result');
    } else {
      alert('Jawaban tersimpan di memori browser, tapi gagal terkirim ke server. Jangan tutup halaman ini dan coba tekan Selesai lagi.');
    }
    setIsSyncing(false);
  };

  // Render logic tetap sama...
  if (view === 'admin-auth') return <AdminLogin onLogin={() => setView('admin-panel')} />;
  if (view === 'admin-panel') {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="w-72 bg-slate-900 text-white flex flex-col p-6 sticky top-0 h-screen">
          <div className="font-black text-2xl mb-12 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg"></div>
            CBT SERVER
          </div>
          
          <nav className="space-y-2 flex-1">
            <button className="w-full text-left p-4 bg-white/10 rounded-xl font-bold border-l-4 border-blue-500 uppercase text-[10px] tracking-widest">Bank Soal</button>
            <button onClick={() => setView('teacher-panel')} className="w-full text-left p-4 text-slate-400 hover:text-white font-bold transition-all uppercase text-[10px] tracking-widest">Monitoring</button>
          </nav>

          <div className="mt-auto space-y-4">
            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
               <div className="flex items-center justify-between mb-3">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Status Cloud</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-[9px] font-black text-green-500 uppercase">Online</span>
                  </div>
               </div>
               <button 
                 onClick={handleCloudSync}
                 disabled={syncStatus === 'loading'}
                 className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-xl ${
                   syncStatus === 'loading' ? 'bg-slate-700 text-slate-400 cursor-not-allowed' :
                   syncStatus === 'success' ? 'bg-green-600 text-white' :
                   syncStatus === 'error' ? 'bg-red-600 text-white' :
                   'bg-blue-600 hover:bg-blue-700 text-white'
                 }`}
               >
                 {syncStatus === 'loading' ? 'Sedang Sync...' : syncStatus === 'success' ? 'BERHASIL DISYNC' : 'SINKRONISASI CLOUD'}
               </button>
            </div>
            <button onClick={() => setView('login')} className="w-full p-4 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-all text-left uppercase text-[10px] tracking-widest">Keluar</button>
          </div>
        </aside>

        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <div className="mb-8">
                <h1 className="text-3xl font-black text-slate-800">Bank Soal Dinamis</h1>
                <p className="text-slate-400 font-medium text-sm italic">Isi kolom "Token" pada tiap soal agar siswa dapat mengakses paket soal tersebut.</p>
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
            <div className="lg:w-80">
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

  // View lain seperti login, quiz, result tetap sama strukturnya...
  if (view === 'login') {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-inter">
        <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row border border-slate-200">
          <div className="md:w-5/12 bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600 rounded-full -mr-32 -mt-32 blur-3xl opacity-20"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-12">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center font-black text-xl shadow-lg">C</div>
                <div className="font-black text-2xl tracking-tighter">EduCBT Pro</div>
              </div>
              <h1 className="text-4xl font-black mb-6 leading-tight">Mulai Ujian Anda.</h1>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Sistem</p>
                <p className="text-xl font-black text-white italic">Full Dynamic Partitioning</p>
              </div>
            </div>
            <button onClick={() => setView('admin-auth')} className="mt-auto bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 transition-all">Administrator</button>
          </div>
          <div className="md:w-7/12 p-12 bg-white">
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Login Peserta</h2>
              <p className="text-slate-400 font-medium mb-10 italic">Masukkan identitas dan token ujian dari Guru.</p>
              
              <form onSubmit={handleStartQuiz} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input required type="text" placeholder="Nama Lengkap Anda" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" onChange={e => setIdentity({...identity, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas</label>
                  <input required type="text" placeholder="Contoh: 6A" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" onChange={e => setIdentity({...identity, className: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Token Ujian</label>
                  <input required type="text" placeholder="Contoh: IPA01" className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 text-center uppercase tracking-[0.3em] outline-none placeholder:opacity-30" onChange={e => setIdentity({...identity, token: e.target.value})} />
                </div>
                <div className="pt-4">
                  <button disabled={isSyncing} className="w-full font-black py-5 rounded-[2rem] text-xl shadow-2xl transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200">
                    {isSyncing ? 'MENGHUBUNGKAN...' : 'MASUK KE UJIAN'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'confirm-data') return <ConfirmIdentity identity={identity} settings={settings} onConfirm={() => setView('quiz')} onCancel={() => setView('login')} />;
  if (view === 'quiz') return <QuizInterface questions={questions.filter(q => !q.isDeleted)} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject || 'Ujian Digital'} onFinish={handleFinishQuiz} />;
  
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
           <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl transition-all hover:bg-black">KEMBALI KE LOGIN</button>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
