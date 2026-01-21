
import React, { useState, useEffect, useRef } from 'react';
import { Question, StudentIdentity, QuizResult, QuestionType } from '../types';

interface QuizInterfaceProps {
  questions: Question[];
  identity: StudentIdentity;
  timeLimitMinutes: number;
  subjectName: string;
  onFinish: (result: QuizResult) => void;
}

const QuizInterface: React.FC<QuizInterfaceProps> = ({ questions, identity, timeLimitMinutes, subjectName, onFinish }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: any }>({});
  const [timeLeft, setTimeLeft] = useState(timeLimitMinutes * 60);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
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

    onFinish({ id: Date.now().toString(), identity, score, totalQuestions: questions.length, answers, manualCorrections: {}, timestamp: Date.now(), duration: Math.round((Date.now() - startTime.current) / 1000), isCorrected: false });
  };

  const q = questions[currentIdx];
  const currentAnswer = answers[q.id];

  const renderInput = () => {
    switch (q.type) {
      case QuestionType.SINGLE:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {q.options?.map((opt, idx) => (
              <button key={idx} onClick={() => setAnswers({...answers, [q.id]: idx})} className={`flex items-center p-5 text-left border-2 rounded-2xl transition-all ${currentAnswer === idx ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                <span className={`w-8 h-8 flex items-center justify-center rounded-full font-bold mr-4 shrink-0 ${currentAnswer === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+idx)}</span>
                <div className="flex flex-col gap-2 flex-1">
                   {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="w-full h-auto max-h-32 object-contain rounded-lg mb-2" alt={`Opsi ${idx+1}`} />}
                   <span className="font-medium">{opt}</span>
                </div>
              </button>
            ))}
          </div>
        );
      case QuestionType.MULTIPLE:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {q.options?.map((opt, idx) => {
              const selected = (currentAnswer || []).includes(idx);
              return (
                <button key={idx} onClick={() => {
                  const prev = currentAnswer || [];
                  const next = selected ? prev.filter((i:any) => i !== idx) : [...prev, idx];
                  setAnswers({...answers, [q.id]: next});
                }} className={`flex items-center p-5 text-left border-2 rounded-2xl transition-all ${selected ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                  <div className={`w-6 h-6 border-2 rounded-lg mr-4 flex items-center justify-center shrink-0 ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>{selected && <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}</div>
                  <div className="flex flex-col gap-2 flex-1">
                     {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="w-full h-auto max-h-32 object-contain rounded-lg mb-2" alt={`Opsi ${idx+1}`} />}
                     <span className="font-medium">{opt}</span>
                  </div>
                </button>
              );
            })}
          </div>
        );
      case QuestionType.COMPLEX_CATEGORY:
        return (
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
             <table className="w-full text-left">
               <thead className="bg-slate-50 border-b">
                 <tr>
                   <th className="p-5 text-xs font-black text-slate-400 uppercase tracking-widest">Pernyataan Analisis</th>
                   <th className="p-5 text-center text-xs font-black text-slate-400 uppercase tracking-widest w-40">Respons</th>
                 </tr>
               </thead>
               <tbody className="divide-y">
                 {q.options?.map((opt, idx) => {
                   const resArr = currentAnswer || q.options?.map(() => null);
                   const val = resArr[idx];
                   return (
                     <tr key={idx} className="hover:bg-slate-50/50">
                       <td className="p-5">
                          <div className="flex flex-col gap-2">
                            {q.optionImages?.[idx] && <img src={q.optionImages[idx]} className="w-32 h-auto rounded-lg border mb-1" alt={`Ilustrasi ${idx+1}`} />}
                            <span className="font-medium text-slate-700">{opt}</span>
                          </div>
                       </td>
                       <td className="p-5">
                          <div className="flex bg-slate-100 p-1 rounded-xl">
                            <button onClick={() => {
                              const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = true;
                              setAnswers({...answers, [q.id]: next});
                            }} className={`flex-1 py-1 px-3 rounded-lg text-[10px] font-black transition-all ${val === true ? 'bg-white shadow-sm text-green-600' : 'text-slate-400'}`}>SESUAI</button>
                            <button onClick={() => {
                              const next = [...(currentAnswer || q.options!.map(() => null))]; next[idx] = false;
                              setAnswers({...answers, [q.id]: next});
                            }} className={`flex-1 py-1 px-3 rounded-lg text-[10px] font-black transition-all ${val === false ? 'bg-white shadow-sm text-red-600' : 'text-slate-400'}`}>TIDAK</button>
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
        return <input type="text" value={currentAnswer || ''} onChange={e => setAnswers({...answers, [q.id]: e.target.value})} className="w-full p-5 border-2 rounded-2xl text-xl outline-none focus:border-blue-600 bg-slate-50 font-medium" placeholder="Ketik jawaban Anda..." />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
       <header className="bg-blue-800 p-4 text-white flex justify-between items-center shadow-lg">
         <div className="font-black text-xl tracking-tight">EduCBT</div>
         <div className="bg-blue-900 px-6 py-1.5 rounded-full font-mono text-xl font-bold border border-blue-700">{Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}</div>
       </header>
       <main className="flex-1 max-w-5xl mx-auto w-full p-6 space-y-6">
         <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200">
           <div className="mb-6 flex justify-between">
             <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-widest">Butir {currentIdx+1}</span>
             <span className="text-slate-400 text-[10px] font-black uppercase tracking-tighter">{q.type}</span>
           </div>
           
           <h2 className="text-2xl font-semibold text-slate-800 leading-relaxed mb-6">{q.text}</h2>
           
           {q.questionImage && (
             <div className="mb-8">
               <img src={q.questionImage} className="max-w-full md:max-w-xl h-auto rounded-[2rem] border shadow-md mx-auto" alt="Media Soal" />
             </div>
           )}

           {renderInput()}
         </div>
         <div className="flex justify-between items-center">
           <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(prev => prev-1)} className="px-8 py-4 bg-white text-slate-600 font-bold rounded-2xl border-2 hover:border-blue-200 transition-all disabled:opacity-30">KEMBALI</button>
           <div className="flex gap-2 flex-wrap justify-center max-w-[50%]">{questions.map((_, i) => <div key={i} className={`w-2 h-2 rounded-full mb-1 transition-all ${i === currentIdx ? 'bg-blue-600 w-6' : 'bg-slate-300'}`}></div>)}</div>
           {currentIdx === questions.length-1 ? <button onClick={handleSubmit} className="px-12 py-4 bg-green-600 text-white font-black rounded-2xl shadow-lg">SELESAI</button> : <button onClick={() => setCurrentIdx(prev => prev+1)} className="px-12 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-lg">LANJUT</button>}
         </div>
       </main>
    </div>
  );
};

export default QuizInterface;
