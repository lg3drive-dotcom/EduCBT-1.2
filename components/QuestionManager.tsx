
import React, { useState, useRef, useMemo } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types.ts';
import { SUBJECT_LIST, COGNITIVE_LEVELS } from '../constants.ts';
import { generateQuestionBankPDF } from '../services/pdfService.ts';

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
  const [activeTab, setActiveTab] = useState<'active' | 'trash'>('active');
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'ALL'>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
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

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}>BANK SOAL</button>
            <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'trash' ? 'bg-red-500 text-white' : 'text-slate-400 hover:text-slate-600'}`}>SAMPAH</button>
          </div>
          {activeTab === 'active' && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filter:</span>
              <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold outline-none text-slate-700">
                <option value="ALL">Semua Mapel</option>
                {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="flex gap-2">
           <button onClick={handleExport} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-2 shadow-sm transition-all active:scale-95">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" /></svg> PDF Bank Soal
           </button>
           <button onClick={() => setShowForm(true)} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-black shadow-lg uppercase tracking-widest transition-all">Tambah Manual</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/30">
        <div className="p-6 space-y-4">
          {processedQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="font-medium text-sm text-center">Data tidak ditemukan.</div>
            </div>
          ) : (
            processedQuestions.map((q, idx) => {
              const dispNum = getDisplayNumber(q);
              return (
                <div key={q.id} className="bg-white p-5 border border-slate-200 rounded-2xl group flex gap-5 items-start hover:shadow-md transition-all">
                  <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-sm border border-blue-100">{dispNum}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-black uppercase">{q.subject}</span>
                        <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded-full font-black uppercase">{q.level}</span>
                      </div>
                      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {activeTab === 'active' ? (
                          <button onClick={() => onSoftDelete(q.id)} className="text-red-400 text-[10px] font-black uppercase tracking-widest">Buang</button>
                        ) : (
                          <button onClick={() => onRestore(q.id)} className="text-green-600 text-[10px] font-black uppercase tracking-widest">Pulihkan</button>
                        )}
                      </div>
                    </div>
                    <p className="font-semibold text-slate-800 leading-relaxed text-sm">{q.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[95vh]">
             <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h3 className="text-2xl font-black text-slate-800">Tambah Soal Manual</h3>
                <button onClick={closeForm} className="text-2xl">×</button>
             </div>
             <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <select value={formData.type} onChange={e => handleTypeChange(e.target.value as QuestionType)} className="p-4 border rounded-xl font-bold outline-none focus:border-blue-500">
                        {Object.values(QuestionType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={formData.level} onChange={e => setFormData({...formData, level: e.target.value as CognitiveLevel})} className="p-4 border rounded-xl font-bold outline-none focus:border-blue-500">
                        {COGNITIVE_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                    </select>
                </div>
                <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-500 rounded-2xl h-24 outline-none font-bold" placeholder="Tulis butir soal..." />
                
                {formData.type !== QuestionType.SINGLE && <p className="text-xs text-slate-400 font-bold italic">Tipe {formData.type} memerlukan opsi jawaban yang valid.</p>}
                
                <div className="flex gap-4">
                   <button onClick={() => { if (editingId) onUpdate({...formData, id: editingId, isDeleted: false, createdAt: Date.now()}); else onAdd({...formData, id: Math.random().toString(), isDeleted: false, createdAt: Date.now(), order: formData.order }); closeForm(); }} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl uppercase shadow-lg shadow-blue-100 transition-all active:scale-95">Simpan Soal</button>
                </div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
