
import React, { useState, useEffect, useRef } from 'react';
import { Question, StudentIdentity, QuizResult, QuestionType } from '../types';

interface QuizInterfaceProps {
  // Fix: Use generic Question[] type instead of referencing the undefined INITIAL_QUESTIONS constant
  questions: Question[];
  identity: StudentIdentity;
  timeLimitMinutes: number;
  subjectName: string;
  onFinish: (result: QuizResult) => void;
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, identity, timeLimitMinutes, subjectName, onFinish }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [doubtfuls, setDoubtfuls] = useState<{ [key: string]: boolean }>({});
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const [fontSize, setFontSize] = useState(18); // Default font size in px
  const startTime = useRef(Date.now());

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
    
    // Prevent accidentally leaving or context menu
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      clearInterval(timer);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const handleSubmit = () => {
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
      else if (q.type === QuestionType.SHORT_ANSWER) {
        isCorrect = (studentAns || "").toLowerCase().trim() === (q.correctAnswer || "").toLowerCase().trim();
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
                <span className={`w-10 h-10 flex items-center justify-center rounded-lg font-black mr-4 shrink-0 transition-all ${currentAnswer === idx ? 'bg-blue-600 text-white shadow-lg' : 'bg-white border-2 border-slate-200 text-slate-400 group-hover:border-blue-300'}`}>
                  {String.fromCharCode(65+idx)}
                </span>
                <div className="flex flex-col gap-2 flex-1">
                   {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="max-w-xs h-auto max-h-40 object-contain rounded-lg mb-2 border bg-white" alt={`Opsi ${idx+1}`} />}
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
                     {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="max-w-xs h-auto max-h-40 object-contain rounded-lg border mb-2 bg-white" alt={`Opsi ${idx+1}`} />}
                     <span className="font-bold text-slate-700" style={{ fontSize: `${fontSize - 2}px` }}>{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        );
      case QuestionType.COMPLEX_CATEGORY:
        return (
          <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-sm">
             <table className="w-full text-left">
               <thead className="bg-slate-800 text-white">
                 <tr>
                   <th className="p-4 text-xs font-black uppercase tracking-widest">Pernyataan Analisis</th>
                   <th className="p-4 text-center text-xs font-black uppercase tracking-widest w-48">Kesesuaian</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-200">
                 {q.options?.map((opt, idx) => {
                   const resArr = currentAnswer || q.options?.map(() => null);
                   const val = resArr[idx];
                   return (
                     <tr key={idx} className="hover:bg-slate-50/50">
                       <td className="p-4">
                          <div className="flex flex-col gap-2">
                            {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="w-24 h-auto rounded-lg border mb-1 bg-white" alt="Ilustrasi" />}
                            <span className="font-bold text-slate-700" style={{ fontSize: `${fontSize - 4}px` }}>{opt}</span>
                          </div>
                       </td>
                       <td className="p-4">
                          <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                            <button onClick={() => {
                              const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = true;
                              setAnswers({...answers, [q.id]: next});
                            }} className={`flex-1 py-2 px-2 rounded-lg text-[9px] font-black transition-all ${val === true ? 'bg-green-600 text-white shadow-md' : 'text-slate-400'}`}>YA</button>
                            <button onClick={() => {
                              const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = false;
                              setAnswers({...answers, [q.id]: next});
                            }} className={`flex-1 py-2 px-2 rounded-lg text-[9px] font-black transition-all ${val === false ? 'bg-red-600 text-white shadow-md' : 'text-slate-400'}`}>TIDAK</button>
                          </div>
                       </td>
                     </tr>
                   );
                 })}
               </tbody>
             </table>
          </div>
        );
      case QuestionType.SHORT_ANSWER:
        return <input type="text" value={currentAnswer || ''} onChange={e => setAnswers({...answers, [q.id]: e.target.value})} className="w-full p-6 border-2 border-slate-200 rounded-2xl text-2xl outline-none focus:border-blue-600 bg-slate-50 font-black text-blue-800" placeholder="Ketik jawaban tepat di sini..." />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col select-none overflow-hidden h-screen" onContextMenu={e => e.preventDefault()}>
       {/* CBT Header */}
       <header className="bg-white border-b-4 border-blue-600 p-4 shadow-md flex justify-between items-center z-10 shrink-0">
         <div className="flex items-center gap-4">
           <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl shadow-lg">C</div>
           <div>
             <h1 className="font-black text-slate-800 uppercase tracking-tight text-lg leading-none">EduCBT v1.2</h1>
             <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">{subjectName}</p>
           </div>
         </div>
         
         <div className="flex items-center gap-8">
            {/* Font Control */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
               <span className="text-[10px] font-black text-slate-400 px-3 uppercase tracking-tighter">Ukuran Font</span>
               <button onClick={() => setFontSize(Math.max(14, fontSize - 2))} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-bold hover:bg-blue-50 transition-all shadow-sm">A-</button>
               <button onClick={() => setFontSize(18)} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-bold hover:bg-blue-50 transition-all shadow-sm mx-1">A</button>
               <button onClick={() => setFontSize(Math.min(32, fontSize + 2))} className="w-8 h-8 rounded-lg bg-white text-slate-600 font-bold hover:bg-blue-50 transition-all shadow-sm">A+</button>
            </div>

            {/* Timer */}
            <div className={`flex flex-col items-center px-8 border-l-2 border-slate-200 transition-colors ${timeLeft < 300 ? 'text-red-600 animate-pulse' : 'text-blue-700'}`}>
               <p className="text-[10px] font-black uppercase tracking-widest mb-1">Sisa Waktu</p>
               <p className="font-mono text-3xl font-black leading-none">
                 {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
               </p>
            </div>
         </div>
       </header>

       {/* Main Layout Body */}
       <div className="flex-1 flex overflow-hidden">
          {/* Main Question Panel */}
          <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
             <div className="max-w-4xl mx-auto space-y-6">
                <div className="bg-white rounded-[2rem] shadow-xl border border-white p-10 relative overflow-hidden">
                   {/* Question Header */}
                   <div className="flex justify-between items-center mb-8 border-b pb-6 border-slate-100">
                      <div className="flex items-center gap-3">
                         <span className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-100">{currentIdx + 1}</span>
                         <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Soal Nomor</p>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">{q.type}</p>
                         </div>
                      </div>
                      <div className="text-right">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tingkat Kesulitan</p>
                         <p className="text-sm font-black text-purple-600 uppercase tracking-tighter">{q.level.split(' ')[0]}</p>
                      </div>
                   </div>

                   {/* Question Content */}
                   <div className="space-y-8">
                      <div className="leading-relaxed text-slate-800 font-medium" style={{ fontSize: `${fontSize}px` }}>
                        {q.text}
                      </div>

                      {q.questionImage && (
                        <div className="rounded-3xl border-4 border-slate-50 shadow-inner overflow-hidden bg-slate-100 p-2">
                          <img src={q.questionImage} className="max-w-full h-auto mx-auto rounded-2xl shadow-sm" alt="Ilustrasi Soal" />
                        </div>
                      )}

                      <div className="pt-4">
                        {renderInput()}
                      </div>
                   </div>
                </div>

                {/* Question Footer Action */}
                <div className="flex justify-between items-center bg-white p-4 rounded-3xl border-2 border-slate-300/50 shadow-md">
                   <button 
                     disabled={currentIdx === 0} 
                     onClick={() => setCurrentIdx(prev => prev-1)} 
                     className="px-8 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl border-b-4 border-slate-300 hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed uppercase tracking-widest text-xs"
                   >
                     Sebelumnya
                   </button>

                   <label className="flex items-center gap-3 cursor-pointer group px-6 py-4 bg-orange-50 rounded-2xl border-2 border-orange-200 hover:bg-orange-100 transition-all">
                      <input 
                        type="checkbox" 
                        checked={isDoubtful} 
                        onChange={e => setDoubtfuls({...doubtfuls, [q.id]: e.target.checked})} 
                        className="w-6 h-6 accent-orange-500 rounded"
                      />
                      <span className="font-black text-orange-600 uppercase tracking-widest text-xs">Ragu-Ragu</span>
                   </label>

                   {currentIdx === questions.length - 1 ? (
                     <button onClick={handleSubmit} className="px-12 py-4 bg-green-600 text-white font-black rounded-2xl border-b-4 border-green-800 shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95 uppercase tracking-widest text-xs">Selesai</button>
                   ) : (
                     <button onClick={() => setCurrentIdx(prev => prev+1)} className="px-12 py-4 bg-blue-600 text-white font-black rounded-2xl border-b-4 border-blue-800 shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 uppercase tracking-widest text-xs">Berikutnya</button>
                   )}
                </div>
             </div>
          </main>

          {/* Sidebar Navigation Grid */}
          <aside className="w-80 bg-white border-l-4 border-slate-300 overflow-y-auto p-6 flex flex-col gap-6 shrink-0 custom-scrollbar shadow-inner">
             <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Status Navigasi</p>
                <div className="flex flex-wrap gap-2">
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-blue-600 rounded-sm"></div><span className="text-[9px] font-bold text-slate-500">DIJAWAB</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div><span className="text-[9px] font-bold text-slate-500">RAGU</span></div>
                   <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-white border border-slate-300 rounded-sm"></div><span className="text-[9px] font-bold text-slate-500">BELUM</span></div>
                </div>
             </div>

             <div className="flex-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 ml-1">Nomor Soal</p>
                <div className="grid grid-cols-5 gap-2">
                   {questions.map((item, i) => {
                      const status = getQuestionStatus(i);
                      return (
                        <button 
                          key={item.id} 
                          onClick={() => setCurrentIdx(i)}
                          className={`
                            h-12 w-full flex items-center justify-center rounded-xl font-black text-sm transition-all border-b-4
                            ${i === currentIdx ? 'scale-110 shadow-xl ring-4 ring-blue-600/20' : ''}
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

             <div className="bg-slate-900 text-white p-5 rounded-[2rem] shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                   </div>
                   <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nama Peserta</p>
                      <p className="font-bold text-sm truncate w-40 leading-none">{identity.name}</p>
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Kelas</p>
                      <p className="font-black text-xs">{identity.className}</p>
                   </div>
                   <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center">
                      <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Dijawab</p>
                      <p className="font-black text-xs text-blue-400">
                        {Object.keys(answers).filter(k => answers[k] !== undefined && (Array.isArray(answers[k]) ? answers[k].length > 0 : true)).length} / {questions.length}
                      </p>
                   </div>
                </div>
             </div>
          </aside>
       </div>
    </div>
  );
};

export default QuizInterface;
