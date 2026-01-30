
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types.ts';
import { SUBJECT_LIST, BLOOM_LEVELS, PUSPENDIK_LEVELS } from '../constants.ts';
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

  const renderPreviewContent = (q: Question) => {
    const isComplex = q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX;
    const labels = q.tfLabels || { true: 'Ya', false: 'Tidak' };
    return (
      <div className="space-y-6">
        {q.questionImage && <div className="w-full flex justify-center mb-4"><img src={q.questionImage} className="max-w-full h-auto rounded-2xl border-4 border-white shadow-lg" /></div>}
        <MathText text={q.text} className="text-sm font-medium text-slate-700 block bg-slate-50 p-6 rounded-2xl border border-slate-100" />
        {isComplex ? (
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-800 text-white"><tr className="text-[9px] font-black uppercase"><th className="p-3">Pernyataan</th><th className="p-3 text-center">Kunci</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {q.options?.map((opt, idx) => (
                  <tr key={idx}><td className="p-3"><MathText text={opt} className="text-xs font-bold text-slate-600" /></td>
                    <td className="p-3 flex gap-1 justify-center">
                      <div className={`px-3 py-1 rounded text-[8px] font-black ${Array.isArray(q.correctAnswer) && q.correctAnswer[idx] === true ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-300'}`}>{labels.true.toUpperCase()}</div>
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
              return (
                <div key={idx} className={`flex items-start p-4 border-2 rounded-xl ${isCorrect ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-white'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs mr-4 shrink-0 ${isCorrect ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{String.fromCharCode(65+idx)}</div>
                  <MathText text={opt} className={`text-xs font-bold block ${isCorrect ? 'text-green-800' : 'text-slate-600'}`} />
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
        </div>
        <button onClick={() => { closeForm(); setShowForm(true); }} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-[10px] font-black">TAMBAH</button>
      </div>
      <div className="flex-1 overflow-y-auto bg-slate-50/30 p-4 space-y-4">
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
      {previewQuestion && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
             <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <h3 className="text-lg font-black uppercase tracking-tight">Preview Soal Math</h3>
                <button onClick={() => setPreviewQuestion(null)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-black">×</button>
             </div>
             <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">{renderPreviewContent(previewQuestion)}</div>
             <div className="p-6 border-t bg-slate-50 flex justify-center"><button onClick={() => setPreviewQuestion(null)} className="px-10 py-3 bg-slate-900 text-white font-black rounded-xl text-[10px] uppercase shadow-xl">TUTUP</button></div>
          </div>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl p-8 shadow-2xl overflow-y-auto max-h-[95vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-6 border-b pb-4 sticky top-0 bg-white shrink-0">
                <h3 className="text-xl font-black text-slate-800">Editor Soal dengan LaTeX</h3>
                <button onClick={closeForm} className="text-2xl font-light text-slate-400">×</button>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-4">
                   <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black text-blue-600 uppercase">Token</label><input type="text" value={formData.quizToken} onChange={e => setFormData({...formData, quizToken: e.target.value.toUpperCase()})} className="w-full p-3 border-2 border-blue-50 bg-blue-50 rounded-xl font-black text-blue-700 outline-none" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">No. Urut</label><input type="number" min="1" value={formData.order} onChange={e => setFormData({...formData, order: parseInt(e.target.value) || 1})} className="w-full p-3 border bg-slate-50 rounded-xl font-black outline-none" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Mapel</label><input type="text" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full p-3 border bg-slate-50 rounded-xl font-bold outline-none" /></div>
                   </div>
                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Butir Pertanyaan (Gunakan $...$ untuk Rumus)</label><textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-4 border bg-slate-50 rounded-xl h-32 font-medium text-sm outline-none" placeholder="Berapa hasil dari $\frac{1}{2} + 0.5$?" /></div>
                   <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-[10px] font-bold text-blue-700 uppercase">Preview Input: <MathText text={formData.text} className="block mt-1 lowercase normal-case" /></div>
                </div>
                <div className="lg:col-span-5 space-y-4">
                   <label className="text-[10px] font-black text-slate-400 uppercase">Opsi Jawaban</label>
                   <div className="space-y-3 pr-2 custom-scrollbar">
                      {formData.options.map((opt, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 border rounded-xl space-y-2">
                           <textarea value={opt} onChange={e => {
                              const next = [...formData.options]; next[idx] = e.target.value;
                              setFormData({...formData, options: next});
                           }} className="w-full p-2 bg-white border rounded-lg text-[11px] font-bold h-12 outline-none" placeholder={`Opsi ${idx+1}`} />
                           <div className="text-[9px] text-slate-400 uppercase">Live Preview: <MathText text={opt} /></div>
                        </div>
                      ))}
                   </div>
                </div>
             </div>
             <div className="flex gap-4 mt-10">
                <button onClick={closeForm} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-xs">Batal</button>
                <button onClick={handleSave} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase text-xs">Simpan Soal</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
