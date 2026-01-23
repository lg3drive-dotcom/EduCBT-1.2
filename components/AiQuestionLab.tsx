
import React, { useState, useRef } from 'react';
import { Subject, QuestionType, CognitiveLevel, Question } from '../types.ts';
import { SUBJECT_LIST, COGNITIVE_LEVELS } from '../constants.ts';
import { generateBatchAIQuestions } from '../services/geminiService.ts';

interface AiQuestionLabProps {
  onBack: () => void;
}

const AiQuestionLab: React.FC<AiQuestionLabProps> = ({ onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  
  // AI Config States
  const [subject, setSubject] = useState<string>(Subject.PANCASILA);
  const [material, setMaterial] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [count, setCount] = useState(5);
  const [type, setType] = useState<QuestionType | 'RANDOM'>('RANDOM');
  const [level, setLevel] = useState<CognitiveLevel | 'RANDOM'>('RANDOM');
  const [file, setFile] = useState<{data: string, name: string, type: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setFile({ data: base64, name: file.name, type: file.type || 'application/pdf' });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!material && !file) return alert("Berikan materi atau upload file acuan.");
    if (!subject) return alert("Pilih atau ketik mata pelajaran.");
    
    setIsGenerating(true);
    try {
      const result = await generateBatchAIQuestions(
        subject as any, material, count, type, level,
        file ? { data: file.data, mimeType: file.type } : undefined,
        customPrompt
      );
      if (result) setGeneratedQuestions(prev => [...result, ...prev]);
    } catch (err: any) {
      alert(`Error: ${err.message || "Gagal menghubungi AI. Pastikan server memiliki akses API yang valid."}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (generatedQuestions.length === 0) return;
    const blob = new Blob([JSON.stringify(generatedQuestions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `EduCBT_Import_${subject}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("File JSON siap! Silakan masuk ke Panel Admin CBT dan klik 'Upload File Backup' untuk mengimpor soal ini.");
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 font-inter selection:bg-purple-500/30">
      <nav className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-800 rounded-full transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
                <span className="bg-purple-600 px-2 py-0.5 rounded text-xs uppercase">Lab</span> EduCBT AI Question Generator
              </h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Direct AI Engine • Export JSON Format</p>
            </div>
          </div>
          <button 
            disabled={generatedQuestions.length === 0}
            onClick={handleDownload}
            className="bg-white hover:bg-slate-200 text-black px-6 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            DOWNLOAD UNTUK CBT ({generatedQuestions.length})
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
            <h2 className="text-sm font-black text-purple-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-purple-500 rounded-full"></div>
              Konfigurasi Materi
            </h2>
            <div className="space-y-4">
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Upload Sumber Materi (Opsional)</label>
                 <div onClick={() => fileInputRef.current?.click()} className={`w-full p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${file ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${file ? 'text-purple-400' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   <span className="text-xs font-bold text-center">{file ? file.name : 'PDF / DOCX / TXT'}</span>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt" />
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Ringkasan Materi / Topik</label>
                 <textarea value={material} onChange={e => setMaterial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl h-24 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-slate-300" placeholder="Tulis ringkasan singkat materi..." />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Instruksi Khusus (Optional Prompt)</label>
                 <textarea value={customPrompt} onChange={e => setCustomPrompt(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl h-24 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium text-blue-300" placeholder="Contoh: Fokus pada analisis HOTS, gunakan bahasa kelas 6 SD..." />
               </div>
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-2xl">
            <h2 className="text-sm font-black text-blue-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
              Parameter AI
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Mapel</label>
                   <input 
                      type="text"
                      list="ai-subject-options"
                      value={subject} 
                      onChange={e => setSubject(e.target.value)} 
                      placeholder="Ketik Mapel..."
                      className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold outline-none text-white"
                   />
                   <datalist id="ai-subject-options">
                     {SUBJECT_LIST.map(s => <option key={s} value={s} />)}
                   </datalist>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Jumlah Soal</label>
                   <input type="number" min="1" max="50" value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-black text-center outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Tipe Soal</label>
                   <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold outline-none">
                     <option value="RANDOM">ACAK</option>
                     {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Level Kognitif</label>
                   <select value={level} onChange={e => setLevel(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold outline-none">
                     <option value="RANDOM">ACAK</option>
                     {COGNITIVE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                   </select>
                </div>
              </div>
              <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    MENYUSUN SOAL...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                    GENERATE SEKARANG
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-4">
           {generatedQuestions.length === 0 ? (
             <div className="h-[70vh] flex flex-col items-center justify-center bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-[3rem] text-slate-600">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 opacity-10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
               <p className="font-black text-sm uppercase tracking-widest">Belum ada soal dibuat.</p>
               <p className="text-[10px] font-bold mt-1 opacity-50">Gunakan AI untuk membuat butir soal otomatis.</p>
             </div>
           ) : (
             <div className="space-y-4 animate-in fade-in duration-700">
                <div className="flex justify-between items-center mb-2 px-2">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Hasil ({generatedQuestions.length} Butir)</h3>
                   <button onClick={() => { if(confirm('Kosongkan?')) setGeneratedQuestions([]); }} className="text-[9px] font-black text-red-400 hover:text-red-300 uppercase tracking-widest transition-colors">Hapus Semua</button>
                </div>
                {generatedQuestions.map((q, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem] hover:border-purple-500/50 transition-all group relative overflow-hidden">
                    <div className="flex gap-6 items-start">
                       <div className="w-10 h-10 bg-slate-950 border border-slate-800 text-purple-400 rounded-xl flex items-center justify-center font-black text-lg shrink-0">
                         {generatedQuestions.length - idx}
                       </div>
                       <div className="flex-1 space-y-4">
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[8px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded font-black uppercase border border-purple-800/50">{q.subject}</span>
                            <span className="text-[8px] bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded font-black uppercase border border-blue-800/50">{q.level}</span>
                            <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-black uppercase">{q.type}</span>
                          </div>
                          <p className="text-slate-300 font-medium leading-relaxed">{q.text}</p>
                          <div className="pt-2 border-t border-slate-800/50 flex justify-between items-center">
                             <div className="text-[9px] font-black text-green-500 uppercase tracking-widest flex items-center gap-2">
                               Kunci: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(',') : q.correctAnswer}
                             </div>
                             <button onClick={() => setGeneratedQuestions(prev => prev.filter((_, i) => i !== idx))} className="text-red-500/50 hover:text-red-400 p-2 rounded-lg transition-colors">
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                          </div>
                       </div>
                    </div>
                  </div>
                ))}
             </div>
           )}
        </div>
      </main>
    </div>
  );
};

export default AiQuestionLab;
