
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
  const [authCode, setAuthCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  const [questions, setQuestions] = useState<Question[]>(() => {
    const saved = localStorage.getItem('cbt_questions');
    return saved ? JSON.parse(saved) : INITIAL_QUESTIONS;
  });
  
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('cbt_settings');
    return saved ? JSON.parse(saved) : { 
      timerMinutes: 60,
      activeSubject: 'Pendidikan Pancasila',
      activeToken: 'DEMO123'
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

  const handleStartQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identity.token) {
      alert('Masukkan Token Ujian!');
      return;
    }
    
    setIsSyncing(true);
    try {
      const cloudData = await getLiveExamData(identity.token);
      if (!cloudData) {
        alert('Token Tidak Valid atau Paket Soal tidak ditemukan di Cloud!');
        return;
      }
      setSettings(cloudData.settings);
      setQuestions(cloudData.questions);
      setView('confirm-data');
    } catch (err) {
      alert('Gagal terhubung ke server.');
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
      alert('Gagal mengirim ke server!');
    }
    setIsSyncing(false);
  };

  const handleImportQuestions = (newQuestions: Question[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setQuestions(newQuestions.map(q => ({ ...q, createdAt: Date.now() })));
    } else {
      setQuestions(prev => [...prev, ...newQuestions.map(q => ({ ...q, id: Math.random().toString(), createdAt: Date.now() }))]);
    }
  };

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
          </nav>
          <button onClick={() => setView('login')} className="mt-auto p-4 text-red-400 font-bold hover:bg-red-500/10 rounded-xl transition-all">KELUAR</button>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto custom-scrollbar">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <QuestionManager 
                questions={questions}
                onAdd={(q) => setQuestions(prev => [...prev, { ...q, id: Date.now().toString(), createdAt: Date.now(), isDeleted: false }])}
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
              <h1 className="text-4xl font-black mb-6 leading-tight">Mulai Ujian Anda.</h1>
              <div className="bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Sistem</p>
                <p className="text-xl font-black text-white">Dynamic Token Retrieval</p>
              </div>
            </div>
            <div className="mt-auto flex gap-2 relative z-10">
                 <button onClick={() => setView('admin-auth')} className="flex-1 bg-white/5 hover:bg-white/10 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5">Administrator</button>
            </div>
          </div>
          <div className="md:w-7/12 p-12 bg-white">
            <div className="max-w-md mx-auto">
              <h2 className="text-3xl font-black text-slate-800 mb-2">Login Peserta</h2>
              <p className="text-slate-400 font-medium mb-10 italic">Masukkan Token untuk menarik paket soal Anda.</p>
              
              <form onSubmit={handleStartQuiz} className="space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nama Lengkap Siswa</label>
                  <input required type="text" placeholder="Nama Anda" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" onChange={e => setIdentity({...identity, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kelas</label>
                  <input required type="text" placeholder="Contoh: 6A" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold" onChange={e => setIdentity({...identity, className: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tgl Lahir</label>
                    <input required type="date" className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 transition-all font-bold text-slate-500" onChange={e => setIdentity({...identity, birthDate: e.target.value})} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest ml-1">Token Paket Soal</label>
                    <input required type="text" placeholder="TOKEN" className="w-full p-4 bg-blue-50 border-2 border-blue-200 rounded-2xl font-black text-blue-700 text-center uppercase tracking-[0.3em] outline-none" onChange={e => setIdentity({...identity, token: e.target.value})} />
                  </div>
                </div>
                <div className="pt-4">
                  <button disabled={isSyncing} className="w-full font-black py-5 rounded-[2rem] text-xl shadow-2xl transition-all active:scale-95 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 disabled:opacity-50">
                    {isSyncing ? 'MENGHUBUNGKAN...' : 'MASUK RUANG UJIAN'}
                  </button>
                </div>
              </form>
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
        subjectName={settings.activeSubject}
        onConfirm={() => setView('quiz')} 
        onCancel={() => setView('login')} 
      />
    );
  }

  if (view === 'quiz') return <QuizInterface questions={questions.filter(q => !q.isDeleted)} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject} onFinish={handleFinishQuiz} />;

  if (view === 'result' && lastResult) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-12 rounded-[3.5rem] shadow-2xl text-center max-w-md w-full border border-slate-200">
           <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-200">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
           </div>
           <h2 className="text-3xl font-black mb-2 text-slate-800">Ujian Selesai</h2>
           <p className="text-slate-400 mb-10 font-medium">Data Anda telah tersinkron dengan cloud.</p>
           <div className="bg-blue-600 p-8 rounded-[2.5rem] mb-10 shadow-2xl shadow-blue-200">
              <p className="text-[10px] font-black text-blue-200 uppercase tracking-[0.2em] mb-2">Skor Akhir</p>
              <p className="text-7xl font-black text-white">{lastResult.score.toFixed(1)}</p>
           </div>
           <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl">SELESAI</button>
        </div>
      </div>
    );
  }

  return null;
};

export default App;
