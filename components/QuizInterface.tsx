
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
        onViolation("Anda terdeteksi meninggalkan halaman ujian.");
      }
    };
    if (isFullscreen) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
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
    return () => clearInterval(timer);
  }, []);

  const requestFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen().then(() => setIsFullscreen(true));
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
      else if (q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX) {
        const correctArr = q.correctAnswer || [];
        const studentArr = studentAns || [];
        isCorrect = correctArr.length === studentArr.length && correctArr.every((v:any, i:number) => v === studentArr[i]);
      }

      if (isCorrect) score += weight;
    });

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
        <div className="bg-white rounded-[2rem] p-8 max-w-lg w-full">
          <h2 className="text-2xl font-black text-slate-800 mb-4">Mulai Ujian</h2>
          <p className="text-slate-500 mb-8">Klik tombol di bawah untuk masuk ke mode layar penuh.</p>
          <button onClick={requestFullscreen} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest shadow-xl">AKTIFKAN UJIAN</button>
        </div>
      </div>
    );
  }

  const q = questions[currentIdx];
  const currentAnswer = answers[q.id];
  const isDoubtful = doubtfuls[q.id] || false;

  const renderInput = () => {
    if (!q) return null;
    const isTF = q.type === QuestionType.TRUE_FALSE_COMPLEX;
    const isComplex = q.type === QuestionType.COMPLEX_CATEGORY || isTF;

    if (isComplex) {
      const labels = q.tfLabels || { true: 'Ya', false: 'Tidak' };
      return (
        <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
           <table className="w-full text-left">
             <thead className="bg-slate-800 text-white">
               <tr>
                 <th className="p-4 text-[10px] font-black uppercase tracking-widest">Pernyataan Analisis</th>
                 <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest w-64">Kesesuaian</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-slate-200">
               {q.options?.map((opt, idx) => {
                 const resArr = currentAnswer || q.options?.map(() => null);
                 const val = resArr[idx];
                 return (
                   <tr key={idx} className="hover:bg-slate-50">
                     <td className="p-4 font-bold text-slate-700" style={{ fontSize: `${fontSize - 4}px` }}>{opt}</td>
                     <td className="p-4">
                        <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                          <button onClick={() => {
                            const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = true;
                            setAnswers({...answers, [q.id]: next});
                          }} className={`flex-1 py-2 px-1 rounded-lg text-[9px] font-black transition-all ${val === true ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>
                            {labels.true.toUpperCase()}
                          </button>
                          <button onClick={() => {
                            const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = false;
                            setAnswers({...answers, [q.id]: next});
                          }} className={`flex-1 py-2 px-1 rounded-lg text-[9px] font-black transition-all ${val === false ? 'bg-red-600 text-white shadow-md' : 'text-slate-400'}`}>
                            {labels.false.toUpperCase()}
                          </button>
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

    if (q.type === QuestionType.SINGLE) {
      return (
        <div className="space-y-4">
          {q.options?.map((opt, idx) => {
            const optImg = q.optionImages?.[idx];
            return (
              <button key={idx} onClick={() => setAnswers({...answers, [q.id]: idx})} className={`w-full flex items-start p-4 text-left border-2 rounded-xl transition-all ${currentAnswer === idx ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <span className={`w-10 h-10 flex items-center justify-center rounded-lg font-black mr-4 shrink-0 ${currentAnswer === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+idx)}</span>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-slate-700 block" style={{ fontSize: `${fontSize - 2}px` }}>{opt}</span>
                  {optImg && (
                    <img src={optImg} className="mt-3 max-h-40 rounded-xl border border-slate-200 shadow-sm" alt={`Opsi ${idx}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    if (q.type === QuestionType.MULTIPLE) {
      return (
        <div className="space-y-4">
          {q.options?.map((opt, idx) => {
            const selected = (currentAnswer || []).includes(idx);
            const optImg = q.optionImages?.[idx];
            return (
              <button key={idx} onClick={() => {
                const prev = currentAnswer || [];
                const next = selected ? prev.filter((i:any) => i !== idx) : [...prev, idx];
                setAnswers({...answers, [q.id]: next});
              }} className={`w-full flex items-start p-4 text-left border-2 rounded-xl transition-all ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <div className={`w-6 h-6 border-2 rounded-md mr-4 shrink-0 flex items-center justify-center mt-1 ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300'}`}>
                  {selected && '✓'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-slate-700 block" style={{ fontSize: `${fontSize - 2}px` }}>{opt}</span>
                  {optImg && (
                    <img src={optImg} className="mt-3 max-h-40 rounded-xl border border-slate-200 shadow-sm" alt={`Opsi ${idx}`} />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col lg:h-screen lg:overflow-hidden">
       <header className="bg-white border-b-4 border-blue-600 p-4 shadow-md flex justify-between items-center z-10 shrink-0">
         <div className="flex items-center gap-4">
           <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl">C</div>
           <div>
             <h1 className="font-black text-slate-800 uppercase text-lg leading-none">EduCBT Pro</h1>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{subjectName}</p>
           </div>
         </div>
         <div className="flex items-center gap-8">
            <div className={`flex flex-col items-center px-8 border-l-2 border-slate-200 ${timeLeft < 300 ? 'text-red-600' : 'text-blue-700'}`}>
               <p className="text-[10px] font-black uppercase tracking-widest mb-1">Waktu</p>
               <p className="font-mono text-3xl font-black leading-none">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</p>
            </div>
         </div>
       </header>

       <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-[2rem] shadow-xl border p-10">
                   <div className="flex justify-between items-center mb-8 border-b pb-6 border-slate-100">
                      <div className="flex items-center gap-3">
                         <span className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl">{currentIdx + 1}</span>
                         <h2 className="text-sm font-black text-slate-800 uppercase tracking-tighter">{q?.type}</h2>
                      </div>
                   </div>
                   <div className="space-y-8">
                      {q?.questionImage && (
                        <div className="flex justify-center mb-6">
                           <img src={q.questionImage} alt="Stimulus" className="max-w-full h-auto rounded-[1.5rem] border-4 border-white shadow-xl" />
                        </div>
                      )}
                      <div className="leading-relaxed text-slate-800 font-medium" style={{ fontSize: `${fontSize}px`, whiteSpace: 'pre-wrap' }}>{q?.text}</div>
                      <div className="pt-4">{renderInput()}</div>
                   </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-4 rounded-3xl border-2 border-slate-300 shadow-md gap-3">
                   <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev-1)} className="w-full sm:w-auto px-8 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl border-b-4 border-slate-300 uppercase text-xs">Sebelumnya</button>
                   <label className="flex items-center gap-3 cursor-pointer px-6 py-4 bg-orange-50 rounded-2xl border-2 border-orange-200">
                      <input type="checkbox" checked={isDoubtful} onChange={e => setDoubtfuls({...doubtfuls, [q.id]: e.target.checked})} className="w-6 h-6 accent-orange-500 rounded" />
                      <span className="font-black text-orange-600 uppercase text-xs">Ragu-Ragu</span>
                   </label>
                   {currentIdx === questions.length - 1 ? (
                     <button onClick={handleSubmit} className="w-full sm:w-auto px-12 py-4 bg-green-600 text-white font-black rounded-2xl border-b-4 border-green-800 uppercase text-xs">Selesai</button>
                   ) : (
                     <button onClick={() => setCurrentIdx(prev => prev+1)} className="w-full sm:w-auto px-12 py-4 bg-blue-600 text-white font-black rounded-2xl border-b-4 border-blue-800 uppercase text-xs">Berikutnya</button>
                   )}
                </div>
             </div>
          </main>

          <aside className="w-full lg:w-80 bg-white border-l-4 border-slate-300 overflow-y-auto p-6 shrink-0 custom-scrollbar lg:h-full">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Navigasi Soal</p>
             <div className="grid grid-cols-5 gap-2">
                {questions.map((item, i) => {
                   const hasAns = answers[item.id] !== undefined;
                   const isDbt = doubtfuls[item.id];
                   return (
                     <button key={item.id} onClick={() => setCurrentIdx(i)} className={`h-12 w-full flex items-center justify-center rounded-xl font-black text-sm border-b-4 transition-all ${i === currentIdx ? 'scale-105 ring-4 ring-blue-100' : ''} ${isDbt ? 'bg-orange-500 text-white border-orange-700' : hasAns ? 'bg-blue-600 text-white border-blue-800' : 'bg-white text-slate-400 border-slate-200'}`}>
                       {i + 1}
                     </button>
                   );
                })}
             </div>
          </aside>
       </div>
    </div>
  );
};

export default QuizInterface;
