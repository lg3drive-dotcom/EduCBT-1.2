
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types.ts';
import { SUBJECT_LIST, BLOOM_LEVELS, PUSPENDIK_LEVELS, COGNITIVE_LEVELS } from '../constants.ts';
import { generateQuestionBankPDF } from '../services/pdfService.ts';
import MathText from './MathText.tsx';

interface QuestionManagerProps {
  questions: Question[];
  activeToken: string;
  onAdd: (q: any) => void;
  onUpdate: (q: Question) => void;
  onSoftDelete: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onRestore: (id: string) => void;
  onImportQuestions: (newQuestions: Question[]) => void;
}

const QuestionManager: React.FC<QuestionManagerProps> = ({ 
  questions, activeToken, onAdd, onUpdate, onSoftDelete, onPermanentDelete, onRestore, onImportQuestions
}) => {
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const [tokenFilter, setTokenFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<{
    text: string;
    material: string;
    explanation: string;
    questionImage: string;
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
    text: '', material: '', explanation: '', questionImage: '', type: QuestionType.SINGLE,
    level: CognitiveLevel.C1, options: ['', '', '', ''],
    optionImages: [undefined, undefined, undefined, undefined],
    correctAnswer: 0, subject: Subject.PANCASILA, phase: 'Fase C', order: 1,
    quizToken: activeToken, tfLabels: { true: 'Benar', false: 'Salah' }
  });

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
      text: '', material: '', explanation: '', questionImage: '', type: QuestionType.SINGLE, 
      level: CognitiveLevel.C1, options: ['', '', '', ''], 
      optionImages: [undefined, undefined, undefined, undefined], 
      correctAnswer: 0, subject: Subject.PANCASILA, phase: 'Fase C', order: 1,
      quizToken: activeToken, tfLabels: { true: 'Benar', false: 'Salah' }
    });
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setFormData({
      text: q.text, material: q.material, explanation: q.explanation,
      questionImage: q.questionImage || '', type: q.type, level: q.level,
      options: q.options || ['', '', '', ''],
      optionImages: q.optionImages || (q.options ? q.options.map(() => undefined) : [undefined, undefined, undefined, undefined]),
      correctAnswer: q.correctAnswer, subject: q.subject, phase: q.phase || 'Fase C',
      order: q.order || 1, quizToken: q.quizToken || activeToken,
      tfLabels: q.tfLabels || { true: 'Benar', false: 'Salah' }
    });
    setShowForm(true);
  };

  const processedQuestions = useMemo(() => {
    let filtered = questions.filter(q => activeTab === 'active' ? !q.isDeleted : q.isDeleted);
    if (activeTab === 'active') {
      if (subjectFilter.trim()) filtered = filtered.filter(q => q.subject.toLowerCase().includes(subjectFilter.toLowerCase()));
      if (tokenFilter.trim()) filtered = filtered.filter(q => q.quizToken?.toUpperCase().includes(tokenFilter.toUpperCase()));
    }
    const tokenActivityMap: { [key: string]: number } = {};
    filtered.forEach(q => {
      const t = (q.quizToken || 'UMUM').toUpperCase();
      if (!tokenActivityMap[t] || q.createdAt > tokenActivityMap[t]) tokenActivityMap[t] = q.createdAt;
    });
    return filtered.sort((a, b) => {
      const tokenA = (a.quizToken || 'UMUM').toUpperCase();
      const tokenB = (b.quizToken || 'UMUM').toUpperCase();
      if (tokenA !== tokenB) return (tokenActivityMap[tokenB] || 0) - (tokenActivityMap[tokenA] || 0);
      return (a.order || 0) - (b.order || 0);
    });
  }, [questions, activeTab, subjectFilter, tokenFilter]);

  const handleSave = () => {
    if (!formData.text) return alert("Butir soal wajib diisi.");
    const finalData = { ...formData, quizToken: formData.quizToken.toUpperCase(), isDeleted: false, createdAt: Date.now(), order: Number(formData.order) };
    if (editingId) onUpdate({ ...finalData, id: editingId } as Question);
    else onAdd(finalData);
    closeForm();
  };

  const handleExportJSON = () => {
    if (processedQuestions.length === 0) return alert("Tidak ada soal yang bisa diekspor.");
    const blob = new Blob([JSON.stringify(processedQuestions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Export_CBT_${tokenFilter || 'Filter'}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) return alert("Format JSON tidak valid.");
        onImportQuestions(imported);
        alert(`Berhasil mengimpor ${imported.length} soal.`);
      } catch (e) { alert("Gagal membaca file JSON."); }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePasteImport = () => {
    try {
      const imported = JSON.parse(pasteContent);
      if (!Array.isArray(imported)) return alert("Data harus berupa kumpulan soal (Array).");
      onImportQuestions(imported);
      alert(`Berhasil mengimpor ${imported.length} soal.`);
      setIsPasteModalOpen(false);
      setPasteContent('');
    } catch (e) { alert("Teks JSON tidak valid."); }
  };

  const renderPreviewContent = (q: Question) => {
    const isComplex = q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH;
    const labels = q.tfLabels || { true: 'Benar', false: 'Salah' };
    return (
      <div className="space-y-6">
        {q.questionImage && <div className="w-full flex justify-center mb-4"><img src={q.questionImage} onClick={() => setZoomImage(q.questionImage!)} className="max-w-full h-auto rounded-2xl border-4 border-white shadow-lg cursor-zoom-in" /></div>}
        <MathText text={q.text} className="text-sm font-medium text-slate-700 block bg-slate-50 p-6 rounded-2xl border border-slate-100" />
        {isComplex ? (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-white"><tr className="text-[9px] font-black uppercase"><th className="p-3">Pernyataan</th><th className="p-3 text-center">Kunci</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {q.options?.map((opt, idx) => (
                  <tr key={idx}><td className="p-3"><MathText text={opt} className="text-xs font-bold text-slate-600" /></td>
                    <td className="p-3 flex gap-1 justify-center">
                      <div className={`px-3 py-1 rounded text-[8px] font-black ${Array.isArray(q.correctAnswer) && q.correctAnswer[idx] === true ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{labels.true.toUpperCase()}</div>
                      <div className={`px-3 py-1 rounded text-[8px] font-black ${Array.isArray(q.correctAnswer) && q.correctAnswer[idx] === false ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{labels.false.toUpperCase()}</div>
                    </td></tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {q.options?.map((opt, idx) => {
              const isCorrect = q.type === QuestionType.SINGLE ? q.correctAnswer === idx : (q.correctAnswer || []).includes(idx);
              const optImg = q.optionImages?.[idx];
              return (
                <div key={idx} className={`flex flex-col p-4 border-2 rounded-xl ${isCorrect ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}>
                  <div className="flex items-start">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mr-4 shrink-0 ${isCorrect ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+idx)}</div>
                    <MathText text={opt} className={`text-xs font-bold block ${isCorrect ? 'text-blue-800' : 'text-slate-700'}`} />
                  </div>
                  {optImg && <img src={optImg} onClick={() => setZoomImage(optImg)} className="mt-3 ml-12 max-h-32 rounded-lg border border-slate-200 cursor-zoom-in" />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>BANK SOAL</button>
            <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-lg text-[10px] font-black ${activeTab === 'trash' ? 'bg-red-500 text-white' : 'text-slate-400'}`}>SAMPAH</button>
          </div>
          <input type="text" value={tokenFilter} onChange={(e) => setTokenFilter(e.target.value)} placeholder="Ketik Token..." className="w-24 bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none uppercase" />
          
          <div className="flex gap-1 border-l pl-3 ml-2 border-slate-300">
             <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept=".json" />
             <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Upload JSON">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
             </button>
             <button onClick={() => setIsPasteModalOpen(true)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Paste JSON">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             </button>
             <button onClick={handleExportJSON} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors" title="Export JSON">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
             </button>
          </div>
        </div>
        <button onClick={() => { closeForm(); setShowForm(true); }} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black">TAMBAH</button>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 space-y-4 custom-scrollbar">
        {processedQuestions.map((q) => (
          <div key={q.id} className="bg-white p-4 border rounded-2xl group flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-xs shrink-0">{q.order}</div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase">TOKEN: {q.quizToken}</span>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                   <button onClick={() => setPreviewQuestion(q)} className="text-emerald-600 text-[9px] font-black uppercase">Preview</button>
                   <button onClick={() => handleEdit(q)} className="text-blue-600 text-[9px] font-black uppercase">Edit</button>
                   <button onClick={() => onSoftDelete(q.id)} className="text-red-400 text-[9px] font-black uppercase">Buang</button>
                </div>
              </div>
              <MathText text={q.text} className="font-semibold text-slate-800 text-xs line-clamp-2 block" />
            </div>
          </div>
        ))}
      </div>

      {zoomImage && (
        <div className="fixed inset-0 z-[1000] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-12 animate-in fade-in duration-300" onClick={() => setZoomImage(null)}>
           <button className="absolute top-8 right-8 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white font-black">✕</button>
           <img src={zoomImage} className="max-w-full max-h-full rounded-3xl border-4 border-white/20 shadow-2xl object-contain" onClick={e => e.stopPropagation()} />
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-7xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar flex flex-col">
             <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white shrink-0 z-20">
                <div>
                   <h3 className="text-xl font-black text-slate-800">{editingId ? 'Edit Soal' : 'Tambah Soal'} — Visual Editor</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Gunakan $...$ untuk merender notasi matematika (Contoh: $x^2$)</p>
                </div>
                <button onClick={closeForm} className="text-2xl font-light text-slate-400 p-2 hover:bg-slate-100 rounded-full transition-all">×</button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 flex-1">
                <div className="space-y-6">
                   <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black text-blue-600 uppercase">Token</label><input type="text" value={formData.quizToken} onChange={e => setFormData({...formData, quizToken: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-blue-50 bg-blue-50 rounded-xl font-black text-blue-700 outline-none" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">No. Urut</label><input type="number" min="1" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value) || 1})} className="w-full p-3 border bg-slate-50 rounded-xl font-black outline-none" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Mapel</label><input type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full p-3 border bg-slate-50 rounded-xl font-bold outline-none" /></div>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Tipe Soal</label>
                        <select 
                          value={formData.type} 
                          onChange={e => {
                            const newType = e.target.value as QuestionType;
                            let newAns: any = 0;
                            let newLabels = { ...formData.tfLabels };

                            if (newType === QuestionType.TRUE_FALSE) {
                              newLabels = { true: 'Benar', false: 'Salah' };
                              newAns = formData.options.map(() => false);
                            } else if (newType === QuestionType.MATCH) {
                              newLabels = { true: 'Sesuai', false: 'Tidak Sesuai' };
                              newAns = formData.options.map(() => false);
                            } else if (newType === QuestionType.MULTIPLE) {
                              newAns = [];
                            } else {
                              newAns = 0;
                            }
                            
                            setFormData({...formData, type: newType, correctAnswer: newAns, tfLabels: newLabels});
                          }} 
                          className="w-full p-3 border bg-slate-50 rounded-xl font-bold outline-none text-xs"
                        >
                          {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Level Kognitif</label>
                        <select 
                          value={formData.level} 
                          onChange={e => setFormData({...formData, level: e.target.value})} 
                          className="w-full p-3 border bg-slate-50 rounded-xl font-bold outline-none text-xs"
                        >
                          {COGNITIVE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Isi Butir Pertanyaan</label>
                      <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-4 border bg-slate-50 rounded-2xl h-40 font-mono text-sm outline-none focus:border-blue-500 focus:bg-white transition-all" placeholder="Tulis soal di sini..." />
                   </div>

                   <div className="space-y-3">
                      <div className="flex justify-between items-center">
                         <label className="text-[10px] font-black text-slate-400 uppercase">Opsi Jawaban & Pernyataan</label>
                         <button onClick={() => setFormData(prev => ({ ...prev, options: [...prev.options, ''], optionImages: [...prev.optionImages, undefined], correctAnswer: Array.isArray(prev.correctAnswer) ? [...prev.correctAnswer, false] : prev.correctAnswer }))} className="text-[9px] font-black text-blue-600 uppercase">+ Tambah Opsi</button>
                      </div>
                      <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                         {formData.options.map((opt, idx) => (
                           <div key={idx} className="p-4 bg-slate-50 border rounded-2xl space-y-3 group transition-all hover:border-blue-200">
                              <div className="flex gap-3 items-start">
                                 <div className="pt-2">
                                    <input 
                                      type={formData.type === QuestionType.SINGLE ? 'radio' : 'checkbox'} 
                                      checked={formData.type === QuestionType.SINGLE ? formData.correctAnswer === idx : (Array.isArray(formData.correctAnswer) && (formData.type === QuestionType.MULTIPLE ? formData.correctAnswer.includes(idx) : formData.correctAnswer[idx] === true))} 
                                      onChange={() => {
                                        if(formData.type === QuestionType.SINGLE) setFormData({...formData, correctAnswer: idx});
                                        else if (formData.type === QuestionType.MULTIPLE) {
                                          const cur = formData.correctAnswer || [];
                                          const next = cur.includes(idx) ? cur.filter((i:any) => i !== idx) : [...cur, idx];
                                          setFormData({...formData, correctAnswer: next});
                                        } else {
                                          const next = [...(formData.correctAnswer || formData.options.map(() => false))];
                                          next[idx] = !next[idx];
                                          setFormData({...formData, correctAnswer: next});
                                        }
                                      }}
                                      className="w-4 h-4 cursor-pointer accent-blue-600"
                                    />
                                 </div>
                                 <div className="flex-1">
                                    <textarea value={opt} onChange={e => {
                                       const next = [...formData.options]; next[idx] = e.target.value;
                                       setFormData({...formData, options: next});
                                    }} className="w-full p-3 bg-white border rounded-xl text-xs font-mono h-16 outline-none focus:border-blue-500 transition-all" placeholder={`Teks Opsi ${String.fromCharCode(65+idx)}...`} />
                                 </div>
                                 <button onClick={() => setFormData(prev => ({ ...prev, options: prev.options.filter((_, i) => i !== idx), optionImages: prev.optionImages.filter((_, i) => i !== idx) }))} className="p-2 text-red-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">×</button>
                              </div>
                              <div className="pl-7">
                                 <input 
                                    type="text" 
                                    value={formData.optionImages[idx] || ''} 
                                    onChange={e => {
                                       const next = [...formData.optionImages]; next[idx] = e.target.value || undefined;
                                       setFormData({...formData, optionImages: next});
                                    }}
                                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-[10px] font-mono outline-none focus:border-emerald-500" 
                                    placeholder="URL Gambar Opsi (Opsional)" 
                                 />
                                 {formData.optionImages[idx] && (
                                   <div className="mt-2 flex items-center gap-2">
                                      <img src={formData.optionImages[idx]} className="w-10 h-10 object-cover rounded-lg border cursor-zoom-in" onClick={() => setZoomImage(formData.optionImages[idx]!)} />
                                      <span className="text-[8px] font-bold text-slate-400">Klik untuk zoom</span>
                                   </div>
                                 )}
                              </div>
                           </div>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200 p-8 flex flex-col sticky top-20 h-fit max-h-[80vh] overflow-y-auto custom-scrollbar">
                   <div className="flex items-center gap-2 mb-6 text-slate-400">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em]">Pratinjau Visual (Tampilan Siswa)</span>
                   </div>
                   
                   <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                      <div className="flex items-center gap-3 mb-6">
                         <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-black text-lg">{formData.order}</div>
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formData.type}</p>
                      </div>
                      
                      <div className="space-y-6">
                         {formData.questionImage && (
                            <div className="flex justify-center mb-4">
                               <img src={formData.questionImage} alt="Preview Soal" className="max-w-full h-auto rounded-2xl border-4 border-slate-50 shadow-md cursor-zoom-in" onClick={() => setZoomImage(formData.questionImage)} />
                            </div>
                         )}
                         
                         <MathText text={formData.text || "Tulis pertanyaan..."} className="block text-slate-800 font-medium leading-relaxed" />
                         
                         {formData.type === QuestionType.TRUE_FALSE || formData.type === QuestionType.MATCH ? (
                           <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                             <table className="w-full text-left">
                               <thead className="bg-slate-800 text-white">
                                 <tr className="text-[9px] font-black uppercase"><th className="p-3">Pernyataan</th><th className="p-3 text-center">Kunci</th></tr>
                               </thead>
                               <tbody className="divide-y divide-slate-100">
                                 {formData.options.map((opt, i) => (
                                   <tr key={i}>
                                     <td className="p-3"><MathText text={opt || "..."} className="text-xs font-bold text-slate-700" /></td>
                                     <td className="p-3 flex gap-1 justify-center">
                                       <div className={`px-2 py-1 rounded text-[8px] font-black ${formData.correctAnswer?.[i] === true ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{formData.tfLabels.true.toUpperCase()}</div>
                                       <div className={`px-2 py-1 rounded text-[8px] font-black ${formData.correctAnswer?.[i] === false ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{formData.tfLabels.false.toUpperCase()}</div>
                                     </td>
                                   </tr>
                                 ))}
                               </tbody>
                             </table>
                           </div>
                         ) : (
                           <div className="space-y-3">
                              {formData.options.map((opt, i) => {
                                 const isCorrect = formData.type === QuestionType.SINGLE 
                                   ? formData.correctAnswer === i 
                                   : (Array.isArray(formData.correctAnswer) && (formData.type === QuestionType.MULTIPLE ? formData.correctAnswer.includes(i) : formData.correctAnswer[i] === true));
                                 
                                 const optImg = formData.optionImages[i];
                                 return (
                                   <div key={i} className={`flex flex-col p-4 border-2 rounded-2xl transition-all ${isCorrect ? 'border-blue-500 bg-blue-50' : 'border-slate-100 bg-white'}`}>
                                      <div className="flex items-start">
                                         <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mr-4 shrink-0 ${isCorrect ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+i)}</div>
                                         <MathText text={opt || "..."} className={`flex-1 text-xs font-bold ${isCorrect ? 'text-blue-800' : 'text-slate-700'}`} />
                                      </div>
                                      {optImg && <img src={optImg} className="mt-3 ml-12 max-h-32 w-auto object-contain rounded-lg border border-slate-100 cursor-zoom-in" onClick={() => setZoomImage(optImg)} />}
                                   </div>
                                 );
                              })}
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>

             <div className="flex gap-4 mt-10 pt-6 border-t bg-white sticky bottom-0 z-20">
                <button onClick={closeForm} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-all">Batal</button>
                <button onClick={handleSave} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase text-xs">Simpan Perubahan</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
