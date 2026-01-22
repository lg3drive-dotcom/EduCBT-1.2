
import React, { useState, useRef } from 'react';
import { QuestionType, CognitiveLevel, Question } from '../types.ts';
import { COGNITIVE_LEVELS } from '../constants.ts';
import { generateBatchAIQuestions } from '../services/geminiService.ts';

interface AiQuestionLabProps {
  onBack: () => void;
}

const AiQuestionLab: React.FC<AiQuestionLabProps> = ({ onBack }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  
  // AI Config States
  const [subject, setSubject] = useState('Mata Pelajaran Umum');
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
    
    setIsGenerating(true);
    try {
      const result = await generateBatchAIQuestions(
        subject, material, count, type, level,
        file ? { data: file.data, mimeType: file.type } : undefined,
        customPrompt
      );
      if (result) setGeneratedQuestions(prev => [...result, ...prev]);
    } catch (err: any) {
      alert(`Error: ${err.message || "Gagal menghubungi AI."}`);
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
    alert("File JSON siap!");
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
                <span className="bg-purple-600 px-2 py-0.5 rounded text-xs uppercase">Lab</span> EduCBT AI Generator
              </h1>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-0.5">Export JSON Format</p>
            </div>
          </div>
          <button 
            disabled={generatedQuestions.length === 0}
            onClick={handleDownload}
            className="bg-white hover:bg-slate-200 text-black px-6 py-2 rounded-xl text-xs font-black transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            DOWNLOAD ({generatedQuestions.length})
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
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Nama Mata Pelajaran</label>
                 <input 
                    type="text" 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Contoh: Matematika"
                    className="w-full bg-slate-950 border border-slate-800 p-4 rounded-xl text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-slate-300"
                 />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Upload File Acuan</label>
                 <div onClick={() => fileInputRef.current?.click()} className={`w-full p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center gap-2 ${file ? 'border-purple-500 bg-purple-500/10' : 'border-slate-800 hover:border-slate-700 hover:bg-slate-800/50'}`}>
                   <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 ${file ? 'text-purple-400' : 'text-slate-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                   <span className="text-xs font-bold text-center">{file ? file.name : 'Pilih File (PDF/TXT)'}</span>
                   <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt" />
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Ringkasan Materi</label>
                 <textarea value={material} onChange={e => setMaterial(e.target.value)} className="w-full bg-slate-950 border border-slate-800 p-4 rounded-2xl h-24 text-sm outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-slate-300" placeholder="Ketik topik..." />
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
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Jumlah</label>
                   <input type="number" min="1" max="50" value={count} onChange={e => setCount(parseInt(e.target.value) || 1)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-black text-center outline-none" />
                </div>
                <div>
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Tipe</label>
                   <select value={type} onChange={e => setType(e.target.value as any)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs font-bold outline-none">
                     <option value="RANDOM">ACAK</option>
                     {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                   </select>
                </div>
              </div>
              <button onClick={handleGenerate} disabled={isGenerating} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black py-4 rounded-2xl shadow-xl shadow-purple-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50">
                {isGenerating ? 'MENYUSUN...' : 'GENERATE'}
              </button>
            </div>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-4">
           {generatedQuestions.length === 0 ? (
             <div className="h-[70vh] flex flex-col items-center justify-center bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-[3rem] text-slate-600">
               <p className="font-black text-sm uppercase tracking-widest">Siap Generate Soal.</p>
             </div>
           ) : (
             <div className="space-y-4">
                {generatedQuestions.map((q, idx) => (
                  <div key={idx} className="bg-slate-900 border border-slate-800 p-6 rounded-[2rem]">
                    <div className="flex gap-4">
                       <div className="w-8 h-8 bg-slate-950 border border-slate-800 text-purple-400 rounded-lg flex items-center justify-center font-black text-xs shrink-0">{idx+1}</div>
                       <div className="flex-1">
                          <div className="flex gap-2 mb-2">
                            <span className="text-[8px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded font-black uppercase">{q.subject}</span>
                            <span className="text-[8px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-black uppercase">{q.type}</span>
                          </div>
                          <p className="text-slate-300 text-sm font-medium">{q.text}</p>
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
