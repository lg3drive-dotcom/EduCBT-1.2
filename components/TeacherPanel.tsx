
import React, { useState } from 'react';
import { QuizResult, Question, QuestionType } from '../types';

interface TeacherPanelProps {
  results: QuizResult[];
  questions: Question[];
  onUpdateScore: (resultId: string, corrections: {[key: string]: number}) => void;
}

const TeacherPanel: React.FC<TeacherPanelProps> = ({ results, questions, onUpdateScore }) => {
  const [selectedResult, setSelectedResult] = useState<QuizResult | null>(null);

  const handleSaveCorrection = () => {
    if (selectedResult) {
      onUpdateScore(selectedResult.id, selectedResult.manualCorrections);
      setSelectedResult(null);
      alert("Koreksi manual berhasil disimpan!");
    }
  };

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-8 border-b bg-slate-50/50">
        <h2 className="text-2xl font-black text-slate-800">Daftar Hasil Ujian Siswa</h2>
        <p className="text-slate-500 text-sm mt-1">Review hasil pengerjaan dan berikan penilaian pada soal uraian.</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50/80 text-slate-400 text-[10px] uppercase font-black tracking-[0.2em] border-b">
            <tr>
              <th className="p-6">Nama Peserta</th>
              <th className="p-6">Kelas</th>
              <th className="p-6 text-center">Skor Sistem</th>
              <th className="p-6 text-center">Status Koreksi</th>
              <th className="p-6 text-right">Navigasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.length === 0 ? (
              <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">Belum ada data pengerjaan masuk.</td></tr>
            ) : (
              results.map(res => (
                <tr key={res.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-6 font-bold text-slate-800">{res.identity.name}</td>
                  <td className="p-6 text-slate-500 font-medium">{res.identity.className}</td>
                  <td className="p-6 text-center">
                    <span className="bg-blue-600 text-white px-4 py-1.5 rounded-full font-black text-sm shadow-lg shadow-blue-100">{res.score.toFixed(1)}</span>
                  </td>
                  <td className="p-6 text-center">
                    {res.isCorrected ? 
                      <span className="text-green-600 text-[10px] font-black uppercase tracking-widest bg-green-50 px-3 py-1 rounded-full border border-green-100">Koreksi Selesai</span> : 
                      <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest bg-orange-50 px-3 py-1 rounded-full border border-orange-100">Menunggu Review</span>
                    }
                  </td>
                  <td className="p-6 text-right">
                    <button 
                      onClick={() => setSelectedResult(res)}
                      className="bg-slate-900 hover:bg-black text-white text-[10px] font-black px-5 py-2.5 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest"
                    >
                      Buka Lembar Jawab
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedResult && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xl z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[3.5rem] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-white/20">
            <div className="p-8 border-b bg-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{selectedResult.identity.name}</h3>
                <p className="text-slate-400 text-xs font-bold mt-1 uppercase tracking-widest">Kelas: {selectedResult.identity.className} • Review & Penyesuaian Nilai</p>
              </div>
              <button onClick={() => setSelectedResult(null)} className="bg-slate-100 hover:bg-slate-200 p-3 rounded-full transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-slate-50/30">
              {questions.map((q, idx) => {
                const answer = selectedResult.answers[q.id];
                
                return (
                  <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 -mr-16 -mt-16 rounded-full opacity-50"></div>
                    
                    <div className="relative flex flex-col md:flex-row gap-8">
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-6">
                          <span className="bg-slate-100 text-slate-500 text-[10px] px-3 py-1 rounded-lg font-black uppercase tracking-widest">Butir Soal {idx+1}</span>
                          <span className="text-slate-400 text-[10px] font-black uppercase tracking-tighter">{q.type}</span>
                        </div>
                        
                        {q.questionImage && (
                           <img src={q.questionImage} className="w-48 h-auto rounded-2xl border mb-6 shadow-sm" alt="Ilustrasi Soal" />
                        )}
                        
                        <p className="text-lg font-bold text-slate-800 leading-relaxed mb-6">{q.text}</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                          <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <p className="text-[10px] text-slate-400 font-black uppercase mb-2 tracking-widest">Jawaban Peserta</p>
                            <div className="flex flex-col gap-2">
                              {/* FIX: Handle COMPLEX_CATEGORY and other types correctly for participant answer display */}
                              <p className="font-black text-slate-700">
                                {q.type === QuestionType.COMPLEX_CATEGORY 
                                  ? (Array.isArray(answer) ? answer.map((v, i) => `[${q.options?.[i]}: ${v ? 'Sesuai' : 'Tidak'}]`).join(", ") : "Tidak dijawab")
                                  : q.options 
                                    ? (Array.isArray(answer) ? answer.map((i: number) => q.options?.[i]).join(", ") : q.options[answer as number] || "Tidak dijawab")
                                    : String(answer || "KOSONG")
                                }
                              </p>
                            </div>
                          </div>
                          <div className="p-5 bg-green-50 rounded-2xl border border-green-100">
                            <p className="text-[10px] text-green-600 font-black uppercase mb-2 tracking-widest">Kunci Jawaban</p>
                            <p className="font-black text-green-800">
                               {/* FIX: Remove reference to non-existent QuestionType.BOOLEAN/MATCH and handle all types correctly */}
                               {q.type === QuestionType.COMPLEX_CATEGORY 
                                 ? q.options?.map((opt, i) => `[${opt}: ${q.correctAnswer[i] ? 'Sesuai' : 'Tidak'}]`).join(", ")
                                 : q.options 
                                   ? (Array.isArray(q.correctAnswer) ? q.correctAnswer.map(i => q.options?.[i]).join(", ") : q.options[q.correctAnswer])
                                   : String(q.correctAnswer)
                               }
                            </p>
                          </div>
                        </div>

                        <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 italic">
                           <p className="text-[10px] text-blue-600 font-black uppercase mb-2 tracking-widest">Pembahasan:</p>
                           <p className="text-sm text-blue-800 leading-relaxed">{q.explanation || "Tidak ada pembahasan tersedia."}</p>
                        </div>
                      </div>

                      <div className="md:w-48 flex flex-col justify-end bg-slate-50 p-6 rounded-3xl border border-slate-100">
                         <label className="text-[10px] font-black text-slate-400 uppercase mb-4 text-center tracking-widest">Input Skor</label>
                         <div className="flex flex-col gap-2">
                            <input 
                               type="number" 
                               max="100" 
                               min="0"
                               className="w-full p-4 bg-white border-2 border-slate-200 rounded-2xl text-center text-2xl font-black focus:border-blue-500 outline-none transition-all"
                               placeholder="0"
                               defaultValue={selectedResult.manualCorrections[q.id] || (JSON.stringify(answer) === JSON.stringify(q.correctAnswer) ? 100 : 0)}
                               onChange={e => {
                                 const val = parseInt(e.target.value) || 0;
                                 selectedResult.manualCorrections[q.id] = val;
                               }}
                             />
                             <p className="text-[8px] text-slate-400 text-center font-bold">Skala 0-100</p>
                         </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-8 border-t bg-white flex flex-col md:flex-row gap-4 justify-between items-center shrink-0">
               <p className="text-slate-400 text-xs font-bold uppercase tracking-widest italic">Perubahan akan langsung mengupdate skor akhir siswa.</p>
               <div className="flex gap-4 w-full md:w-auto">
                 <button onClick={() => setSelectedResult(null)} className="flex-1 md:px-8 py-4 font-black text-slate-400 hover:text-slate-600">BATAL</button>
                 <button 
                  onClick={handleSaveCorrection}
                  className="flex-1 md:px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-2xl shadow-blue-200 transition-all active:scale-95"
                >
                  SIMPAN KOREKSI
                </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherPanel;
