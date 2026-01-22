
import React, { useState, useRef } from 'react';
import { AppSettings, Subject, Question } from '../types';
import { SUBJECT_LIST } from '../constants';

interface AdminSettingsProps {
  settings: AppSettings;
  questions: Question[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onImportQuestions: (newQuestions: Question[], mode: 'replace' | 'append') => void;
  onReset: () => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, questions, onUpdateSettings, onImportQuestions, onReset }) => {
  const [timer, setTimer] = useState(settings.timerMinutes.toString());
  const [token, setToken] = useState(settings.activeToken);
  const [subject, setSubject] = useState<Subject>(settings.activeSubject);
  const [backupSubject, setBackupSubject] = useState<Subject | 'ALL'>('ALL');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onUpdateSettings({
      timerMinutes: parseInt(timer) || 60,
      activeToken: token || 'ABCDE',
      activeSubject: subject
    });
    alert('Pengaturan berhasil disimpan!');
  };

  const handleBackup = () => {
    const dataToExport = backupSubject === 'ALL' 
      ? questions 
      : questions.filter(q => q.subject === backupSubject);

    if (dataToExport.length === 0) {
      alert('Tidak ada soal untuk di-backup pada kategori ini.');
      return;
    }

    const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.download = `EduCBT_Backup_${backupSubject}_${timestamp}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string) as Question[];
        if (!Array.isArray(imported)) throw new Error("Format tidak valid");
        
        // Show choice modal (Simplified using standard prompt/confirm for this flow)
        const mode = confirm("Klik OK untuk 'TAMBAHKAN' (Append) ke data yang sudah ada.\nKlik BATAL untuk 'GANTI SEMUA' (Replace) data saat ini.") 
          ? 'append' 
          : 'replace';
        
        if (mode === 'replace') {
          if (confirm("PERINGATAN: Semua soal saat ini akan DIHAPUS dan diganti dengan data baru. Lanjutkan?")) {
            onImportQuestions(imported, 'replace');
          }
        } else {
          // Check for duplicates before appending
          const existingTexts = new Set(questions.filter(q => !q.isDeleted).map(q => q.text.trim().toLowerCase()));
          const duplicates = imported.filter(q => existingTexts.has(q.text.trim().toLowerCase()));
          
          if (duplicates.length > 0) {
            const proceed = confirm(`Ditemukan ${duplicates.length} soal dengan kalimat yang sama persis (GANDA).\n\nTetap tambahkan semua data?`);
            if (proceed) {
              onImportQuestions(imported, 'append');
            }
          } else {
            onImportQuestions(imported, 'append');
          }
        }
      } catch (err) {
        alert("Gagal mengimpor file: Pastikan file adalah backup EduCBT yang valid.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-3.9-5.59-3.9-5.81 0H2.15c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h15.7c1.1 0 2-.9 2-2V5.17c0-1.1-.9-2-2-2h-6.36zM3 7a1 1 0 011-1h1a1 1 0 110 2H4a1 1 0 01-1-1zm3 1a1 1 0 100-2H5a1 1 0 100 2h1zm2-1a1 1 0 011-1h1a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" /></svg>
          Sistem & Token
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Mapel Aktif Ujian</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value as Subject)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500">
              {SUBJECT_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Waktu (Menit)</label>
              <input type="number" value={timer} onChange={(e) => setTimer(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Token Akses</label>
              <input type="text" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} className="w-full px-4 py-3 bg-blue-50 border border-blue-100 text-blue-700 rounded-2xl font-black text-center" />
            </div>
          </div>

          <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-3 rounded-2xl shadow-lg hover:bg-black transition-all">SIMPAN PENGATURAN</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
          Backup & Import
        </h2>

        <div className="space-y-6">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Eksport Data (Backup)</p>
            <div className="flex gap-2">
              <select value={backupSubject} onChange={(e) => setBackupSubject(e.target.value as any)} className="flex-1 px-3 py-2 bg-white border rounded-xl text-xs font-bold outline-none">
                <option value="ALL">Semua Mapel</option>
                {SUBJECT_LIST.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={handleBackup} className="bg-purple-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-purple-100">DOWNLOAD</button>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-3 ml-1">Import Data</p>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              UPLOAD FILE BACKUP (.JSON)
            </button>
          </div>

          <button 
            onClick={() => { if(confirm('HAPUS SEMUA DATA? Bank soal akan dikosongkan kembali.')) onReset(); }}
            className="w-full text-red-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-red-50 py-2 rounded-xl transition-all"
          >
            Reset Bank Soal (Kosongkan)
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
