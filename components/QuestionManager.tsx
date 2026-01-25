// Import React to provide namespace for React.FC and React.ChangeEvent
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types.ts';
import { SUBJECT_LIST, BLOOM_LEVELS, PUSPENDIK_LEVELS, KURIKULUM_PHASES } from '../constants.ts';
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
    phase: string;
    order: number;
    quizToken: string;
    tfLabels: { true: string, false: string };
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
    phase: 'Fase C',
    order: 1,
    quizToken: activeToken,
    tfLabels: { true: 'Benar', false: 'Salah' }
  });

  const mainFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editingId && formData.quizToken) {
      const sameToken = questions.filter(q => q.quizToken === formData.quizToken.toUpperCase() && !q.isDeleted);
      const nextOrder = sameToken.length > 0 ? Math.max(...sameToken.map(i => i.order)) + 1 : 1;
      setFormData(prev => ({ ...prev, order: nextOrder }));
    }
  }, [formData.quizToken, editingId, questions]);

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      text: '', material: '', explanation: '', type: QuestionType.SINGLE, 
      level: CognitiveLevel.C1, options: ['', '', '', ''], 
      optionImages: [undefined, undefined, undefined, undefined], 
      correctAnswer: 0, subject: Subject.PANCASILA, phase: 'Fase C', order: 1,
      quizToken: activeToken,
      tfLabels: { true: 'Benar', false: 'Salah' }
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
      phase: q.phase || 'Fase C',
      order: q.order || 1,
      quizToken: q.quizToken || activeToken,
      tfLabels: q.tfLabels || { true: 'Benar', false: 'Salah' }
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
      if ((a.quizToken || '') !== (b.quizToken || '')) return (a.quizToken || '').localeCompare(b.quizToken || '');
      if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
      return (a.order || 0) - (b.order || 0);
    });
  }, [questions, activeTab, subjectFilter, tokenFilter]);

  const handleExport = () => {
    if (!downloadToken.trim()) {
      alert("Masukkan TOKEN SOAL terlebih dahulu!");
      return;
    }
    const filteredForExport = questions
      .filter(q => !q.isDeleted && q.quizToken?.toUpperCase() === downloadToken.trim().toUpperCase())
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (filteredForExport.length === 0) {
      alert(`Tidak ada soal ditemukan dengan token "${downloadToken.toUpperCase()}".`);
      return;
    }
    const exportSubject = filteredForExport[0].subject as any;
    generateQuestionBankPDF(filteredForExport, 'lengkap', exportSubject, downloadToken.trim().toUpperCase());
  };

  const handleDownloadJson = () => {
    if (!downloadToken.trim()) {
      alert("Masukkan TOKEN SOAL terlebih dahulu!");
      return;
    }
    const filteredForExport = questions
      .filter(q => !q.isDeleted && q.quizToken?.toUpperCase() === downloadToken.trim().toUpperCase())
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    if (filteredForExport.length === 0) {
      alert(`Tidak ada soal ditemukan dengan token "${downloadToken.toUpperCase()}".`);
      return;
    }
    const blob = new Blob([JSON.stringify(filteredForExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EduCBT_Package_${downloadToken.trim().toUpperCase()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, ''],
      optionImages: [...prev.optionImages, undefined],
      correctAnswer: (prev.type === QuestionType.COMPLEX_CATEGORY || prev.type === QuestionType.TRUE_FALSE_COMPLEX) 
        ? [...(prev.correctAnswer || []), false] 
        : prev.correctAnswer
    }));
  };

  const handleRemoveOption = (idx: number) => {
    setFormData(prev => {
      const nextOptions = prev.options.filter((_, i) => i !== idx);
      const nextImages = prev.optionImages.filter((_, i) => i !== idx);
      let nextCorrect = prev.correctAnswer;
      if (prev.type === QuestionType.SINGLE && prev.correctAnswer === idx) nextCorrect = 0;
      if (Array.isArray(prev.correctAnswer)) nextCorrect = prev.correctAnswer.filter((_, i) => i !== idx);
      return { ...prev, options: nextOptions, optionImages: nextImages, correctAnswer: nextCorrect };
    });
  };

  const handleTypeChange = (newType: QuestionType) => {
    setFormData(prev => {
      let nextCorrect: any = 0;
      if (newType === QuestionType.MULTIPLE) nextCorrect = [];
      else if (newType === QuestionType.COMPLEX_CATEGORY || newType === QuestionType.TRUE_FALSE_COMPLEX) 
        nextCorrect = prev.options.map(() => false);
      return { ...prev, type: newType, correctAnswer: nextCorrect };
    });
  };

  const handleSave = () => {
    if (!formData.text) return alert("Butir soal wajib diisi.");
    const finalData = {
      ...formData,
      quizToken: formData.quizToken.toUpperCase(),
      isDeleted: false,
      createdAt: Date.now(),
      order: Number(formData.order)
    };
    if (editingId) onUpdate({ ...finalData, id: editingId } as Question);
    else onAdd(finalData);
    closeForm();
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>BANK SOAL</button>
            <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${activeTab === 'trash' ? 'bg-red-500 text-white' : 'text-slate-400'}`}>SAMPAH</button>
          </div>
          <input type="text" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} placeholder="Mapel..." className="w-32 bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none" />
          <input type="text" value={tokenFilter} onChange={(e) => setTokenFilter(e.target.value)} placeholder="Token..." className="w-24 bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none" />
        </div>
        <div className="flex gap-2">
           <div className="flex bg-white border rounded-xl overflow-hidden shadow-sm">
             <input type="text" value={downloadToken} onChange={(e) => setDownloadToken(e.target.value)} placeholder="Token" className="w-20 px-3 py-1.5 text-[10px] font-bold outline-none uppercase" />
             <button onClick={handleExport} className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold border-l">PDF</button>
             <button onClick={handleDownloadJson} className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold border-l">JSON</button>
           </div>
           <button onClick={() => { closeForm(); setShowForm(true); }} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black">TAMBAH</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 space-y-4">
        {processedQuestions.map((q) => (
          <div key={q.id} className="bg-white p-4 border rounded-2xl group flex gap-4 items-start shadow-sm">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-xs shrink-0">{q.order}</div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                  <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase">TOKEN: {q.quizToken}</span>
                  <span className="text-[8px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black uppercase">{q.type}</span>
                </div>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                   <button onClick={() => handleEdit(q)} className="text-blue-600 text-[9px] font-black uppercase">Edit</button>
                   <button onClick={() => onSoftDelete(q.id)} className="text-red-400 text-[9px] font-black uppercase">Buang</button>
                </div>
              </div>
              <p className="font-semibold text-slate-800 text-xs line-clamp-2">{q.text}</p>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white">
                <h3 className="text-xl font-black text-slate-800">{editingId ? 'Edit Soal' : 'Tambah Soal'}</h3>
                <button onClick={closeForm} className="text-2xl font-light text-slate-400">×</button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-blue-600 uppercase">Token Akses</label>
                         <input type="text" value={formData.quizToken} onChange={e => setFormData({...formData, quizToken: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-blue-50 bg-blue-50 rounded-xl font-black text-blue-700 outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase">Mata Pelajaran</label>
                         <input type="text" list="subject-list" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full p-3 border bg-slate-50 rounded-xl font-bold outline-none" />
                         <datalist id="subject-list">{SUBJECT_LIST.map(s => <option key={s} value={s} />)}</datalist>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Tipe Soal</label>
                      <select value={formData.type} onChange={e => handleTypeChange(e.target.value as QuestionType)} className="w-full p-3 border rounded-xl font-black outline-none bg-white">
                          {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                   </div>

                   {formData.type === QuestionType.TRUE_FALSE_COMPLEX && (
                      <div className="grid grid-cols-2 gap-4 p-4 bg-orange-50 border border-orange-100 rounded-2xl">
                         <div className="space-y-1">
                            <label className="text-[9px] font-black text-orange-600 uppercase">Label Tombol Positif</label>
                            <input type="text" value={formData.tfLabels.true} onChange={e => setFormData({...formData, tfLabels: {...formData.tfLabels, true: e.target.value}})} className="w-full p-2 border bg-white rounded-lg font-bold text-xs" placeholder="Contoh: Benar, Sesuai, Fakta" />
                         </div>
                         <div className="space-y-1">
                            <label className="text-[9px] font-black text-orange-600 uppercase">Label Tombol Negatif</label>
                            <input type="text" value={formData.tfLabels.false} onChange={e => setFormData({...formData, tfLabels: {...formData.tfLabels, false: e.target.value}})} className="w-full p-2 border bg-white rounded-lg font-bold text-xs" placeholder="Contoh: Salah, Tidak Sesuai, Opini" />
                         </div>
                      </div>
                   )}

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Butir Pertanyaan</label>
                      <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-4 border bg-slate-50 rounded-xl h-32 font-medium text-sm outline-none" />
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Materi & Indikator</label>
                      <input type="text" value={formData.material} onChange={e => setFormData({...formData, material: e.target.value})} className="w-full p-3 border bg-slate-50 rounded-xl text-xs font-bold" />
                   </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Opsi Jawaban & Kunci</label>
                      <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                         {formData.options.map((opt, idx) => (
                           <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex gap-3 items-start">
                              {formData.type === QuestionType.SINGLE ? (
                                <input type="radio" checked={formData.correctAnswer === idx} onChange={() => setFormData({...formData, correctAnswer: idx})} />
                              ) : formData.type === QuestionType.MULTIPLE ? (
                                <input type="checkbox" checked={(formData.correctAnswer || []).includes(idx)} onChange={(e) => {
                                  const current = formData.correctAnswer || [];
                                  const next = e.target.checked ? [...current, idx] : current.filter((i:any) => i !== idx);
                                  setFormData({...formData, correctAnswer: next});
                                }} />
                              ) : (
                                <button onClick={() => {
                                  const next = [...(formData.correctAnswer || formData.options.map(() => false))];
                                  next[idx] = !next[idx];
                                  // Fix: Change setAnswers to setFormData
                                  setFormData({...formData, correctAnswer: next});
                                }} className={`w-8 h-4 rounded-full mt-1 transition-all ${formData.correctAnswer?.[idx] ? 'bg-blue-600' : 'bg-slate-300'}`}>
                                  <div className={`w-2 h-2 bg-white rounded-full mx-1 transition-all ${formData.correctAnswer?.[idx] ? 'translate-x-4' : ''}`}></div>
                                </button>
                              )}
                              <textarea value={opt} onChange={e => {
                                 const next = [...formData.options]; next[idx] = e.target.value;
                                 setFormData({...formData, options: next});
                              }} className="flex-1 p-2 bg-white border rounded-lg text-[11px] font-bold h-12" />
                              <button onClick={() => handleRemoveOption(idx)} className="text-red-400 font-black">×</button>
                           </div>
                         ))}
                      </div>
                      <button onClick={handleAddOption} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase rounded-xl">+ Tambah Pernyataan</button>
                   </div>
                </div>
             </div>

             <div className="flex gap-4 mt-10">
                <button onClick={closeForm} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-xs">Batal</button>
                <button onClick={handleSave} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-xs">Simpan Soal</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;