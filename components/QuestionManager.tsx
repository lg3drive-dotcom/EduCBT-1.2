
import React, { useState, useRef, useMemo } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types.ts';
import { SUBJECT_LIST, BLOOM_LEVELS, PUSPENDIK_LEVELS } from '../constants.ts';
import { generateQuestionBankPDF } from '../services/pdfService.ts';

interface QuestionManagerProps {
  questions: Question[];
  activeToken: string;
  onAdd: (q: any) => void;
  onUpdate: (q: Question) => void;
  onSoftDelete: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestore: (id: string) => void;
}

const QuestionManager: React.FC<QuestionManagerProps> = ({ 
  questions, activeToken, onAdd, onUpdate, onSoftDelete, onPermanentDelete, onRestore 
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [tokenFilter, setTokenFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [levelMode, setLevelMode] = useState<'bloom' | 'puspendik'>('bloom');
  
  const [formData, setFormData] = useState<{
    text: string;
    material: string;
    explanation: string;
    questionImage?: string;
    type: QuestionType;
    level: string;
    options: string[];
    optionImages: (string | undefined)[];
    correctAnswer: any;
    subject: string;
    order: number;
    quizToken: string;
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
    order: 1,
    quizToken: activeToken
  });

  const mainFileInputRef = useRef<HTMLInputElement>(null);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      text: '', material: '', explanation: '', type: QuestionType.SINGLE, 
      level: CognitiveLevel.C1, options: ['', '', '', ''], 
      optionImages: [undefined, undefined, undefined, undefined], 
      correctAnswer: 0, subject: Subject.PANCASILA, order: 1,
      quizToken: activeToken
    });
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    // Auto detect mode
    const isPuspendik = PUSPENDIK_LEVELS.includes(q.level as CognitiveLevel);
    setLevelMode(isPuspendik ? 'puspendik' : 'bloom');
    
    setFormData({
      text: q.text,
      material: q.material,
      explanation: q.explanation,
      questionImage: q.questionImage,
      type: q.type,
      level: q.level,
      options: q.options || ['', '', '', ''],
      optionImages: q.optionImages || (q.options ? q.options.map(() => undefined) : [undefined, undefined, undefined, undefined]),
      correctAnswer: q.correctAnswer,
      subject: q.subject,
      order: q.order || 1,
      quizToken: q.quizToken || activeToken
    });
    setShowForm(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (index === undefined) {
        setFormData(prev => ({ ...prev, questionImage: base64 }));
      } else {
        const nextImages = [...formData.optionImages];
        nextImages[index] = base64;
        setFormData(prev => ({ ...prev, optionImages: nextImages }));
      }
    };
    reader.readAsDataURL(file);
  };

  const processedQuestions = useMemo(() => {
    let filtered = questions.filter(q => activeTab === 'active' ? !q.isDeleted : (activeTab === 'trash' ? q.isDeleted : false));
    if (activeTab === 'active') {
      if (subjectFilter !== 'ALL') filtered = filtered.filter(q => q.subject === subjectFilter);
      if (tokenFilter.trim() !== '') filtered = filtered.filter(q => q.quizToken?.toUpperCase().includes(tokenFilter.toUpperCase()));
    }
    return filtered.sort((a, b) => {
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return (a.order || 0) - (b.order || 0);
    });
  }, [questions, activeTab, subjectFilter, tokenFilter]);

  const getDisplayNumber = (q: Question) => {
    const sameTokenSubject = processedQuestions.filter(item => item.quizToken === q.quizToken && item.subject === q.subject);
    return sameTokenSubject.findIndex(item => item.id === q.id) + 1;
  };

  const handleExport = () => {
    generateQuestionBankPDF(processedQuestions, 'lengkap', subjectFilter !== 'ALL' ? subjectFilter as any : undefined);
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
      return { ...prev, options: nextOptions, optionImages: nextImages, correctAnswer: nextCorrect };
    });
  };

  const handleTypeChange = (newType: QuestionType) => {
    setFormData(prev => {
      let nextCorrect: any = 0;
      if (newType === QuestionType.MULTIPLE) nextCorrect = [];
      else if (newType === QuestionType.COMPLEX_CATEGORY) nextCorrect = prev.options.map(() => false);
      return { ...prev, type: newType, correctAnswer: nextCorrect };
    });
  };

  const handleSave = () => {
    if (!formData.text) return alert("Pertanyaan tidak boleh kosong.");
    if (!formData.quizToken) return alert("Token wajib diisi agar soal dapat ditemukan siswa.");
    if (!formData.subject) return alert("Mata pelajaran wajib diisi.");
    
    const finalData = {
      ...formData,
      quizToken: formData.quizToken.toUpperCase(),
      isDeleted: false,
      createdAt: Date.now(),
    };

    if (editingId) {
      onUpdate({ ...finalData, id: editingId } as Question);
    } else {
      onAdd({ ...finalData, id: Math.random().toString(36).substr(2, 9) + Date.now() });
    }
    closeForm();
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>BANK SOAL</button>
            <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'trash' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>SAMPAH</button>
          </div>
          {activeTab === 'active' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mapel:</span>
                <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none text-slate-700">
                  <option value="ALL">Semua Mapel</option>
                  {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Token:</span>
                <input 
                  type="text" 
                  value={tokenFilter} 
                  onChange={(e) => setTokenFilter(e.target.value)} 
                  placeholder="Cari Token..."
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none text-slate-700 w-24 focus:w-40 transition-all"
                />
              </div>
            </>
          )}
        </div>
        <div className="flex gap-2">
           <button onClick={handleExport} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg> PDF Bank Soal
           </button>
           <button onClick={() => { closeForm(); setShowForm(true); }} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-black shadow-lg uppercase tracking-widest transition-all">Tambah Manual</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
        <div className="p-6 space-y-4">
          {processedQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="font-medium text-sm text-center">Tidak ada soal ditemukan {tokenFilter ? `untuk token "${tokenFilter}"` : ""}.</div>
            </div>
          ) : (
            processedQuestions.map((q, idx) => {
              const dispNum = getDisplayNumber(q);
              return (
                <div key={q.id} className="bg-white p-5 border border-slate-200 rounded-2xl group flex gap-5 items-start hover:shadow-md transition-all">
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-sm shrink-0 border border-blue-100">{dispNum}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded font-black uppercase shadow-sm">TOKEN: {q.quizToken || 'TIDAK ADA'}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-black uppercase">{q.subject}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded font-black uppercase tracking-tighter">{q.level.length > 20 ? q.level.substring(0, 15) + '...' : q.level.split(' ')[0]}</span>
                      </div>
                      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {activeTab === 'active' ? (
                          <>
                            <button onClick={() => handleEdit(q)} className="text-blue-600 text-[10px] font-black uppercase tracking-widest hover:underline">Edit</button>
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
                    <p className="font-semibold text-slate-800 leading-relaxed text-sm line-clamp-2">{q.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-5xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-8 border-b pb-4 sticky top-0 bg-white z-10">
                <div>
                   <h3 className="text-2xl font-black text-slate-800">{editingId ? 'Edit Soal' : 'Tambah Soal Manual'}</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Status: {editingId ? 'Mode Edit' : 'Penyusunan Baru'}</p>
                </div>
                <button onClick={closeForm} className="text-3xl font-light text-slate-400 hover:text-slate-600">×</button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-7 space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Token Akses Soal</label>
                          <input 
                            type="text" 
                            value={formData.quizToken} 
                            onChange={e => setFormData({...formData, quizToken: e.target.value.toUpperCase()})}
                            placeholder="XCVBN (gunakan kombinasi huruf unik)"
                            className="w-full p-4 border-2 border-blue-100 rounded-xl font-black outline-none focus:border-blue-500 bg-blue-50 text-blue-700 text-sm placeholder:text-blue-200 placeholder:text-[10px]"
                          />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                          <input 
                            type="text"
                            list="subject-options"
                            value={formData.subject} 
                            onChange={e => setFormData({...formData, subject: e.target.value})} 
                            placeholder="Ketik Mapel..."
                            className="w-full p-4 border rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50 text-sm"
                          />
                          <datalist id="subject-options">
                            {SUBJECT_LIST.map(s => <option key={s} value={s} />)}
                          </datalist>
                       </div>
                   </div>

                   <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-4">
                      <div className="flex justify-between items-center">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistem Level Kognitif</label>
                         <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <button 
                              onClick={() => {
                                setLevelMode('bloom');
                                setFormData({...formData, level: BLOOM_LEVELS[0]});
                              }} 
                              className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${levelMode === 'bloom' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              TAKSONOMI BLOOM (C1-C6)
                            </button>
                            <button 
                              onClick={() => {
                                setLevelMode('puspendik');
                                setFormData({...formData, level: PUSPENDIK_LEVELS[0]});
                              }} 
                              className={`px-4 py-2 rounded-lg text-[9px] font-black transition-all ${levelMode === 'puspendik' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                              PUSPENDIK (LEVEL 1-3)
                            </button>
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Pilih Level</label>
                         <select 
                           value={formData.level} 
                           onChange={e => setFormData({...formData, level: e.target.value})} 
                           className={`w-full p-4 border rounded-xl font-black outline-none focus:border-blue-500 bg-white text-sm ${levelMode === 'bloom' ? 'text-purple-700' : 'text-orange-700'}`}
                         >
                            {(levelMode === 'bloom' ? BLOOM_LEVELS : PUSPENDIK_LEVELS).map(l => (
                              <option key={l} value={l}>{l}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Butir Pertanyaan</label>
                      <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl h-32 outline-none font-bold text-slate-800 leading-relaxed" placeholder="Tulis butir soal..." />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gambar Soal (Opsional)</label>
                      <div className="flex gap-4 items-center p-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                         {formData.questionImage ? (
                           <div className="relative w-24 h-24 shrink-0 group">
                             <img src={formData.questionImage} className="w-full h-full object-cover rounded-xl border-2 border-white shadow-sm" alt="Preview" />
                             <button onClick={() => setFormData({...formData, questionImage: undefined})} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                           </div>
                         ) : (
                           <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center text-slate-300 shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                           </div>
                         )}
                         <div className="flex flex-col gap-2 flex-1">
                            <input type="file" ref={mainFileInputRef} onChange={(e) => handleFileUpload(e)} className="hidden" accept="image/*" />
                            <div className="flex gap-2">
                               <button onClick={() => mainFileInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all flex-1">Unggah Gambar</button>
                            </div>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ringkasan Materi & Pembahasan</label>
                      <input value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none mb-2 text-xs font-bold" placeholder="Materi (Contoh: Bangun Datar)" />
                      <textarea value={formData.explanation} onChange={e => setFormData({...formData, explanation: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl h-24 outline-none text-xs italic text-slate-500" placeholder="Tulis penjelasan/pembahasan soal..." />
                   </div>
                </div>

                <div className="lg:col-span-5 space-y-6 border-l border-slate-100 lg:pl-10">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe Soal & Pilihan Jawaban</label>
                      <select value={formData.type} onChange={e => handleTypeChange(e.target.value as QuestionType)} className="w-full p-4 border rounded-xl font-black outline-none focus:border-blue-500 bg-blue-50 text-blue-700 mb-4 text-sm">
                          {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>

                      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                         {formData.options.map((opt, idx) => (
                           <div key={idx} className="p-4 bg-white border border-slate-200 rounded-2xl relative space-y-3 group hover:border-blue-200 transition-all shadow-sm">
                              <div className="flex gap-3 items-start">
                                 {formData.type === QuestionType.SINGLE ? (
                                    <input type="radio" checked={formData.correctAnswer === idx} onChange={() => setFormData({...formData, correctAnswer: idx})} className="mt-1 w-5 h-5 accent-blue-600 cursor-pointer shrink-0" />
                                 ) : formData.type === QuestionType.MULTIPLE ? (
                                    <input type="checkbox" checked={(formData.correctAnswer || []).includes(idx)} onChange={(e) => {
                                       const current = formData.correctAnswer || [];
                                       const next = e.target.checked ? [...current, idx] : current.filter((i:any) => i !== idx);
                                       setFormData({...formData, correctAnswer: next});
                                    }} className="mt-1 w-5 h-5 accent-purple-600 cursor-pointer shrink-0" />
                                 ) : (
                                    <button onClick={() => {
                                       const next = [...(formData.correctAnswer || formData.options.map(() => false))];
                                       next[idx] = !next[idx];
                                       setFormData({...formData, correctAnswer: next});
                                    }} className={`mt-1 w-10 h-5 rounded-full transition-all shrink-0 ${formData.correctAnswer?.[idx] ? 'bg-green-500' : 'bg-slate-300'}`}>
                                       <div className={`w-3 h-3 bg-white rounded-full transition-all mx-1 ${formData.correctAnswer?.[idx] ? 'translate-x-5' : ''}`}></div>
                                    </button>
                                 )}
                                 
                                 <textarea value={opt} onChange={(e) => {
                                   const next = [...formData.options]; next[idx] = e.target.value;
                                   setFormData({...formData, options: next});
                                 }} className="w-full bg-slate-50 p-2 rounded-lg text-xs font-bold outline-none h-12" placeholder={`Teks Pilihan ${String.fromCharCode(65+idx)}...`} />
                                 
                                 {formData.options.length > 2 && (
                                   <button onClick={() => handleRemoveOption(idx)} className="text-red-400 hover:text-red-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                                 )}
                              </div>

                              <div className="flex gap-2 items-center">
                                 <div className="w-12 h-12 bg-slate-50 border rounded-lg shrink-0 overflow-hidden">
                                    {formData.optionImages?.[idx] ? (
                                       <div className="relative w-full h-full group/img">
                                          <img src={formData.optionImages[idx]} className="w-full h-full object-cover" alt="Preview" />
                                          <button onClick={() => {
                                            const next = [...formData.optionImages]; next[idx] = undefined;
                                            setFormData({...formData, optionImages: next});
                                          }} className="absolute inset-0 bg-red-500/80 text-white text-[8px] font-black flex items-center justify-center opacity-0 group-hover/img:opacity-100 uppercase transition-opacity">Hapus</button>
                                       </div>
                                    ) : (
                                       <div className="w-full h-full flex items-center justify-center text-slate-200"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg></div>
                                    )}
                                 </div>
                                 <div className="flex-1 flex gap-1">
                                    <input type="file" onChange={(e) => handleFileUpload(e, idx)} className="hidden" id={`opt-img-${idx}`} accept="image/*" />
                                    <label htmlFor={`opt-img-${idx}`} className="flex-1 py-1 px-2 bg-slate-50 border text-[8px] font-black uppercase text-slate-500 rounded text-center cursor-pointer hover:bg-slate-100">Unggah Gambar</label>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </div>
                      
                      <button onClick={handleAddOption} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 rounded-2xl mt-4 transition-all">+ Tambah Pilihan</button>
                   </div>
                </div>
             </div>

             <div className="sticky bottom-0 bg-white pt-8 pb-4 border-t mt-10 flex gap-4 z-10">
                <button onClick={closeForm} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-xs">Batal</button>
                <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl uppercase shadow-xl shadow-blue-100 transition-all hover:bg-blue-700 active:scale-95 text-xs tracking-widest">
                   {editingId ? 'Simpan Perubahan' : 'Tambah Soal Baru'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
