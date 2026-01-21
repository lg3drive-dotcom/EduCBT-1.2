
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types';
import { SUBJECT_LIST, COGNITIVE_LEVELS } from '../constants';
import { generateBatchAIQuestions, generateAIImage } from '../services/geminiService';
import { generateQuestionBankPDF } from '../services/pdfService';

interface QuestionManagerProps {
  questions: Question[];
  onAdd: (q: any) => void;
  onUpdate: (q: Question) => void;
  onSoftDelete: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestore: (id: string) => void;
}

const QuestionManager: React.FC<QuestionManagerProps> = ({ 
  questions, onAdd, onUpdate, onSoftDelete, onPermanentDelete, onRestore 
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'trash' | 'ai'>('active');
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isImageGenerating, setIsImageGenerating] = useState(false);
  const [generatingOptionIdx, setGeneratingOptionIdx] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [aiMaterial, setAiMaterial] = useState('');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiSubject, setAiSubject] = useState(Subject.PANCASILA);
  const [aiType, setAiType] = useState<QuestionType | 'RANDOM'>('RANDOM');
  const [aiLevel, setAiLevel] = useState<CognitiveLevel | 'RANDOM'>('RANDOM');
  const [aiFile, setAiFile] = useState<{data: string, name: string, type: string} | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const optionFileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<{
    text: string;
    material: string;
    explanation: string;
    questionImage?: string;
    type: QuestionType;
    level: CognitiveLevel;
    options: string[];
    optionImages: (string | undefined)[];
    correctAnswer: any;
    subject: Subject;
    order: number;
  }>({
    text: '',
    material: '',
    explanation: '',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C1,
    options: ['', '', '', ''],
    optionImages: [undefined, undefined, undefined, undefined],
    correctAnswer: 0,
    subject: Subject.PANCASILA,
    order: 1
  });

  useEffect(() => {
    if (!editingId && showForm) {
      const subjectQuestions = questions.filter(q => q.subject === formData.subject && !q.isDeleted);
      const nextOrder = subjectQuestions.length > 0 
        ? Math.max(...subjectQuestions.map(q => q.order || 0)) + 1 
        : 1;
      setFormData(prev => ({ ...prev, order: nextOrder }));
    }
  }, [formData.subject, editingId, showForm, questions]);

  const handleBatchAI = async () => {
    if (!aiMaterial && !aiFile) return alert("Masukkan acuan materi atau upload dokumen (PDF/DOCX/TXT).");
    setIsAiLoading(true);
    try {
      const newQuestions = await generateBatchAIQuestions(
        aiSubject, aiMaterial, aiCount, aiType, aiLevel, aiFile ? { data: aiFile.data, mimeType: aiFile.type } : undefined, aiCustomPrompt
      );
      if (newQuestions && newQuestions.length > 0) {
        const subjectQuestions = questions.filter(q => q.subject === aiSubject && !q.isDeleted);
        let currentMax = subjectQuestions.length > 0 ? Math.max(...subjectQuestions.map(q => q.order || 0)) : 0;
        newQuestions.forEach((q, idx) => {
          onAdd({ ...q, id: Math.random().toString(36).substr(2, 9) + Date.now(), order: currentMax + idx + 1 });
        });
        setActiveTab('active');
        setSubjectFilter(aiSubject);
        setAiFile(null);
        setAiMaterial('');
        setAiCustomPrompt('');
      }
    } catch (err) {
      alert("Terjadi kesalahan saat menghubungi AI.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setAiFile({ data: base64, name: file.name, type: file.type || 'application/pdf' });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateMainImage = async () => {
    if (!formData.text) return alert("Tuliskan pertanyaan terlebih dahulu.");
    setIsImageGenerating(true);
    const img = await generateAIImage(formData.text);
    if (img) setFormData({ ...formData, questionImage: img });
    setIsImageGenerating(false);
  };

  const handleGenerateOptionImage = async (idx: number) => {
    const optText = formData.options[idx];
    if (!optText) return alert("Tuliskan teks opsi terlebih dahulu.");
    setGeneratingOptionIdx(idx);
    const img = await generateAIImage(`${formData.text} - ${optText}`);
    if (img) {
      const nextImgs = [...formData.optionImages];
      nextImgs[idx] = img;
      setFormData({ ...formData, optionImages: nextImgs });
    }
    setGeneratingOptionIdx(null);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (index !== undefined) {
        const nextImgs = [...formData.optionImages];
        nextImgs[index] = base64;
        setFormData({ ...formData, optionImages: nextImgs });
      } else {
        setFormData({ ...formData, questionImage: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      text: '', material: '', explanation: '', type: QuestionType.SINGLE, 
      level: CognitiveLevel.C1, options: ['', '', '', ''], 
      optionImages: [undefined, undefined, undefined, undefined], 
      correctAnswer: 0, subject: Subject.PANCASILA, order: 1 
    });
  };

  const processedQuestions = useMemo(() => {
    let filtered = questions.filter(q => activeTab === 'active' ? !q.isDeleted : (activeTab === 'trash' ? q.isDeleted : false));
    if (activeTab === 'active' && subjectFilter !== 'ALL') filtered = filtered.filter(q => q.subject === subjectFilter);
    return filtered.sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return (a.order || 0) - (b.order || 0);
    });
  }, [questions, activeTab, subjectFilter]);

  const getDisplayNumber = (q: Question) => {
    if (subjectFilter !== 'ALL') return processedQuestions.findIndex(item => item.id === q.id) + 1;
    const sameSubjectQuestions = processedQuestions.filter(item => item.subject === q.subject);
    return sameSubjectQuestions.findIndex(item => item.id === q.id) + 1;
  };

  const handleExport = () => {
    // Sesuai permintaan, langsung download lengkap (kisi + soal tabel)
    generateQuestionBankPDF(processedQuestions, 'lengkap', subjectFilter !== 'ALL' ? subjectFilter as Subject : undefined);
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, ''],
      optionImages: [...prev.optionImages, undefined],
      correctAnswer: prev.type === QuestionType.COMPLEX_CATEGORY ? [...(prev.correctAnswer || []), false] : prev.correctAnswer
    }));
  };

  const handleRemoveOption = (idx: number) => {
    setFormData(prev => {
      const nextOptions = prev.options.filter((_, i) => i !== idx);
      const nextImages = prev.optionImages.filter((_, i) => i !== idx);
      let nextCorrect = prev.correctAnswer;
      
      if (prev.type === QuestionType.SINGLE && prev.correctAnswer === idx) nextCorrect = 0;
      else if (prev.type === QuestionType.MULTIPLE) nextCorrect = (prev.correctAnswer || []).filter((i:any) => i !== idx).map((i:any) => i > idx ? i - 1 : i);
      else if (prev.type === QuestionType.COMPLEX_CATEGORY) nextCorrect = (prev.correctAnswer || []).filter((_:any, i:number) => i !== idx);

      return { ...prev, options: nextOptions, optionImages: nextImages, correctAnswer: nextCorrect };
    });
  };

  const handleTypeChange = (newType: QuestionType) => {
    setFormData(prev => {
      let nextCorrect: any = 0;
      if (newType === QuestionType.MULTIPLE) nextCorrect = [];
      else if (newType === QuestionType.COMPLEX_CATEGORY) nextCorrect = prev.options.map(() => false);
      else if (newType === QuestionType.SHORT_ANSWER) nextCorrect = '';

      return { ...prev, type: newType, correctAnswer: nextCorrect };
    });
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white shadow-md shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}>BANK SOAL</button>
            <button onClick={() => setActiveTab('ai')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'ai' ? 'bg-purple-600 text-white shadow-md shadow-purple-100' : 'text-slate-400 hover:text-slate-600'}`}>AI GENERATOR</button>
            <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'trash' ? 'bg-red-500 text-white shadow-md shadow-red-100' : 'text-slate-400 hover:text-slate-600'}`}>SAMPAH</button>
          </div>
          {activeTab === 'active' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 transition-all text-slate-700">
                <option value="ALL">Semua Mapel</option>
                {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2">
           <button onClick={handleExport} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg> Export PDF Lengkap
           </button>
           <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-black shadow-lg transition-all active:scale-95 uppercase tracking-widest">Tambah Manual</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
        {(activeTab === 'active' || activeTab === 'trash') && (
          <div className="p-6 space-y-4">
            {processedQuestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 text-slate-400 space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                <div className="font-medium">Data soal tidak ditemukan.</div>
              </div>
            ) : (
              processedQuestions.map((q, idx) => {
                const dispNum = getDisplayNumber(q);
                const isSubjectHeaderNeeded = subjectFilter === 'ALL' && (idx === 0 || processedQuestions[idx-1].subject !== q.subject);
                return (
                  <React.Fragment key={q.id}>
                    {isSubjectHeaderNeeded && (
                      <div className="pt-6 pb-2">
                        <span className="bg-slate-900 text-white px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-slate-200">{q.subject}</span>
                      </div>
                    )}
                    <div className="bg-white p-5 border border-slate-200 rounded-2xl group flex gap-5 items-start hover:shadow-md transition-all">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-lg shadow-sm border border-blue-100">{dispNum}</div>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-black uppercase">{q.subject}</span>
                            <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-black uppercase">{q.level}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-full font-black uppercase">{q.type}</span>
                          </div>
                          <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            {activeTab === 'active' ? (
                              <>
                                <button onClick={() => { 
                                  setEditingId(q.id); 
                                  setFormData({ 
                                    ...q, 
                                    options: q.options || ['', '', '', ''], 
                                    optionImages: q.optionImages || [undefined, undefined, undefined, undefined] 
                                  }); 
                                  setShowForm(true); 
                                }} className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">Edit</button>
                                <button onClick={() => onSoftDelete(q.id)} className="text-red-400 text-[10px] font-black uppercase tracking-widest hover:underline">Buang</button>
                              </>
                            ) : (
                              <>
                                <button onClick={() => onRestore(q.id)} className="text-green-600 text-[10px] font-black uppercase tracking-widest hover:underline">Pulihkan</button>
                                <button onClick={() => onPermanentDelete(q.id)} className="text-red-600 text-[10px] font-black uppercase tracking-widest hover:underline">Hapus Permanen</button>
                              </>
                            )}
                          </div>
                        </div>
                        <p className="font-semibold text-slate-800 leading-relaxed text-sm">{q.text}</p>
                        {q.questionImage && <img src={q.questionImage} className="mt-3 w-48 h-auto rounded-xl border border-slate-200" alt="Preview" />}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>
        )}
        {activeTab === 'ai' && (
           <div className="max-w-3xl mx-auto py-12 px-6 space-y-8">
              <div className="text-center space-y-2 mb-4">
                <h2 className="text-2xl font-black text-slate-800">AI Soal Generator</h2>
                <p className="text-slate-400 text-sm">Gunakan AI untuk merancang butir soal dari dokumen atau materi teks.</p>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Upload Dokumen Sumber</label>
                <div onClick={() => aiFileInputRef.current?.click()} className={`w-full p-8 border-4 border-dashed rounded-[2.5rem] cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${aiFile ? 'border-purple-500 bg-purple-50' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}`}>
                   <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all ${aiFile ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                   </div>
                   <p className="font-bold text-slate-700">{aiFile ? aiFile.name : 'Klik untuk upload (PDF/DOCX/TXT)'}</p>
                   <input type="file" ref={aiFileInputRef} onChange={handleAiFileUpload} className="hidden" accept=".pdf,.docx,.txt" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Materi Dasar (Teks)</label>
                <textarea value={aiMaterial} onChange={e => setAiMaterial(e.target.value)} className="w-full p-5 border border-slate-200 rounded-[2rem] h-24 outline-none focus:ring-4 focus:ring-purple-500/10 bg-white font-medium text-sm" placeholder="Tulis ringkasan materi..." />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest ml-1">Instruksi Khusus (Prompt Khusus)</label>
                <textarea value={aiCustomPrompt} onChange={e => setAiCustomPrompt(e.target.value)} className="w-full p-5 border border-purple-100 rounded-[2rem] h-24 outline-none focus:ring-4 focus:ring-purple-500/10 bg-purple-50/30 font-medium italic text-sm" placeholder="Contoh: 'Buat soal HOTS level sulit', 'Fokus pada bab 3 tentang ekosistem'..." />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mapel</label>
                  <select value={aiSubject} onChange={e => setAiSubject(e.target.value as Subject)} className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-white text-xs outline-none">{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe</label>
                  <select value={aiType} onChange={e => setAiType(e.target.value as any)} className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-white text-xs outline-none"><option value="RANDOM">Acak</option>{Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}</select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Level</label>
                  <select value={aiLevel} onChange={e => setAiLevel(e.target.value as any)} className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-white text-xs outline-none"><option value="RANDOM">Acak</option>{COGNITIVE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}</select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Jumlah</label>
                  <input type="number" min="1" max="20" value={aiCount} onChange={e => setAiCount(parseInt(e.target.value) || 1)} className="w-full p-3 border border-slate-200 rounded-xl font-bold bg-white text-center text-xs outline-none" />
                </div>
              </div>
              <button onClick={handleBatchAI} disabled={isAiLoading} className="w-full bg-purple-600 text-white font-black py-5 rounded-[1.5rem] shadow-xl shadow-purple-200 hover:bg-purple-700 transition-all active:scale-[0.98]">
                {isAiLoading ? "MEMPROSES..." : "GENERATE SOAL AI"}
              </button>
           </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar border border-white/20">
             <div className="flex justify-between items-center mb-8 sticky top-0 bg-white z-10 pb-4 border-b">
                <div>
                  <h3 className="text-2xl font-black text-slate-800">{editingId ? 'Edit Butir Soal' : 'Tambah Soal Manual'}</h3>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">Konfigurasi Parameter & Media Evaluasi</p>
                </div>
                <button onClick={closeForm} className="bg-slate-100 hover:bg-slate-200 text-slate-400 w-10 h-10 rounded-full flex items-center justify-center text-2xl transition-all">×</button>
             </div>
             
             <div className="space-y-8">
               {/* Baris Pertama: Meta Data */}
               <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">No. Urut</label>
                    <input type="number" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value) || 0})} className="p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl font-bold outline-none" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mapel</label>
                    <select value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value as Subject})} className="p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl font-bold outline-none text-sm">{SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}</select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe</label>
                    <select value={formData.type} onChange={e => handleTypeChange(e.target.value as QuestionType)} className="p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl font-bold outline-none text-sm">
                      {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kognitif</label>
                    <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value as CognitiveLevel})} className="p-3 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-xl font-bold outline-none text-sm">
                      {COGNITIVE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </div>
               </div>

               {/* Bagian Pertanyaan & Media Soal */}
               <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Teks Pertanyaan</label>
                    <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl h-24 outline-none font-medium" placeholder="Tulis butir soal..." />
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <div className="flex-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Media Soal (Opsional)</p>
                      <div className="flex gap-2">
                        <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-[10px] font-black hover:bg-slate-50 flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> UPLOAD GAMBAR
                        </button>
                        <button onClick={handleGenerateMainImage} disabled={isImageGenerating} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-[10px] font-black hover:bg-purple-700 flex items-center gap-2 shadow-sm transition-all">
                          {isImageGenerating ? 'GENERATING...' : 'GENERATE AI'}
                        </button>
                        {formData.questionImage && <button onClick={() => setFormData({...formData, questionImage: undefined})} className="text-red-500 text-[10px] font-black">Hapus</button>}
                      </div>
                      <input type="file" ref={fileInputRef} onChange={(e) => handleUploadImage(e)} className="hidden" accept="image/*" />
                    </div>
                    {formData.questionImage && <img src={formData.questionImage} className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm" alt="Preview" />}
                  </div>
               </div>

               {/* Bagian Opsi Jawaban (SINGLE & MULTIPLE & COMPLEX) */}
               {(formData.type === QuestionType.SINGLE || formData.type === QuestionType.MULTIPLE || formData.type === QuestionType.COMPLEX_CATEGORY) && (
                 <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Opsi Jawaban & Media</label>
                      <button onClick={handleAddOption} className="text-[10px] font-black text-blue-600 hover:underline">+ Tambah Opsi</button>
                    </div>
                    
                    <div className="space-y-3">
                      {formData.options.map((opt, idx) => (
                        <div key={idx} className="flex gap-4 items-start bg-white p-4 border border-slate-200 rounded-2xl group transition-all hover:shadow-md">
                           {/* Indikator Jawaban Benar */}
                           <div className="pt-2">
                             {formData.type === QuestionType.SINGLE && (
                               <input type="radio" name="correctSingle" checked={formData.correctAnswer === idx} onChange={() => setFormData({...formData, correctAnswer: idx})} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                             )}
                             {formData.type === QuestionType.MULTIPLE && (
                               <input type="checkbox" checked={(formData.correctAnswer || []).includes(idx)} onChange={(e) => {
                                 const prev = formData.correctAnswer || [];
                                 const next = e.target.checked ? [...prev, idx] : prev.filter((i:any) => i !== idx);
                                 setFormData({...formData, correctAnswer: next});
                               }} className="w-5 h-5 accent-blue-600 cursor-pointer" />
                             )}
                             {formData.type === QuestionType.COMPLEX_CATEGORY && (
                               <button onClick={() => {
                                 const next = [...(formData.correctAnswer || [])];
                                 next[idx] = !next[idx];
                                 setFormData({...formData, correctAnswer: next});
                               }} className={`w-14 py-1 text-[8px] font-black rounded-lg transition-all ${formData.correctAnswer?.[idx] ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                 {formData.correctAnswer?.[idx] ? 'SESUAI' : 'TIDAK'}
                               </button>
                             )}
                           </div>
                           
                           {/* Teks Opsi */}
                           <div className="flex-1 space-y-2">
                              <div className="flex gap-2 items-center">
                                <span className="text-[10px] font-black text-slate-400 w-4">{String.fromCharCode(65 + idx)}</span>
                                <input type="text" value={opt} onChange={(e) => {
                                  const next = [...formData.options];
                                  next[idx] = e.target.value;
                                  setFormData({...formData, options: next});
                                }} className="flex-1 bg-transparent border-b border-slate-200 outline-none focus:border-blue-500 py-1 text-sm font-medium" placeholder={`Teks Opsi ${idx+1}...`} />
                                <button onClick={() => handleRemoveOption(idx)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all">×</button>
                              </div>
                              
                              {/* Media Opsi */}
                              <div className="flex items-center gap-3">
                                 <button onClick={() => { setGeneratingOptionIdx(idx); optionFileInputRef.current?.click(); }} className="text-[9px] font-bold text-slate-400 hover:text-blue-500 flex items-center gap-1">
                                   <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> UPLOAD
                                 </button>
                                 <button onClick={() => handleGenerateOptionImage(idx)} disabled={generatingOptionIdx === idx} className="text-[9px] font-bold text-slate-400 hover:text-purple-500 flex items-center gap-1">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> {generatingOptionIdx === idx ? '...' : 'AI'}
                                 </button>
                                 {formData.optionImages[idx] && (
                                   <div className="relative group/img">
                                     <img src={formData.optionImages[idx]} className="w-10 h-10 object-cover rounded-lg border shadow-sm" alt="Preview" />
                                     <button onClick={() => { const next = [...formData.optionImages]; next[idx] = undefined; setFormData({...formData, optionImages: next}); }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] opacity-0 group-hover/img:opacity-100">×</button>
                                   </div>
                                 )}
                              </div>
                           </div>
                        </div>
                      ))}
                    </div>
                    <input type="file" ref={optionFileInputRef} onChange={(e) => { if(generatingOptionIdx !== null) handleUploadImage(e, generatingOptionIdx); }} className="hidden" accept="image/*" />
                 </div>
               )}

               {/* Bagian Jawaban Singkat */}
               {formData.type === QuestionType.SHORT_ANSWER && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kunci Jawaban Singkat</label>
                    <input type="text" value={formData.correctAnswer || ''} onChange={e => setFormData({...formData, correctAnswer: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl font-bold outline-none" placeholder="Jawaban tepat..." />
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Materi / Indikator (Untuk Kisi-kisi)</label>
                    <textarea value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl h-20 outline-none text-sm" placeholder="Contoh: Menghitung volume kubus..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pembahasan & Penjelasan</label>
                    <textarea value={formData.explanation} onChange={e => setFormData({...formData, explanation: e.target.value})} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl h-20 outline-none text-sm italic" placeholder="Jelaskan mengapa jawaban tersebut benar..." />
                  </div>
               </div>

               <div className="flex gap-4 py-6 border-t border-slate-100 bg-white sticky bottom-0">
                 <button onClick={closeForm} className="flex-1 py-4 text-slate-400 font-black text-xs uppercase tracking-widest hover:text-slate-600">BATAL</button>
                 <button onClick={() => { if (editingId) onUpdate({...formData, id: editingId, isDeleted: false, createdAt: Date.now()}); else onAdd({...formData, id: Math.random().toString(), isDeleted: false, createdAt: Date.now(), order: formData.order }); closeForm(); }} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">SIMPAN SOAL</button>
               </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
