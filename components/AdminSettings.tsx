
import React, { useState, useRef, useMemo } from 'react';
import { AppSettings, Question } from '../types';
import { fetchSubmissionsByToken } from '../services/supabaseService';
import { exportSubmissionsToExcel } from '../services/excelService';

interface AdminSettingsProps {
  settings: AppSettings;
  questions: Question[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onImportQuestions: (newQuestions: Question[], mode: 'replace' | 'append') => void;
  onReset: () => void;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ 
  settings, 
  questions, 
  onUpdateSettings, 
  onImportQuestions, 
  onReset
}) => {
  const [timer, setTimer] = useState(settings.timerMinutes.toString());
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const availableTokens = useMemo(() => {
    const tokens = questions
      .filter(q => !q.isDeleted && q.quizToken)
      .map(q => q.quizToken!.toUpperCase());
    return Array.from(new Set(tokens)).sort();
  }, [questions]);

  const handleSaveTime = () => {
    onUpdateSettings({
      ...settings,
      timerMinutes: parseInt(timer) || 60
    });
    alert('Pengaturan waktu berhasil disimpan!');
  };

  const toggleToken = (token: string) => {
    setSelectedTokens(prev => 
      prev.includes(token) ? prev.filter(t => t !== token) : [...prev, token]
    );
  };

  const selectAllTokens = () => {
    if (selectedTokens.length === availableTokens.length) {
      setSelectedTokens([]);
    } else {
      setSelectedTokens([...availableTokens]);
    }
  };

  const handleExportJSON = () => {
    if (selectedTokens.length === 0) {
      alert("Pilih minimal satu paket (token) untuk di-backup.");
      return;
    }
    const filteredQs = questions.filter(q => 
      !q.isDeleted && q.quizToken && selectedTokens.includes(q.quizToken.toUpperCase())
    );
    if (filteredQs.length === 0) {
      alert("Tidak ada soal ditemukan pada token yang dipilih.");
      return;
    }
    const blob = new Blob([JSON.stringify(filteredQs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const tokenNames = selectedTokens.length > 2 
      ? `${selectedTokens.slice(0, 2).join('_')}_dst` 
      : selectedTokens.join('_');
    link.download = `EduCBT_Backup_${tokenNames}_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadRecap = async () => {
    if (selectedTokens.length === 0) {
      alert("Pilih minimal satu paket (token) untuk mendownload rekap nilai.");
      return;
    }

    setIsDownloading(true);
    try {
      for (const token of selectedTokens) {
        const data = await fetchSubmissionsByToken(token);
        if (data && data.length > 0) {
          exportSubmissionsToExcel(data, `Rekap_Nilai_${token}_${new Date().toISOString().split('T')[0]}`, questions);
        }
      }
      alert("Proses download selesai.");
    } catch (err: any) {
      alert(`Gagal mengambil data dari server: ${err.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) {
          alert("Format file tidak valid.");
          return;
        }
        onImportQuestions(imported, 'append');
        alert(`BERHASIL: ${imported.length} soal baru telah diimpor.`);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch(e) { 
        alert("Gagal membaca file."); 
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* PENGATURAN DURASI */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>
          Waktu Ujian
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Durasi (Menit)</label>
            <div className="flex gap-2">
              <input type="number" value={timer} onChange={(e) => setTimer(e.target.value)} className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black outline-none focus:border-blue-600 transition-all text-sm" />
              <button onClick={handleSaveTime} className="bg-slate-900 text-white px-4 rounded-2xl text-[10px] font-black uppercase">Simpan</button>
            </div>
          </div>
        </div>
      </div>

      {/* BACKUP & REKAP NILAI */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
          Data & Hasil
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Token</label>
            <button onClick={selectAllTokens} className="text-[9px] font-black text-blue-600 uppercase">Semua</button>
          </div>
          
          <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 custom-scrollbar">
            {availableTokens.map(token => (
              <label key={token} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer">
                <input type="checkbox" checked={selectedTokens.includes(token)} onChange={() => toggleToken(token)} className="w-4 h-4 accent-blue-600" />
                <span className="text-[10px] font-black text-slate-500 uppercase">{token}</span>
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <button 
              onClick={handleDownloadRecap} 
              disabled={selectedTokens.length === 0 || isDownloading} 
              className="w-full bg-emerald-600 disabled:opacity-30 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              {isDownloading ? 'Processing...' : 'Download Rekap Nilai (Excel)'}
            </button>
            
            <button onClick={handleExportJSON} disabled={selectedTokens.length === 0} className="w-full bg-slate-900 disabled:opacity-20 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">Backup Soal (.JSON)</button>
            <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl border-2 border-blue-100 text-[10px] uppercase tracking-widest">Upload .JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
