
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Question, StudentIdentity, QuizResult, QuestionType } from '../types';
import MathText from './MathText.tsx';

interface QuizInterfaceProps {
  questions: Question[];
  identity: StudentIdentity;
  timeLimitMinutes: number;
  subjectName: string;
  onFinish: (result: QuizResult) => void;
  onViolation: (reason: string) => void; 
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, identity, timeLimitMinutes, subjectName, onFinish, onViolation }) => {
  const sessionKey = useMemo(() => {
    const clean = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `educbt_session_${clean(identity.name)}_${clean(identity.className)}_${clean(identity.token)}`;
  }, [identity]);

  const [currentIdx, setCurrentIdx] = useState(0);
  
  const [answers, setAnswers] = useState<{ [key: string]: any }>(() => {
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      try { return JSON.parse(saved).answers || {}; } catch (e) { return {}; }
    }
    return {};
  });

  const [doubtfuls, setDoubtfuls] = useState<{ [key: string]: boolean }>(() => {
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      try { return JSON.parse(saved).doubtfuls || {}; } catch (e) { return {}; }
    }
    return {};
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        return typeof parsed.timeLeft === 'number' ? parsed.timeLeft : timeLimitMinutes * 60; 
      } catch (e) { return timeLimitMinutes * 60; }
    }
    return timeLimitMinutes * 60;
  });

  const [fontSize, setFontSize] = useState(18);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isAutoSubmitting, setIsAutoSubmitting] = useState(false);
  
  const startTime = useRef(Date.now());
  const isSubmitting = useRef(false);

  const answersRef = useRef(answers);
  const doubtfulsRef = useRef(doubtfuls);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    doubtfulsRef.current = doubtfuls;
  }, [doubtfuls]);

  useEffect(() => {
    if (!isFullscreen) return;

    const sessionData = {
      answers,
      doubtfuls,
      timeLeft,
      lastUpdate: Date.now()
    };
    localStorage.setItem(sessionKey, JSON.stringify(sessionData));
  }, [answers, doubtfuls, timeLeft, sessionKey, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !isSubmitting.current) {
        onViolation("SISTEM: Anda dilarang keluar dari mode layar penuh selama ujian berlangsung.");
      }
    };
    const handleBlur = () => {
      if (!isSubmitting.current) onViolation("SISTEM: Anda terdeteksi berpindah jendela atau membuka aplikasi lain.");
    };
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I') || (e.ctrlKey && e.key === 'u')) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen, onViolation]);

  useEffect(() => {
    if (!isFullscreen) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { 
          clearInterval(timer); 
          handleSubmit(); 
          return 0; 
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isFullscreen]);

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => alert("Gagal mengaktifkan mode ujian."));
    }
  };

  const handleSubmit = () => {
    if (isSubmitting.current) return;
    
    setIsAutoSubmitting(true);
    isSubmitting.current = true;

    localStorage.removeItem(sessionKey);

    let correctCount = 0;
    const latestAnswers = answersRef.current;

    questions.forEach(q => {
      const studentAns = latestAnswers[q.id];
      let isCorrect = false;
      if (q.type === QuestionType.SINGLE) isCorrect = studentAns === q.correctAnswer;
      else if (q.type === QuestionType.MULTIPLE) {
        const correctSet = new Set(q.correctAnswer || []);
        const studentSet = new Set(studentAns || []);
        isCorrect = correctSet.size === studentSet.size && [...correctSet].every(x => studentSet.has(x));
      } else if (q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH) {
        const correctArr = q.correctAnswer || [];
        const studentArr = studentAns || [];
        isCorrect = correctArr.length > 0 && correctArr.length === studentArr.length && correctArr.every((v:any, i:number) => v === studentArr[i]);
      }
      if (isCorrect) correctCount++;
    });
    
    const finalScore = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }

    onFinish({ 
      id: Date.now().toString(), 
      identity, 
      score: finalScore, 
      totalQuestions: questions.length, 
      answers: latestAnswers, 
      manualCorrections: {}, 
      timestamp: Date.now(), 
      duration: Math.round((Date.now() - startTime.current) / 1000), 
      isCorrected: false 
    });
  };

  const q = questions[currentIdx];
  if (!q) return null;
  const currentAnswer = answers[q.id];
  const isDoubtful = doubtfuls[q.id] || false;

  const renderInput = () => {
    if (q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH) {
      const labels = q.tfLabels || { true: 'Benar', false: 'Salah' };
      return (
        <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
           <table className="w-full text-left">
             <thead className="bg-slate-800 text-white">
               <tr>
                 <th className="p-4 text-[10px] font-black uppercase tracking-widest">Pernyataan Analisis</th>
                 <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest w-64">Pilihan</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-200">
               {q.options?.map((opt, idx) => {
                 const resArr = currentAnswer || q.options?.map(() => null);
                 const val = resArr[idx];
                 return (
                   <tr key={idx} className="hover:bg-slate-50 transition-colors">
                     <td className="p-4 font-bold text-slate-700"><MathText text={opt} style={{ fontSize: `${fontSize - 4}px` }} /></td>
                     <td className="p-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          <button onClick={() => {
                            const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = true;
                            setAnswers({...answers, [q.id]: next});
                          }} className={`flex-1 py-2 px-1 rounded-lg text-[9px] font-black transition-all ${val === true ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400'}`}>{labels.true.toUpperCase()}</button>
                          <button onClick={() => {
                            const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = false;
                            setAnswers({...answers, [q.id]: next});
                          }} className={`flex-1 py-2 px-1 rounded-lg text-[9px] font-black transition-all ${val === false ? 'bg-red-600 text-white shadow-md' : 'text-slate-400'}`}>{labels.false.toUpperCase()}</button>
                        </div>
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
        </div>
      );
    }
    if (q.type === QuestionType.SINGLE || q.type === QuestionType.MULTIPLE) {
      const isMultiple = q.type === QuestionType.MULTIPLE;
      return (
        <div className="space-y-4">
          {isMultiple && (
            <div className="flex items-center gap-2 mb-4 bg-blue-50 p-3 rounded-xl border border-blue-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              <p className="text-blue-700 font-bold text-xs uppercase tracking-tight">Pilih lebih dari satu jawaban yang benar</p>
            </div>
          )}
          {q.options?.map((opt, idx) => {
            const isSelected = isMultiple ? (currentAnswer || []).includes(idx) : currentAnswer === idx;
            const optImg = q.optionImages?.[idx];
            return (
              <div 
                key={idx} 
                className={`w-full flex items-start p-4 text-left border-2 rounded-xl transition-all ${isSelected ? 'border-blue-600 bg-blue-50 shadow-inner' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <div 
                  onClick={() => {
                    if (isMultiple) {
                      const prev = currentAnswer || [];
                      setAnswers({...answers, [q.id]: isSelected ? prev.filter((i:any) => i !== idx) : [...prev, idx]});
                    } else setAnswers({...answers, [q.id]: idx});
                  }}
                  className={`w-10 h-10 flex items-center justify-center mr-4 shrink-0 transition-all cursor-pointer ${isMultiple ? 'rounded-lg' : 'rounded-full'} ${isSelected ? 'bg-blue-600 text-white shadow-lg' : 'bg-slate-100 text-slate-400'}`}
                >
                  {isMultiple ? (
                    isSelected ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-5 h-5 border-2 border-slate-300 rounded-sm"></div>
                    )
                  ) : (
                    <span className="font-black text-xs">{String.fromCharCode(65+idx)}</span>
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div onClick={() => {
                      if (isMultiple) {
                        const prev = currentAnswer || [];
                        setAnswers({...answers, [q.id]: isSelected ? prev.filter((i:any) => i !== idx) : [...prev, idx]});
                      } else setAnswers({...answers, [q.id]: idx});
                    }} className="cursor-pointer">
                    <MathText text={opt} className={`font-bold block ${isSelected ? 'text-blue-800' : 'text-slate-700'}`} style={{ fontSize: `${fontSize - 2}px` }} />
                  </div>
                  {optImg && (
                    <div className="relative mt-3 group w-fit">
                      <img src={optImg} onClick={() => setZoomImage(optImg)} className="max-h-40 rounded-xl border border-slate-200 shadow-sm cursor-zoom-in hover:brightness-90 transition-all" alt={`Opsi ${String.fromCharCode(65+idx)}`} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (!isFullscreen) {
    const hasSavedSession = localStorage.getItem(sessionKey) !== null;
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[2rem] p-10 max-w-lg w-full shadow-2xl">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">
            {hasSavedSession ? "Lanjutkan Ujian?" : "Siap Memulai Ujian?"}
          </h2>
          <p className="text-slate-500 mb-8 text-sm leading-relaxed font-medium">
            {hasSavedSession 
              ? "Kami mendeteksi Anda sempat keluar. Sistem akan memulihkan jawaban dan waktu Anda yang tersisa." 
              : "Sistem akan mengunci layar browser Anda ke Mode Ujian."}
          </p>
          <button onClick={requestFullscreen} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl active:scale-95 transition-all">
            {hasSavedSession ? "PULIHKAN & LANJUTKAN" : "MASUK MODE UJIAN"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col lg:h-screen lg:overflow-hidden select-none">
       <header className="bg-white border-b-4 border-blue-600 p-4 shadow-md flex justify-between items-center z-10 shrink-0">
         <div className="flex items-center gap-4">
           <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl">C</div>
           <div><h1 className="font-black text-slate-800 uppercase text-lg leading-none">E-Pro CBT</h1><p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{subjectName}</p></div>
         </div>
         <div className={`flex flex-col items-center px-8 border-l-2 border-slate-200 ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-blue-700'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1">Sisa Waktu</p>
            <p className="font-mono text-3xl font-black leading-none">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</p>
         </div>
       </header>
       
       <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-[2rem] shadow-xl border p-10 relative">
                   <div className="absolute top-0 right-0 p-6 flex gap-2">
                      <button onClick={() => setFontSize(prev => Math.min(prev + 2, 30))} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-black">A+</button>
                      <button onClick={() => setFontSize(prev => Math.max(prev - 2, 12))} className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-black">A-</button>
                   </div>
                   <div className="flex items-center gap-3 mb-8 border-b pb-6 border-slate-100">
                      <span className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg">{currentIdx + 1}</span>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{q?.type}</p>
                   </div>
                   <div className="space-y-8">
                      {q?.questionImage && (
                        <div className="flex justify-center mb-6 relative group w-fit mx-auto">
                          <img src={q.questionImage} onClick={() => setZoomImage(q.questionImage!)} className="max-w-full h-auto rounded-[1.5rem] border-4 border-white shadow-xl cursor-zoom-in" alt="Gambar Soal" />
                        </div>
                      )}
                      <MathText text={q?.text} className="leading-relaxed text-slate-800 font-medium block" style={{ fontSize: `${fontSize}px` }} />
                      <div className="pt-4">{renderInput()}</div>
                   </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-3xl border-2 border-slate-300 shadow-md gap-3">
                   <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev-1)} className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl border-b-4 border-slate-300 uppercase text-xs disabled:opacity-30">Sebelumnya</button>
                   <label className="flex items-center gap-3 cursor-pointer px-6 py-4 bg-orange-50 rounded-2xl border-2 border-orange-200">
                      <input type="checkbox" checked={isDoubtful} onChange={e => setDoubtfuls({...doubtfuls, [q.id]: e.target.checked})} className="w-6 h-6 accent-orange-500 rounded" />
                      <span className="font-black text-orange-600 uppercase text-xs">Ragu-Ragu</span>
                   </label>
                   {currentIdx === questions.length - 1 ? (
                     <button onClick={() => { if(confirm('Yakin ingin mengakhiri ujian?')) handleSubmit(); }} className="w-full sm:w-auto px-12 py-4 bg-green-600 text-white font-black rounded-2xl border-b-4 border-green-800 uppercase text-xs">Selesai</button>
                   ) : (
                     <button onClick={() => setCurrentIdx(prev => prev+1)} className="w-full sm:w-auto px-12 py-4 bg-blue-600 text-white font-black rounded-2xl border-b-4 border-blue-800 uppercase text-xs">Berikutnya</button>
                   )}
                </div>
             </div>
          </main>
          
          <aside className="w-full lg:w-80 bg-white border-l-4 border-slate-300 overflow-y-auto p-6 shrink-0 custom-scrollbar lg:h-full flex flex-col">
             <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Navigasi Soal</p>
                <div className="grid grid-cols-5 gap-2 mb-10">
                   {questions.map((item, i) => {
                      const hasAns = answers[item.id] !== undefined;
                      const isDbt = doubtfuls[item.id];
                      return (
                        <button key={item.id} onClick={() => setCurrentIdx(i)} className={`h-12 w-full flex items-center justify-center rounded-xl font-black text-sm border-b-4 transition-all ${i === currentIdx ? 'scale-105 ring-4 ring-blue-100 z-10' : ''} ${isDbt ? 'bg-orange-500 text-white border-orange-700' : hasAns ? 'bg-blue-600 text-white border-blue-800' : 'bg-white text-slate-400 border-slate-200'}`}>{i + 1}</button>
                      );
                   })}
                </div>
             </div>

             <div className="mt-auto border-t-2 border-slate-100 pt-6">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Identitas Peserta</p>
                <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-200 space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                      </div>
                      <div className="min-w-0">
                         <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nama Peserta</p>
                         <p className="text-xs font-black text-slate-800 truncate uppercase">{identity.name}</p>
                      </div>
                   </div>
                   <div className="flex items-center justify-center gap-2 pt-2">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      <p className="text-[9px] font-black text-green-600 uppercase tracking-widest">Status: Sesi Aktif</p>
                   </div>
                </div>
             </div>
          </aside>
       </div>

       {isAutoSubmitting && (
         <div className="fixed inset-0 z-[1000] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
           <div className="bg-white rounded-[3rem] p-10 max-lg w-full shadow-2xl text-center space-y-6">
              <div className="relative w-24 h-24 mx-auto">
                <div className="absolute inset-0 border-8 border-blue-100 rounded-full"></div>
                <div className="absolute inset-0 border-8 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">SINKRONISASI DATA...</h2>
           </div>
         </div>
       )}

       {zoomImage && (
         <div className="fixed inset-0 z-[999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300" onClick={() => setZoomImage(null)}>
           <button className="absolute top-6 right-6 w-12 h-12 bg-white/20 text-white rounded-full flex items-center justify-center font-black">✕</button>
           <img src={zoomImage} className="max-w-full max-h-[80vh] rounded-[2rem] border-4 border-white/20 shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
         </div>
       )}
    </div>
  );
};

export default QuizInterface;
