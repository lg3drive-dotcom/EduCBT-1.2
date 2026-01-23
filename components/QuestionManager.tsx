
// Import React to provide namespace for React.FC and React.ChangeEvent
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
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [tokenFilter, setTokenFilter] = useState<string>('');
  const [downloadToken, setDownloadToken] = useState<string>('');
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

  // Fixed React namespace usage by importing React
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
      // Pencarian mata pelajaran manual
      if (subjectFilter.trim() !== '') {
        filtered = filtered.filter(q => 
          q.subject.toLowerCase().includes(subjectFilter.toLowerCase())
        );
      }
      if (tokenFilter.trim() !== '') {
        filtered = filtered.filter(q => q.quizToken?.toUpperCase().includes(tokenFilter.toUpperCase()));
      }
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
    if (!downloadToken.trim()) {
      alert("Masukkan TOKEN SOAL terlebih dahulu untuk mengunduh PDF!");
      return;
    }

    const filteredForExport = questions.filter(q => 
      !q.isDeleted && 
      q.quizToken?.toUpperCase() === downloadToken.trim().toUpperCase()
    );

    if (filteredForExport.length === 0) {
      alert(`Tidak ada soal ditemukan dengan token "${downloadToken.toUpperCase()}".`);
      return;
    }

    const exportSubject = filteredForExport[0].subject as any;
    generateQuestionBankPDF(filteredForExport, 'lengkap', exportSubject, downloadToken.trim().toUpperCase());
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
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
            <button onClick={() => setActiveTab('active')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>BANK SOAL</button>
            <button onClick={() => setActiveTab('trash')} className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[10px] font-black transition-all ${activeTab === 'trash' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>SAMPAH</button>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <input 
              type="text" 
              value={subjectFilter} 
              onChange={(e) => setSubjectFilter(e.target.value)} 
              placeholder="Cari Mata Pelajaran..."
              className="flex-1 sm:w-40 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none text-slate-700 focus:border-blue-500 transition-colors"
            />
            <input 
              type="text" 
              value={tokenFilter} 
              onChange={(e) => setTokenFilter(e.target.value)} 
              placeholder="Filter View Token..."
              className="flex-1 sm:w-28 bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none text-slate-700"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
           <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-1 sm:flex-none">
             <input 
               type="text" 
               value={downloadToken} 
               onChange={(e) => setDownloadToken(e.target.value)} 
               placeholder="Token Download"
               className="w-full sm:w-28 px-3 py-1.5 text-[10px] font-bold outline-none text-blue-600 uppercase"
             />
             <button onClick={handleExport} className="bg-slate-100 text-slate-700 px-3 py-1.5 text-[10px] font-bold hover:bg-blue-50 hover:text-blue-600 flex items-center gap-1 border-l">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg> PDF
             </button>
           </div>
           <button onClick={() => { closeForm(); setShowForm(true); }} className="flex-1 sm:flex-none bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black hover:bg-black shadow-lg uppercase tracking-widest transition-all">Tambah</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
        <div className="p-4 lg:p-6 space-y-4">
          {processedQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 lg:py-32 text-slate-400">
              <div className="font-medium text-xs lg:text-sm text-center">Tidak ada soal ditemukan {subjectFilter || tokenFilter ? `untuk pencarian saat ini.` : ""}.</div>
            </div>
          ) : (
            processedQuestions.map((q, idx) => {
              const dispNum = getDisplayNumber(q);
              return (
                <div key={q.id} className="bg-white p-4 lg:p-5 border border-slate-200 rounded-2xl group flex flex-col sm:flex-row gap-4 lg:gap-5 items-start hover:shadow-md transition-all">
                  <div className="w-8 h-8 lg:w-10 lg:h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-lg lg:rounded-xl font-black text-xs lg:text-sm shrink-0 border border-blue-100">{dispNum}</div>
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-2">
                      <div className="flex flex-wrap gap-1 lg:gap-2">
                        <span className="text-[8px] lg:text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase shadow-sm">TOKEN: {q.quizToken || 'NA'}</span>
                        <span className="text-[8px] lg:text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black uppercase truncate max-w-[150px]">{q.subject}</span>
                        <span className="text-[8px] lg:text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded font-black uppercase">{q.level.split(' ')[0]}</span>
                      </div>
                      <div className="flex gap-4 sm:opacity-0 group-hover:opacity-100 transition-opacity w-full sm:w-auto border-t sm:border-t-0 pt-2 sm:pt-0 mt-1 sm:mt-0">
                        {activeTab === 'active' ? (
                          <>
                            <button onClick={() => handleEdit(q)} className="text-blue-600 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:underline">Edit</button>
                            <button onClick={() => onSoftDelete(q.id)} className="text-red-400 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:underline">Buang</button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => onRestore(q.id)} className="text-green-600 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:underline">Pulihkan</button>
                            <button onClick={() => onPermanentDelete(q.id)} className="text-red-600 text-[9px] lg:text-[10px] font-black uppercase tracking-widest hover:underline">Hapus</button>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-slate-800 leading-relaxed text-xs lg:text-sm line-clamp-3">{q.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-[2rem] lg:rounded-[2.5rem] w-full max-w-5xl p-6 lg:p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-6 lg:mb-8 border-b pb-4 sticky top-0 bg-white z-10">
                <div>
                   <h3 className="text-xl lg:text-2xl font-black text-slate-800">{editingId ? 'Edit Soal' : 'Tambah Soal Manual'}</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status: {editingId ? 'Mode Edit' : 'Baru'}</p>
                </div>
                <button onClick={closeForm} className="text-2xl lg:text-3xl font-light text-slate-400 hover:text-slate-600">×</button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
                <div className="lg:col-span-7 space-y-4 lg:space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-blue-600 uppercase tracking-widest ml-1">Token Akses Soal</label>
                          <input 
                            type="text" 
                            value={formData.quizToken} 
                            onChange={e => setFormData({...formData, quizToken: e.target.value.toUpperCase()})}
                            placeholder="MISAL: UJIAN01"
                            className="w-full p-3 lg:p-4 border-2 border-blue-100 rounded-xl font-black outline-none focus:border-blue-500 bg-blue-50 text-blue-700 text-xs"
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
                            className="w-full p-3 lg:p-4 border rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50 text-xs"
                          />
                          <datalist id="subject-options">
                            {SUBJECT_LIST.map(s => <option key={s} value={s} />)}
                          </datalist>
                       </div>
                   </div>

                   <div className="bg-slate-50 p-4 lg:p-6 rounded-2xl lg:rounded-3xl border border-slate-200 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level Kognitif</label>
                         <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-full sm:w-auto">
                            <button onClick={() => setLevelMode('bloom')} className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[8px] lg:text-[9px] font-black transition-all ${levelMode === 'bloom' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}>BLOOM</button>
                            <button onClick={() => setLevelMode('puspendik')} className={`flex-1 sm:flex-none px-3 py-2 rounded-lg text-[8px] lg:text-[9px] font-black transition-all ${levelMode === 'puspendik' ? 'bg-orange-600 text-white' : 'text-slate-400'}`}>PUSPENDIK</button>
                         </div>
                      </div>
                      <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})} className="w-full p-3 lg:p-4 border rounded-xl font-black outline-none bg-white text-xs">
                          {(levelMode === 'bloom' ? BLOOM_LEVELS : PUSPENDIK_LEVELS).map(l => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                      </select>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Butir Pertanyaan</label>
                      <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-4 lg:p-5 bg-slate-50 border border-slate-200 rounded-xl h-32 outline-none font-bold text-slate-800 text-xs lg:text-sm" placeholder="Tulis butir soal..." />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gambar Soal (Opsional)</label>
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center p-4 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                         {formData.questionImage ? (
                           <div className="relative w-20 h-20 shrink-0 group">
                             <img src={formData.questionImage} className="w-full h-full object-cover rounded-lg" alt="Preview" />
                             <button onClick={() => setFormData({...formData, questionImage: undefined})} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px]">×</button>
                           </div>
                         ) : (
                           <div className="w-20 h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300">🖼️</div>
                         )}
                         <input type="file" ref={mainFileInputRef} onChange={(e) => handleFileUpload(e)} className="hidden" accept="image/*" />
                         <button onClick={() => mainFileInputRef.current?.click()} className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase hover:bg-slate-100">Pilih Gambar</button>
                      </div>
                   </div>
                </div>

                <div className="lg:col-span-5 space-y-4 lg:space-y-6 lg:border-l lg:pl-10">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipe & Opsi Jawaban</label>
                      <select value={formData.type} onChange={e => handleTypeChange(e.target.value as QuestionType)} className="w-full p-3 lg:p-4 border rounded-xl font-black outline-none bg-blue-50 text-blue-700 mb-4 text-xs">
                          {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>

                      <div className="space-y-3 max-h-[40vh] lg:max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                         {formData.options.map((opt, idx) => (
                           <div key={idx} className="p-3 lg:p-4 bg-white border border-slate-200 rounded-xl relative space-y-3">
                              <div className="flex gap-2 items-start">
                                 {formData.type === QuestionType.SINGLE ? (
                                    <input type="radio" checked={formData.correctAnswer === idx} onChange={() => setFormData({...formData, correctAnswer: idx})} className="mt-1 w-4 h-4 accent-blue-600" />
                                 ) : formData.type === QuestionType.MULTIPLE ? (
                                    <input type="checkbox" checked={(formData.correctAnswer || []).includes(idx)} onChange={(e) => {
                                       const current = formData.correctAnswer || [];
                                       const next = e.target.checked ? [...current, idx] : current.filter((i:any) => i !== idx);
                                       setFormData({...formData, correctAnswer: next});
                                    }} className="mt-1 w-4 h-4 accent-purple-600" />
                                 ) : (
                                    <button onClick={() => {
                                       const next = [...(formData.correctAnswer || formData.options.map(() => false))];
                                       next[idx] = !next[idx];
                                       setFormData({...formData, correctAnswer: next});
                                    }} className={`mt-1 w-8 h-4 rounded-full transition-all shrink-0 ${formData.correctAnswer?.[idx] ? 'bg-green-500' : 'bg-slate-300'}`}>
                                       <div className={`w-2 h-2 bg-white rounded-full transition-all mx-1 ${formData.correctAnswer?.[idx] ? 'translate-x-4' : ''}`}></div>
                                    </button>
                                 )}
                                 
                                 <textarea value={opt} onChange={(e) => {
                                   const next = [...formData.options]; next[idx] = e.target.value;
                                   setFormData({...formData, options: next});
                                 }} className="w-full bg-slate-50 p-2 rounded-lg text-xs font-bold outline-none h-12" placeholder={`Teks Opsi...`} />
                                 
                                 <button onClick={() => handleRemoveOption(idx)} className="text-red-400 hover:text-red-600 font-bold p-1">×</button>
                              </div>
                           </div>
                         ))}
                      </div>
                      <button onClick={handleAddOption} className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-400 font-black text-[10px] uppercase hover:bg-slate-50 rounded-xl mt-2">+ Opsi</button>
                   </div>
                </div>
             </div>

             <div className="sticky bottom-0 bg-white pt-6 pb-2 border-t mt-8 flex flex-col sm:flex-row gap-3">
                <button onClick={closeForm} className="order-2 sm:order-1 flex-1 py-3 lg:py-4 bg-slate-100 text-slate-500 font-black rounded-xl uppercase tracking-widest text-[10px]">Batal</button>
                <button onClick={handleSave} className="order-1 sm:order-2 flex-[2] py-3 lg:py-4 bg-blue-600 text-white font-black rounded-xl uppercase shadow-lg text-[10px] tracking-widest">
                   {editingId ? 'Simpan Perubahan' : 'Tambah Soal'}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
