
// Import React to ensure React namespace is available for React.FC
import React, { useState, useEffect, useRef } from 'react';
import { Question, StudentIdentity, QuizResult, QuestionType } from '../types';

interface QuizInterfaceProps {
  questions: Question[];
  identity: StudentIdentity;
  timeLimitMinutes: number;
  subjectName: string;
  onFinish: (result: QuizResult) => void;
  onViolation: (reason: string) => void; 
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, identity, timeLimitMinutes, subjectName, onFinish, onViolation }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [doubtfuls, setDoubtfuls] = useState<{ [key: string]: boolean }>({});
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const [fontSize, setFontSize] = useState(18);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const startTime = useRef(Date.now());
  const isSubmitting = useRef(false);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (isSubmitting.current) return;
      if (document.visibilityState === 'hidden') {
        onViolation("Anda terdeteksi meninggalkan halaman ujian (pindah tab/aplikasi).");
      }
    };

    const handleBlur = () => {
      if (isSubmitting.current) return;
      setTimeout(() => {
        if (!document.hasFocus() && isFullscreen && !isSubmitting.current) {
           onViolation("Koneksi jendela ujian terputus karena fokus berpindah.");
        }
      }, 500);
    };

    const handleFullscreenChange = () => {
      if (isSubmitting.current) return;
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        onViolation("Anda dilarang keluar dari Mode Layar Penuh selama ujian berlangsung.");
      }
    };

    if (isFullscreen) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('blur', handleBlur);
      document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen, onViolation]);

  useEffect(() => {
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
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isSubmitting.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(err => {
        alert("Gagal mengaktifkan mode fullscreen. Pastikan browser Anda mendukung.");
      });
    }
  };

  const handleSubmit = () => {
    if (isSubmitting.current) return;
    isSubmitting.current = true;

    let score = 0;
    const weight = 100 / (questions.length || 1);
    
    questions.forEach(q => {
      const studentAns = answers[q.id];
      let isCorrect = false;

      if (q.type === QuestionType.SINGLE) isCorrect = studentAns === q.correctAnswer;
      else if (q.type === QuestionType.MULTIPLE) {
        const correctSet = new Set(q.correctAnswer || []);
        const studentSet = new Set(studentAns || []);
        isCorrect = correctSet.size === studentSet.size && [...correctSet].every(x => studentSet.has(x));
      }
      else if (q.type === QuestionType.COMPLEX_CATEGORY) {
        const correctArr = q.correctAnswer || [];
        const studentArr = studentAns || [];
        isCorrect = correctArr.length === studentArr.length && correctArr.every((v:any, i:number) => v === studentArr[i]);
      }

      if (isCorrect) score += weight;
    });

    if (document.fullscreenElement) {
      document.exitFullscreen();
    }

    onFinish({ 
      id: Date.now().toString(), 
      identity, 
      score, 
      totalQuestions: questions.length, 
      answers, 
      manualCorrections: {}, 
      timestamp: Date.now(), 
      duration: Math.round((Date.now() - startTime.current) / 1000), 
      isCorrected: false 
    });
  };

  if (!isFullscreen) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-center">
        <div className="bg-white rounded-[2rem] lg:rounded-[3rem] p-8 lg:p-12 max-w-lg w-full shadow-2xl">
          <div className="w-20 h-20 lg:w-24 lg:h-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 lg:mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 lg:h-12 lg:w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-slate-800 mb-4">Mode Ujian Terkunci</h2>
          <p className="text-slate-500 font-medium mb-8 leading-relaxed text-sm lg:text-base">
            Sistem mewajibkan penggunaan <b>Mode Layar Penuh</b>. 
            Anda dilarang membuka tab lain atau meminimalkan browser hingga ujian selesai.
          </p>
          <button 
            onClick={requestFullscreen}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 lg:py-5 rounded-[1.5rem] lg:rounded-[2rem] text-lg lg:text-xl shadow-2xl transition-all active:scale-95 uppercase tracking-widest"
          >
            AKTIFKAN UJIAN
          </button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  const currentAnswer = answers[q.id];
  const isDoubtful = doubtfuls[q.id] || false;

  const getQuestionStatus = (idx: number) => {
    const qId = questions[idx].id;
    const hasAnswer = answers[qId] !== undefined && (Array.isArray(answers[qId]) ? answers[qId].length > 0 : true);
    const doubtful = doubtfuls[qId];
    if (doubtful) return 'doubtful';
    if (hasAnswer) return 'answered';
    return 'unanswered';
  };

  const renderInput = () => {
    if (!q) return null;
    switch (q.type) {
      case QuestionType.SINGLE:
        return (
          <div className="space-y-4">
            {q.options?.map((opt, idx) => (
              <button 
                key={idx} 
                onClick={() => setAnswers({...answers, [q.id]: idx})} 
                className={`w-full flex items-center p-4 text-left border-2 rounded-xl transition-all group ${currentAnswer === idx ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
              >
                <span className={`w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg font-black mr-4 shrink-0 transition-all ${currentAnswer === idx ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-400 group-hover:border-blue-300'}`}>
                  {String.fromCharCode(65+idx)}
                </span>
                <div className="flex flex-col gap-2 flex-1">
                   {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="max-w-xs h-auto max-h-40 object-contain rounded-lg mb-2 border bg-white pointer-events-none" alt={`Opsi ${idx+1}`} />}
                   <span className="font-bold text-slate-700" style={{ fontSize: `${fontSize - 2}px` }}>{opt}</span>
                </div>
              </button>
            ))}
          </div>
        );
      case QuestionType.MULTIPLE:
        return (
          <div className="space-y-4">
            {q.options?.map((opt, idx) => {
              const selected = (currentAnswer || []).includes(idx);
              return (
                <button key={idx} onClick={() => {
                  const prev = currentAnswer || [];
                  const next = selected ? prev.filter((i:any) => i !== idx) : [...prev, idx];
                  setAnswers({...answers, [q.id]: next});
                }} className={`w-full flex items-center p-4 text-left border-2 rounded-xl transition-all ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className={`w-6 h-6 border-2 rounded-md mr-4 flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 border-blue-600 shadow-md' : 'border-slate-300 bg-white'}`}>
                    {selected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                     {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="max-w-xs h-auto max-h-40 object-contain rounded-lg border mb-2 bg-white pointer-events-none" alt={`Opsi ${idx+1}`} />}
                     <span className="font-bold text-slate-700" style={{ fontSize: `${fontSize - 2}px` }}>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        );
      case QuestionType.COMPLEX_CATEGORY:
        return (
          <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-x-auto shadow-sm">
             <table className="w-full text-left min-w-[300px]">
               <thead className="bg-slate-800 text-white">
                 <tr>
                   <th className="p-3 lg:p-4 text-[10px] font-black uppercase tracking-widest">Pernyataan Analisis</th>
                   <th className="p-3 lg:p-4 text-center text-[10px] font-black uppercase tracking-widest w-24 lg:w-48">Kesesuaian</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {q.options?.map((opt, idx) => {
                   const resArr = currentAnswer || q.options?.map(() => null);
                   const val = resArr[idx];
                   return (
                     <tr key={idx} className="hover:bg-slate-50/50">
                       <td className="p-3 lg:p-4">
                          <div className="flex flex-col gap-2">
                            {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="w-16 lg:w-24 h-auto rounded-lg border mb-1 bg-white pointer-events-none" alt="Ilustrasi" />}
                            <span className="font-bold text-slate-700" style={{ fontSize: `${fontSize - 4}px` }}>{opt}</span>
                          </div>
                       </td>
                       <td className="p-3 lg:p-4">
                          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                            <button onClick={() => {
                              const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = true;
                              setAnswers({...answers, [q.id]: next});
                            }} className={`flex-1 py-1.5 lg:py-2 px-1 rounded-lg text-[8px] lg:text-[9px] font-black transition-all ${val === true ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>YA</button>
                            <button onClick={() => {
                              const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = false;
                              setAnswers({...answers, [q.id]: next});
                            }} className={`flex-1 py-1.5 lg:py-2 px-1 rounded-lg text-[8px] lg:text-[9px] font-black transition-all ${val === false ? 'bg-red-600 text-white shadow-md' : 'text-slate-400'}`}>TIDAK</button>
                          </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col select-none lg:h-screen lg:overflow-hidden" onContextMenu={e => e.preventDefault()}>
       <header className="bg-white border-b-4 border-blue-600 p-3 lg:p-4 shadow-md flex justify-between items-center z-10 shrink-0">
         <div className="flex items-center gap-2 lg:gap-4">
           <div className="bg-blue-600 text-white w-10 h-10 lg:w-12 lg:h-12 rounded-xl flex items-center justify-center font-black text-xl lg:text-2xl shadow-lg">C</div>
           <div>
             <h1 className="font-black text-slate-800 uppercase tracking-tight text-sm lg:text-lg leading-none">EduCBT Pro</h1>
             <p className="text-slate-400 text-[8px] lg:text-[10px] font-black uppercase tracking-widest">{subjectName}</p>
           </div>
         </div>
         
         <div className="flex items-center gap-4 lg:gap-8">
            <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
               <span className="text-[10px] font-black text-slate-400 px-3 uppercase tracking-tighter">Font</span>
               <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-bold hover:bg-blue-50 transition-all shadow-sm">A-</button>
               <button onClick={() => setFontSize(18)} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-bold hover:bg-blue-50 transition-all shadow-sm mx-1">A</button>
               <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-bold hover:bg-blue-50 transition-all shadow-sm">A+</button>
            </div>

            <div className={`flex flex-col items-center px-4 lg:px-8 border-l-2 border-slate-200 transition-colors ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-blue-700'}`}>
               <p className="text-[8px] lg:text-[10px] font-black uppercase tracking-widest mb-0.5 lg:mb-1">Waktu</p>
               <p className="font-mono text-xl lg:text-3xl font-black leading-none">
                 {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
               </p>
            </div>
         </div>
       </header>

       <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-[1.5rem] lg:rounded-[2rem] shadow-xl border border-white p-6 lg:p-10 relative overflow-hidden">
                   <div className="flex justify-between items-center mb-6 lg:mb-8 border-b pb-4 lg:pb-6 border-slate-100">
                      <div className="flex items-center gap-3">
                         <span className="bg-blue-600 text-white w-10 h-10 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl flex items-center justify-center font-black text-xl lg:text-2xl shadow-lg shadow-blue-100">{currentIdx + 1}</span>
                         <div>
                            <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Soal Nomor</p>
                            <p className="text-[10px] lg:text-sm font-black text-slate-800 uppercase tracking-tighter">{q?.type}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">Kesulitan</p>
                         <p className="text-[10px] lg:text-sm font-black text-purple-600 uppercase tracking-tighter">{q?.level.split(' ')[0]}</p>
                      </div>
                   </div>

                   <div className="space-y-6 lg:space-y-8">
                      <div className="leading-relaxed text-slate-800 font-medium" style={{ fontSize: `${fontSize}px`, whiteSpace: 'pre-wrap' }}>
                        {q?.text}
                      </div>

                      {q?.questionImage && (
                        <div className="rounded-2xl lg:rounded-3xl border-4 border-slate-50 shadow-inner overflow-hidden bg-slate-100 p-2">
                          <img src={q.questionImage} className="max-w-full h-auto mx-auto rounded-xl lg:rounded-2xl shadow-sm pointer-events-none" alt="Ilustrasi Soal" />
                        </div>
                      )}

                      <div className="pt-2 lg:pt-4">
                        {renderInput()}
                      </div>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-3 lg:p-4 rounded-[1.5rem] lg:rounded-3xl border-2 border-slate-300/50 shadow-md gap-3">
                   <button 
                     disabled={currentIdx === 0} 
                     onClick={() => { setCurrentIdx(prev => prev-1); window.scrollTo({top: 0, behavior: 'smooth'}); }} 
                     className="w-full sm:w-auto px-6 lg:px-8 py-3 lg:py-4 bg-slate-100 text-slate-500 font-black rounded-xl lg:rounded-2xl border-b-4 border-slate-300 hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest text-[10px] lg:text-xs"
                   >
                     Sebelumnya
                   </button>

                   <label className="flex items-center gap-3 cursor-pointer group px-4 lg:px-6 py-3 lg:py-4 bg-orange-50 rounded-xl lg:rounded-2xl border-2 border-orange-200 hover:bg-orange-100 transition-all">
                      <input 
                        type="checkbox" 
                        checked={isDoubtful} 
                        onChange={e => setDoubtfuls({...doubtfuls, [q.id]: e.target.checked})} 
                        className="w-5 h-5 lg:w-6 lg:h-6 accent-orange-500 rounded"
                      />
                      <span className="font-black text-orange-600 uppercase tracking-widest text-[10px] lg:text-xs">Ragu-Ragu</span>
                   </label>

                   {currentIdx === questions.length - 1 ? (
                     <button onClick={handleSubmit} className="w-full sm:w-auto px-10 lg:px-12 py-3 lg:py-4 bg-green-600 text-white font-black rounded-xl lg:rounded-2xl border-b-4 border-green-800 shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 uppercase tracking-widest text-[10px] lg:text-xs">Selesai</button>
                   ) : (
                     <button onClick={() => { setCurrentIdx(prev => prev+1); window.scrollTo({top: 0, behavior: 'smooth'}); }} className="w-full sm:w-auto px-10 lg:px-12 py-3 lg:py-4 bg-blue-600 text-white font-black rounded-xl lg:rounded-2xl border-b-4 border-blue-800 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest text-[10px] lg:text-xs">Berikutnya</button>
                   )}
                </div>
             </div>
          </main>

          <aside className="w-full lg:w-80 bg-white border-t-4 lg:border-t-0 lg:border-l-4 border-slate-300 overflow-y-auto p-4 lg:p-6 flex flex-col gap-6 shrink-0 custom-scrollbar shadow-inner lg:h-full">
             <div className="bg-blue-50 p-3 lg:p-4 rounded-xl lg:rounded-2xl border border-blue-100">
                <p className="text-[8px] lg:text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Status Navigasi</p>
                <div className="flex flex-wrap gap-2">
                   <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm"></div><span className="text-[8px] lg:text-[9px] font-bold text-slate-500">DIJAWAB</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-orange-500 rounded-sm"></div><span className="text-[8px] lg:text-[9px] font-bold text-slate-500">RAGU</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-white border border-slate-300 rounded-sm"></div><span className="text-[8px] lg:text-[9px] font-bold text-slate-500">BELUM</span></div>
                </div>
             </div>

             <div className="flex-1">
                <p className="text-[8px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Nomor Soal</p>
                <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2">
                   {questions.map((item, i) => {
                      const status = getQuestionStatus(i);
                      return (
                        <button 
                          key={item.id} 
                          onClick={() => { setCurrentIdx(i); window.scrollTo({top: 0, behavior: 'smooth'}); }}
                          className={`
                            h-10 lg:h-12 w-full flex items-center justify-center rounded-lg lg:rounded-xl font-black text-xs lg:text-sm transition-all border-b-4
                            ${i === currentIdx ? 'scale-105 shadow-xl ring-2 lg:ring-4 ring-blue-600/20' : ''}
                            ${status === 'doubtful' ? 'bg-orange-500 text-white border-orange-700' : 
                              status === 'answered' ? 'bg-blue-600 text-white border-blue-800' : 
                              'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}
                          `}
                        >
                          {i + 1}
                        </button>
                      );
                   })}
                </div>
             </div>

             <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl space-y-4">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                   </div>
                   <div className="flex-1 min-w-0">
                      <p className="text-[8px] lg:text-[10px] font-black text-slate-500 uppercase tracking-widest">Nama Peserta</p>
                      <p className="font-bold text-sm truncate leading-none">{identity.name}</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                      <p className="text-[7px] lg:text-[8px] font-black text-slate-500 uppercase mb-1">Kelas</p>
                      <p className="font-black text-[11px] lg:text-xs truncate">{identity.className}</p>
                   </div>
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
                      <p className="text-[7px] lg:text-[8px] font-black text-slate-500 uppercase mb-1">Status</p>
                      <p className="font-black text-[11px] lg:text-xs text-blue-400">
                        {Object.keys(answers).filter(k => answers[k] !== undefined && (Array.isArray(answers[k]) ? answers[k].length > 0 : true)).length}/{questions.length}
                      </p>
                   </div>
                </div>

                <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                   <p className="text-[7px] lg:text-[8px] font-black text-slate-500 uppercase mb-1">Asal Sekolah</p>
                   <p className="font-bold text-[10px] truncate">{identity.schoolOrigin || '-'}</p>
                </div>
             </div>
          </aside>
       </div>
    </div>
  );
};

export default QuizInterface;
