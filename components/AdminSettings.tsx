
import React, { useState, useRef } from 'react';
import { AppSettings, Question } from '../types';

interface AdminSettingsProps {
  settings: AppSettings;
  questions: Question[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onImportQuestions: (newQuestions: Question[], mode: 'replace' | 'append') => void;
  onReset: () => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, questions, onUpdateSettings, onImportQuestions, onReset }) => {
  const [timer, setTimer] = useState(settings.timerMinutes.toString());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onUpdateSettings({
      ...settings,
      timerMinutes: parseInt(timer) || 60
    });
    alert('Pengaturan waktu berhasil disimpan!');
  };

  const handleBackup = () => {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `EduCBT_Backup_BankSoal_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
          Durasi Ujian
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Waktu Default (Menit)</label>
            <input type="number" value={timer} onChange={(e) => setTimer(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-blue-600 transition-all" />
          </div>
          <button onClick={handleSave} className="w-full bg-slate-900 text-white font-black py-3 rounded-2xl shadow-lg hover:bg-black transition-all">SIMPAN WAKTU</button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
          Data & Backup
        </h2>

        <div className="space-y-3">
          <button onClick={handleBackup} className="w-full bg-slate-100 text-slate-700 font-bold py-3 rounded-2xl border border-slate-200 hover:bg-slate-200 transition-all uppercase text-[10px] tracking-widest">Download Bank Soal</button>
          
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
              try {
                const imported = JSON.parse(event.target?.result as string);
                onImportQuestions(imported, 'replace');
                alert("Import berhasil! Tekan Sinkronisasi Cloud untuk memperbarui server.");
              } catch(e) { alert("Format file tidak valid."); }
            };
            reader.readAsText(file);
          }} />
          
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-blue-600 font-bold py-3 rounded-2xl border border-blue-200 hover:bg-blue-50 transition-all uppercase text-[10px] tracking-widest">Upload File .JSON</button>
          
          <button onClick={() => { if(confirm('Kosongkan semua soal di perangkat?')) onReset(); }} className="w-full text-red-500 text-[10px] font-black uppercase tracking-[0.2em] pt-4">Reset Lokal</button>
        </div>
      </div>
      
      <div className="p-5 bg-blue-50 border border-blue-100 rounded-3xl">
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Tips Token</p>
        <p className="text-[11px] text-blue-800 leading-relaxed font-medium">Sistem kini <b>otomatis</b>. Siswa cukup masukkan token yang Anda tulis di edit soal. Pastikan tekan tombol sinkron setiap ada perubahan token soal.</p>
      </div>
    </div>
  );
};

export default AdminSettings;
