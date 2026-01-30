
import React, { useState, useRef, useMemo, useEffect } from 'react';
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
  onBulkUpdate?: (updatedQuestions: Question[]) => void; // Opsional: Tambahkan prop untuk update masal jika ada
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
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  
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
    text: '',
    material: '',
    explanation: '',
    questionImage: '',
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
      quizToken: activeToken,
      tfLabels: { true: 'Benar', false: 'Salah' }
    });
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setFormData({
      text: q.text,
      material: q.material,
      explanation: q.explanation,
      questionImage: q.questionImage || '',
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

  const processedQuestions = useMemo(() => {
    let filtered = questions.filter(q => activeTab === 'active' ? !q.isDeleted : (activeTab === 'trash' ? q.isDeleted : false));
    if (activeTab === 'active') {
      if (subjectFilter.trim() !== '') {
        filtered = filtered.filter(q => q.subject.toLowerCase().includes(subjectFilter.toLowerCase()));
      }
      if (tokenFilter.trim() !== '') {
        filtered = filtered.filter(q => q.quizToken?.toUpperCase().includes(tokenFilter.toUpperCase()));
      }
    }
    
    return filtered.sort((a, b) => {
      const tokenA = (a.quizToken || '').toUpperCase();
      const tokenB = (b.quizToken || '').toUpperCase();
      if (tokenA !== tokenB) return tokenA.localeCompare(tokenB);
      return (a.order || 0) - (b.order || 0);
    });
  }, [questions, activeTab, subjectFilter, tokenFilter]);

  const handleRandomizeOrder = () => {
    const token = tokenFilter.trim().toUpperCase();
    if (!token) {
      alert("Masukkan nama TOKEN pada filter pencarian terlebih dahulu untuk mengacak urutannya.");
      return;
    }

    const tokenQuestions = questions.filter(q => q.quizToken?.toUpperCase() === token && !q.isDeleted);
    
    if (tokenQuestions.length === 0) {
      alert(`Tidak ada soal ditemukan untuk token "${token}".`);
      return;
    }

    if (!confirm(`Acak nomor urut untuk ${tokenQuestions.length} soal pada token "${token}"?`)) return;

    // Shuffle algorithm
    const shuffled = [...tokenQuestions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Update order 1...N
    shuffled.forEach((q, idx) => {
      onUpdate({ ...q, order: idx + 1 });
    });

    alert(`Berhasil mengacak urutan soal untuk token ${token}. Jangan lupa klik "Kirim ke Cloud" agar siswa menerima urutan terbaru ini.`);
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

  const handleDeleteOption = (index: number) => {
    if (formData.options.length <= 1) {
      alert("Soal harus memiliki minimal satu opsi/pernyataan.");
      return;
    }

    setFormData(prev => {
      const nextOptions = [...prev.options];
      nextOptions.splice(index, 1);

      const nextOptionImages = [...prev.optionImages];
      nextOptionImages.splice(index, 1);

      let nextCorrect = prev.correctAnswer;

      if (prev.type === QuestionType.SINGLE) {
        if (prev.correctAnswer === index) {
          nextCorrect = 0;
        } else if (prev.correctAnswer > index) {
          nextCorrect = prev.correctAnswer - 1;
        }
      } else if (prev.type === QuestionType.MULTIPLE) {
        if (Array.isArray(prev.correctAnswer)) {
          nextCorrect = prev.correctAnswer
            .filter((i: number) => i !== index)
            .map((i: number) => (i > index ? i - 1 : i));
        }
      } else if (prev.type === QuestionType.COMPLEX_CATEGORY || prev.type === QuestionType.TRUE_FALSE_COMPLEX) {
        if (Array.isArray(prev.correctAnswer)) {
          const nextArr = [...prev.correctAnswer];
          nextArr.splice(index, 1);
          nextCorrect = nextArr;
        }
      }

      return {
        ...prev,
        options: nextOptions,
        optionImages: nextOptionImages,
        correctAnswer: nextCorrect
      };
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

  const renderPreviewContent = (q: Question) => {
    const isComplex = q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX;
    const labels = q.tfLabels || { true: 'Ya', false: 'Tidak' };

    return (
      <div className="space-y-6">
        {q.questionImage && (
           <div className="w-full flex justify-center mb-4">
              <img src={q.questionImage} alt="Stimulus" className="max-w-full h-auto rounded-2xl border-4 border-white shadow-lg" />
           </div>
        )}
        
        <div className="text-sm font-medium text-slate-700 leading-relaxed bg-slate-50 p-6 rounded-2xl border border-slate-100 whitespace-pre-wrap">
          {q.text}
        </div>

        {isComplex ? (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3 text-[9px] font-black uppercase">Pernyataan</th>
                  <th className="p-3 text-center text-[9px] font-black uppercase w-48">Kunci: {labels.true} / {labels.false}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {q.options?.map((opt, idx) => (
                  <tr key={idx}>
                    <td className="p-3 text-xs font-bold text-slate-600">{opt}</td>
                    <td className="p-3">
                       <div className="flex gap-1 justify-center">
                          <div className={`px-3 py-1 rounded text-[8px] font-black transition-colors ${Array.isArray(q.correctAnswer) && q.correctAnswer[idx] === true ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                            {labels.true.toUpperCase()}
                          </div>
                          <div className={`px-3 py-1 rounded text-[8px] font-black transition-colors ${Array.isArray(q.correctAnswer) && q.correctAnswer[idx] === false ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 text-slate-300'}`}>
                            {labels.false.toUpperCase()}
                          </div>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {q.options?.map((opt, idx) => {
              const isCorrect = q.type === QuestionType.SINGLE 
                ? q.correctAnswer === idx 
                : (q.correctAnswer || []).includes(idx);
              const optImg = q.optionImages?.[idx];
              
              return (
                <div key={idx} className={`flex items-start p-4 border-2 rounded-xl ${isCorrect ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-white'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mr-4 shrink-0 ${isCorrect ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {String.fromCharCode(65+idx)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs font-bold block ${isCorrect ? 'text-green-800' : 'text-slate-600'}`}>{opt}</span>
                    {optImg && (
                      <img src={optImg} className="mt-2 max-h-32 rounded-lg border border-slate-200" alt={`Opsi ${idx}`} />
                    )}
                  </div>
                  {isCorrect && <span className="ml-auto text-[8px] font-black bg-green-600 text-white px-2 py-0.5 rounded shrink-0">KUNCI</span>}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-5 bg-blue-50 border border-blue-100 rounded-2xl">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Penjelasan Jawaban:</p>
          <p className="text-xs text-blue-800 font-medium leading-relaxed italic">{q.explanation || "Tidak ada penjelasan."}</p>
        </div>
      </div>
    );
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
          <input type="text" value={tokenFilter} onChange={(e) => setTokenFilter(e.target.value)} placeholder="Ketik Token..." className="w-24 bg-white border rounded-xl px-3 py-1.5 text-[10px] font-bold outline-none uppercase" />
        </div>
        <div className="flex gap-2">
           <button onClick={handleRandomizeOrder} title="Acak Urutan Soal (Hanya untuk Token yang difilter)" className="bg-amber-100 text-amber-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-amber-200 hover:bg-amber-200 transition-all">Acak Urutan</button>
           <div className="flex bg-white border rounded-xl overflow-hidden shadow-sm">
             <input type="text" value={downloadToken} onChange={(e) => setDownloadToken(e.target.value)} placeholder="Token" className="w-20 px-3 py-1.5 text-[10px] font-bold outline-none uppercase" />
             <button onClick={() => generateQuestionBankPDF(questions.filter(q => q.quizToken?.toUpperCase() === downloadToken.toUpperCase() && !q.isDeleted), 'lengkap', undefined, downloadToken)} className="bg-slate-100 px-3 py-1.5 text-[10px] font-bold border-l">PDF</button>
           </div>
           <button onClick={() => { closeForm(); setShowForm(true); }} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black">TAMBAH</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 space-y-4">
        {processedQuestions.map((q) => (
          <div key={q.id} className="bg-white p-4 border rounded-2xl group flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-xs shrink-0">{q.order}</div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                  <span className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded font-black uppercase">TOKEN: {q.quizToken}</span>
                  <span className="text-[8px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-black uppercase">{q.type}</span>
                  {q.questionImage && <span className="text-[8px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-black uppercase">GAMBAR</span>}
                </div>
                <div className="flex gap-4 opacity-0 group-hover:opacity-100 transition-all">
                   <button onClick={() => setPreviewQuestion(q)} title="Preview Soal" className="text-emerald-600 text-[9px] font-black uppercase flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Preview
                   </button>
                   <button onClick={() => handleEdit(q)} className="text-blue-600 text-[9px] font-black uppercase">Edit</button>
                   <button onClick={() => onSoftDelete(q.id)} className="text-red-400 text-[9px] font-black uppercase">Buang</button>
                </div>
              </div>
              <p className="font-semibold text-slate-800 text-xs line-clamp-2">{q.text}</p>
            </div>
          </div>
        ))}
        {processedQuestions.length === 0 && (
          <div className="py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">Bank Soal Kosong</div>
        )}
      </div>

      {/* MODAL PREVIEW */}
      {previewQuestion && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
                <div>
                   <h3 className="text-lg font-black uppercase tracking-tight">Preview Soal</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tampilan Siswa • Token: {previewQuestion.quizToken}</p>
                </div>
                <button onClick={() => setPreviewQuestion(null)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-black">×</button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                {renderPreviewContent(previewQuestion)}
             </div>
             <div className="p-6 border-t bg-slate-50 flex justify-center">
                <button onClick={() => setPreviewQuestion(null)} className="px-10 py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase tracking-widest shadow-xl">TUTUP PREVIEW</button>
             </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white">
                <h3 className="text-xl font-black text-slate-800">{editingId ? 'Edit Soal' : 'Tambah Soal'}</h3>
                <button onClick={closeForm} className="text-2xl font-light text-slate-400">×</button>
             </div>
             
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-4">
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-blue-600 uppercase">Token Akses</label>
                         <input type="text" value={formData.quizToken} onChange={e => setFormData({...formData, quizToken: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-blue-50 bg-blue-50 rounded-xl font-black text-blue-700 outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase">No. Urut</label>
                         <input type="number" min="1" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value) || 1})} className="w-full p-3 border bg-slate-50 rounded-xl font-black outline-none focus:border-blue-500" />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase">Mapel</label>
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

                   {/* FIELD GAMBAR */}
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-amber-600 uppercase">URL Tautan Gambar (Opsional)</label>
                      <input type="text" value={formData.questionImage} onChange={e => setFormData({...formData, questionImage: e.target.value})} className="w-full p-3 border-2 border-amber-50 bg-amber-50 rounded-xl font-bold text-xs outline-none focus:border-amber-400" placeholder="https://domain.com/gambar.png" />
                      {formData.questionImage && (
                        <div className="mt-2 p-2 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50/30">
                           <img src={formData.questionImage} alt="Preview Stimulus" className="max-h-32 mx-auto rounded-lg shadow-sm" onError={(e) => (e.currentTarget.src = 'https://placehold.co/400x200?text=Gagal+Memuat+Gambar')} />
                        </div>
                      )}
                   </div>

                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Butir Pertanyaan</label>
                      <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-4 border bg-slate-50 rounded-xl h-32 font-medium text-sm outline-none" />
                   </div>
                </div>

                <div className="lg:col-span-5 space-y-4">
                   <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Pernyataan & Kunci</label>
                      <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                         {formData.options.map((opt, idx) => (
                           <div key={idx} className="p-3 bg-slate-50 border rounded-xl flex gap-3 items-start relative group">
                              <div className="flex flex-col gap-1 items-center pt-1">
                                {formData.type === QuestionType.TRUE_FALSE_COMPLEX || formData.type === QuestionType.COMPLEX_CATEGORY ? (
                                   <div className="flex flex-col gap-1">
                                     <button 
                                        onClick={() => {
                                          const next = Array.isArray(formData.correctAnswer) ? [...formData.correctAnswer] : formData.options.map(() => false);
                                          next[idx] = true;
                                          setFormData({...formData, correctAnswer: next});
                                        }}
                                        className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] transition-all ${formData.correctAnswer?.[idx] === true ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                                     >
                                       T
                                     </button>
                                     <button 
                                        onClick={() => {
                                          const next = Array.isArray(formData.correctAnswer) ? [...formData.correctAnswer] : formData.options.map(() => false);
                                          next[idx] = false;
                                          setFormData({...formData, correctAnswer: next});
                                        }}
                                        className={`w-6 h-6 rounded-md flex items-center justify-center font-black text-[10px] transition-all ${formData.correctAnswer?.[idx] === false ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-400'}`}
                                     >
                                       F
                                     </button>
                                   </div>
                                ) : (
                                  <input 
                                    type={formData.type === QuestionType.SINGLE ? 'radio' : 'checkbox'} 
                                    checked={formData.type === QuestionType.SINGLE ? formData.correctAnswer === idx : (formData.correctAnswer || []).includes(idx)} 
                                    onChange={() => {
                                      if(formData.type === QuestionType.SINGLE) setFormData({...formData, correctAnswer: idx});
                                      else {
                                        const cur = formData.correctAnswer || [];
                                        const next = cur.includes(idx) ? cur.filter((i:any) => i !== idx) : [...cur, idx];
                                        setFormData({...formData, correctAnswer: next});
                                      }
                                    }}
                                    className="w-4 h-4 cursor-pointer accent-blue-600 mt-1"
                                  />
                                )}
                              </div>
                              <textarea value={opt} onChange={e => {
                                 const next = [...formData.options]; next[idx] = e.target.value;
                                 setFormData({...formData, options: next});
                              }} className="flex-1 p-2 bg-white border rounded-lg text-[11px] font-bold h-12 outline-none focus:border-blue-400" />
                              <button 
                                onClick={() => handleDeleteOption(idx)}
                                className="absolute -right-2 -top-2 w-6 h-6 bg-red-100 text-red-600 rounded-full border border-red-200 flex items-center justify-center text-xs font-black opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 hover:text-white"
                                title="Hapus Opsi"
                              >
                                ×
                              </button>
                           </div>
                         ))}
                      </div>
                      <button onClick={() => setFormData(prev => ({ ...prev, options: [...prev.options, ''], optionImages: [...prev.optionImages, undefined], correctAnswer: Array.isArray(prev.correctAnswer) ? [...prev.correctAnswer, false] : prev.correctAnswer }))} className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 text-[10px] font-black uppercase rounded-xl">+ Tambah Pernyataan</button>
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
