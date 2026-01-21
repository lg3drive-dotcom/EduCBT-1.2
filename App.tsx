
import React, { useState, useEffect } from 'react';
import { Question, Subject, StudentIdentity, QuizResult, AppSettings } from './types';
import { INITIAL_QUESTIONS } from './constants';
import QuizInterface from './components/QuizInterface';
import AdminLogin from './components/AdminLogin';
import QuestionManager from './components/QuestionManager';
import AdminSettings from './components/AdminSettings';
import TeacherPanel from './components/TeacherPanel';
import { generateResultPDF } from './services/pdfService';

type ViewMode = 'login' | 'quiz' | 'result' | 'admin-auth' | 'admin-panel' | 'teacher-auth' | 'teacher-panel';

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('login');
  const [authCode, setAuthCode] = useState('');

  // App State
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

  useEffect(() => { localStorage.setItem('cbt_questions', JSON.stringify(questions)); }, [questions]);
  useEffect(() => { localStorage.setItem('cbt_settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('cbt_submissions', JSON.stringify(submissions)); }, [submissions]);

  const activeQuestionsForQuiz = questions
    .filter(q => !q.isDeleted && q.subject === settings.activeSubject)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
    
  const totalQuestionsAvailable = activeQuestionsForQuiz.length;

  const handleStartQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    if (identity.token.toUpperCase() !== settings.activeToken.toUpperCase()) return alert('Token Ujian Tidak Valid!');
    if (totalQuestionsAvailable === 0) return alert(`Belum ada soal untuk mata pelajaran ${settings.activeSubject}.`);
    setView('quiz');
  };

  const handleFinishQuiz = (result: QuizResult) => {
    setSubmissions(prev => [...prev, result]);
    setLastResult(result);
    setView('result');
  };

  const handleTeacherAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (authCode === 'guru123') setView('teacher-panel');
    else alert('Kode Guru Salah!');
  };

  const handleUpdateScore = (resultId: string, corrections: {[key: string]: number}) => {
    setSubmissions(prev => prev.map(res => {
      if (res.id === resultId) {
        return { ...res, manualCorrections: corrections, isCorrected: true };
      }
      return res;
    }));
  };

  const handleImportQuestions = (newQuestions: Question[], mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setQuestions(newQuestions.map(q => ({ ...q, createdAt: Date.now() })));
    } else {
      // Logic for append is already filtered for duplicates in AdminSettings if user chooses to see warning,
      // but we ensure uniqueness by ID here just in case.
      setQuestions(prev => {
        const existingIds = new Set(prev.map(q => q.id));
        const filteredNew = newQuestions.filter(q => !existingIds.has(q.id));
        
        // Regenerate IDs for imported questions to ensure they don't conflict with any future state
        const uniqueNew = filteredNew.map(q => ({
          ...q,
          id: Math.random().toString(36).substr(2, 9) + Date.now(),
          createdAt: Date.now()
        }));
        
        return [...prev, ...uniqueNew];
      });
    }
    alert('Import berhasil diselesaikan!');
  };

  if (view === 'admin-auth') return <AdminLogin onLogin={() => setView('admin-panel')} />;

  if (view === 'admin-panel') {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <aside className="w-72 bg-slate-900 text-white flex flex-col p-6 sticky top-0 h-screen">
          <div className="font-black text-2xl mb-12">CBT ADMIN</div>
          <button className="w-full text-left p-4 bg-white/10 rounded-xl font-bold mb-2">BANK SOAL</button>
          <button onClick={() => setView('teacher-auth')} className="w-full text-left p-4 text-slate-400 hover:text-white font-bold">PANEL GURU</button>
          <button onClick={() => setView('login')} className="mt-auto p-4 text-red-400 font-bold">KELUAR</button>
        </aside>
        <main className="flex-1 p-8 overflow-y-auto">
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <h1 className="text-3xl font-black mb-8">Manajemen Soal</h1>
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

  if (view === 'teacher-auth') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form onSubmit={handleTeacherAuth} className="bg-white p-8 rounded-[2rem] shadow-2xl w-full max-sm:w-full max-w-sm">
          <h2 className="text-2xl font-black text-center mb-6">Login Panel Guru</h2>
          <input type="password" autoFocus className="w-full p-4 border rounded-xl mb-4 text-center font-black tracking-widest" placeholder="KODE GURU" onChange={e => setAuthCode(e.target.value)} />
          <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl">MASUK</button>
          <button type="button" onClick={() => setView('login')} className="w-full mt-2 text-slate-400 font-bold">Batal</button>
        </form>
      </div>
    );
  }

  if (view === 'teacher-panel') {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-6xl mx-auto p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-black">Panel Guru</h1>
            <button onClick={() => setView('login')} className="bg-white text-slate-600 font-bold px-6 py-2 rounded-xl border">LOGOUT</button>
          </div>
          <TeacherPanel results={submissions} questions={questions.filter(q => !q.isDeleted)} onUpdateScore={handleUpdateScore} />
        </div>
      </div>
    );
  }

  if (view === 'quiz') return <QuizInterface questions={activeQuestionsForQuiz} identity={identity} timeLimitMinutes={settings.timerMinutes} subjectName={settings.activeSubject} onFinish={handleFinishQuiz} />;

  if (view === 'result' && lastResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-md w-full">
           <div className="text-6xl mb-6">🏆</div>
           <h2 className="text-3xl font-black mb-2">Ujian Selesai</h2>
           <p className="text-slate-400 mb-8 font-bold">Terima kasih, {lastResult.identity.name}</p>
           <div className="bg-blue-50 p-6 rounded-3xl mb-8">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1">Skor Sementara</p>
              <p className="text-5xl font-black text-blue-800">{lastResult.score.toFixed(1)}</p>
           </div>
           <button onClick={() => generateResultPDF(lastResult, activeQuestionsForQuiz)} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl mb-3">DOWNLOAD PDF</button>
           <button onClick={() => window.location.reload()} className="w-full text-slate-400 font-bold">KEMBALI</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col md:flex-row">
        <div className="md:w-5/12 bg-blue-700 p-12 text-white flex flex-col justify-between">
          <div>
            <div className="font-black text-3xl mb-8">EduCBT</div>
            <h1 className="text-4xl font-black mb-4">Sistem Ujian Terintegrasi</h1>
            <div className="bg-white/10 p-4 rounded-2xl border border-white/20 mb-6">
              <p className="text-xs font-bold text-blue-200 uppercase tracking-widest mb-1">Ujian Aktif</p>
              <p className="text-xl font-black text-white">{settings.activeSubject}</p>
              <p className="text-[10px] text-blue-200/60 mt-2 italic font-medium">Tersedia {totalQuestionsAvailable} soal untuk Anda.</p>
            </div>
          </div>
          <div className="mt-auto space-y-3">
             <button onClick={() => setView('admin-auth')} className="w-full bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">🔒 PANEL ADMIN</button>
             <button onClick={() => setView('teacher-auth')} className="w-full bg-white/10 hover:bg-white/20 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all">👨‍🏫 PANEL GURU</button>
          </div>
        </div>
        <div className="md:w-7/12 p-12">
          <h2 className="text-3xl font-black mb-8">Login Peserta</h2>
          <form onSubmit={handleStartQuiz} className="space-y-6">
            <input required type="text" placeholder="Nama Lengkap" className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-600" onChange={e => setIdentity({...identity, name: e.target.value})} />
            <input required type="text" placeholder="Kelas" className="w-full p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-600" onChange={e => setIdentity({...identity, className: e.target.value})} />
            <div className="grid grid-cols-2 gap-4">
              <input required type="date" className="p-4 bg-slate-50 border-2 rounded-2xl outline-none focus:border-blue-600" onChange={e => setIdentity({...identity, birthDate: e.target.value})} />
              <input required type="text" placeholder="TOKEN" className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl font-black text-blue-700 text-center uppercase tracking-widest" onChange={e => setIdentity({...identity, token: e.target.value})} />
            </div>
            <button className={`w-full font-black py-5 rounded-2xl text-xl shadow-xl transition-all ${totalQuestionsAvailable > 0 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`} disabled={totalQuestionsAvailable === 0}>
              {totalQuestionsAvailable > 0 ? 'MULAI UJIAN' : 'UJIAN BELUM TERSEDIA'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;
