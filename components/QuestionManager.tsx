
import React, { useState, useRef, useMemo } from 'react';
import { Question, Subject, QuestionType, CognitiveLevel } from '../types.ts';
import { COGNITIVE_LEVELS, SUBJECT_LIST } from '../constants.ts';
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
  const [subjectFilter, setSubjectFilter] = useState<Subject | 'SEMUA'>('SEMUA');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{
    text: string;
    material: string;
    explanation: string;
    type: QuestionType;
    level: CognitiveLevel;
    options: string[];
    correctAnswer: any;
    subject: Subject;
    quizToken: string;
  }>({
    text: '',
    material: '',
    explanation: '',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C1,
    options: ['', '', '', ''],
    correctAnswer: 0,
    subject: SUBJECT_LIST[0],
    quizToken: ''
  });

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({ 
      text: '', material: '', explanation: '', type: QuestionType.SINGLE, 
      level: CognitiveLevel.C1, options: ['', '', '', ''], 
      correctAnswer: 0, subject: SUBJECT_LIST[0], quizToken: ''
    });
  };

  const handleEdit = (q: Question) => {
    setEditingId(q.id);
    setFormData({
      text: q.text,
      material: q.material,
      explanation: q.explanation,
      type: q.type,
      level: q.level,
      options: q.options || ['', '', '', ''],
      correctAnswer: q.correctAnswer,
      subject: q.subject,
      quizToken: q.quizToken || ''
    });
    setShowForm(true);
  };

  const processedQuestions = useMemo(() => {
    let filtered = questions.filter(q => activeTab === 'active' ? !q.isDeleted : q.isDeleted);
    if (subjectFilter !== 'SEMUA') {
      filtered = filtered.filter(q => q.subject === subjectFilter);
    }
    return filtered.sort((a, b) => a.subject.localeCompare(b.subject));
  }, [questions, activeTab, subjectFilter]);

  const handleSave = () => {
    if (!formData.text) return alert("Pertanyaan tidak boleh kosong.");
    
    const finalData = {
      ...formData,
      isDeleted: false,
      createdAt: Date.now(),
      order: questions.length + 1
    };

    if (editingId) {
      onUpdate({ ...finalData, id: editingId } as Question);
    } else {
      onAdd(finalData);
    }
    closeForm();
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex flex-wrap justify-between items-center gap-4">
        <div className="flex bg-white p-1 rounded-xl border border-slate-200">
          <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>BANK SOAL</button>
          <button onClick={() => setActiveTab('trash')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'trash' ? 'bg-red-500 text-white' : 'text-slate-400'}`}>SAMPAH</button>
        </div>
        
        <div className="flex gap-2">
           <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value as any)} className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none">
              <option value="SEMUA">SEMUA MAPEL</option>
              {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
           </select>
           <button onClick={() => { closeForm(); setShowForm(true); }} className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black hover:bg-black shadow-lg">Tambah Soal</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
        {processedQuestions.map((q, idx) => (
          <div key={q.id} className="bg-white p-5 border border-slate-200 rounded-2xl group flex gap-5 items-start hover:shadow-md transition-all">
            <div className="w-10 h-10 flex items-center justify-center bg-blue-50 text-blue-700 rounded-xl font-black text-sm shrink-0">{idx + 1}</div>
            <div className="flex-1">
              <div className="flex justify-between items-start mb-2">
                <div className="flex gap-2">
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded font-black uppercase">{q.subject}</span>
                  <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-1 rounded font-black uppercase">{q.level.split(' ')[0]}</span>
                </div>
                <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  {activeTab === 'active' ? (
                    <button onClick={() => handleEdit(q)} className="text-blue-600 text-[10px] font-black uppercase tracking-widest">Edit</button>
                  ) : (
                    <button onClick={() => onRestore(q.id)} className="text-green-600 text-[10px] font-black uppercase tracking-widest">Pulihkan</button>
                  )}
                  <button onClick={() => activeTab === 'active' ? onSoftDelete(q.id) : onPermanentDelete(q.id)} className="text-red-400 text-[10px] font-black uppercase tracking-widest">Hapus</button>
                </div>
              </div>
              <p className="font-semibold text-slate-800 leading-relaxed text-sm">{q.text}</p>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-4xl p-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar">
             <div className="flex justify-between items-center mb-8 border-b pb-4">
                <h3 className="text-2xl font-black text-slate-800">{editingId ? 'Edit Soal' : 'Tambah Soal Baru'}</h3>
                <button onClick={closeForm} className="text-2xl text-slate-400">×</button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Mata Pelajaran</label>
                      <select value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} className="w-full p-4 border rounded-xl font-bold outline-none focus:border-blue-500 bg-slate-50 text-sm">
                          {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Butir Pertanyaan</label>
                      <textarea value={formData.text} onChange={e => setFormData({...formData, text: e.target.value})} className="w-full p-4 bg-slate-50 border rounded-xl h-32 outline-none font-bold" placeholder="Tulis soal..." />
                   </div>
                </div>

                <div className="space-y-6">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Opsi Jawaban</label>
                      <div className="space-y-3">
                         {formData.options.map((opt, idx) => (
                           <div key={idx} className="flex gap-2">
                              <input type="radio" checked={formData.correctAnswer === idx} onChange={() => setFormData({...formData, correctAnswer: idx})} className="mt-2" />
                              <input value={opt} onChange={(e) => {
                                const next = [...formData.options]; next[idx] = e.target.value;
                                setFormData({...formData, options: next});
                              }} className="w-full bg-slate-50 p-2 rounded-lg text-xs font-bold outline-none" placeholder={`Opsi ${idx+1}`} />
                           </div>
                         ))}
                      </div>
                   </div>
                </div>
             </div>

             <div className="mt-8 pt-6 border-t flex gap-4">
                <button onClick={closeForm} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl uppercase text-xs">Batal</button>
                <button onClick={handleSave} className="flex-[2] py-4 bg-blue-600 text-white font-black rounded-2xl uppercase shadow-xl hover:bg-blue-700 transition-all text-xs">Simpan Soal</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionManager;
