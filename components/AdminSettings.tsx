
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
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
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

  const handlePasteImport = () => {
    if (!pasteContent.trim()) {
      alert("Silakan tempel teks JSON terlebih dahulu.");
      return;
    }

    try {
      const imported = JSON.parse(pasteContent);
      if (!Array.isArray(imported)) {
        alert("Data JSON harus berupa array (kumpulan soal).");
        return;
      }
      onImportQuestions(imported, 'append');
      alert(`BERHASIL: ${imported.length} soal baru telah diimpor dari teks.`);
      setPasteContent('');
      setIsPasteModalOpen(false);
    } catch (e) {
      alert("Format JSON tidak valid. Pastikan Anda menyalin seluruh teks dengan benar.");
    }
  };

  const handleResetData = () => {
    const confirmed = confirm(
      "PERINGATAN KERAS!\n\n" +
      "Seluruh data soal yang ada di perangkat ini (LOKAL) akan dihapus total.\n" +
      "Tindakan ini tidak akan menghapus data di Cloud Supabase, namun bank soal di layar ini akan kosong.\n\n" +
      "Apakah Anda yakin ingin melakukan RESET LOKAL?"
    );
    if (confirmed) {
      onReset();
      alert("Bank soal lokal telah dikosongkan.");
    }
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

          <div className="grid grid-cols-1 gap-2 pt-2">
            <button 
              onClick={handleDownloadRecap} 
              disabled={selectedTokens.length === 0 || isDownloading} 
              className="w-full bg-emerald-600 disabled:opacity-30 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              {isDownloading ? 'Processing...' : 'Download Rekap Nilai (Excel)'}
            </button>
            
            <button onClick={handleExportJSON} disabled={selectedTokens.length === 0} className="w-full bg-slate-900 disabled:opacity-20 text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest">Backup Soal (.JSON)</button>
            
            <div className="grid grid-cols-2 gap-2">
               <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
               <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl border-2 border-blue-100 text-[10px] uppercase tracking-widest shadow-sm">Upload .JSON</button>
               <button onClick={() => setIsPasteModalOpen(true)} className="w-full bg-blue-50 text-blue-700 font-bold py-4 rounded-2xl border-2 border-blue-200 text-[10px] uppercase tracking-widest shadow-sm">Paste .JSON</button>
            </div>
            <button onClick={handleResetData} className="w-full bg-white text-red-500 font-bold py-4 rounded-2xl border-2 border-red-100 text-[10px] uppercase tracking-widest">Reset Lokal</button>
          </div>
        </div>
      </div>

      {/* MODAL PASTE JSON */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Paste Bank Soal</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tempel teks JSON dari AI Lab ke sini</p>
              </div>
              <button onClick={() => setIsPasteModalOpen(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-black">×</button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto">
              <textarea 
                className="w-full h-80 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-mono text-xs text-slate-600 outline-none focus:border-blue-500 transition-all custom-scrollbar"
                placeholder='Tempel kumpulan soal di sini. Contoh: [{"text": "Soal 1", ...}, ...]'
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
              <div className="mt-6 bg-blue-50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                <div className="text-blue-500 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-[10px] text-blue-700 font-bold leading-relaxed uppercase tracking-wide">
                  Pastikan format JSON yang Anda tempel sesuai dengan standar ekspor EduCBT AI Lab. 
                  Sistem akan mengabaikan soal dengan ID yang sudah ada di lokal.
                </p>
              </div>
            </div>
            <div className="p-8 border-t bg-slate-50 flex gap-4">
              <button onClick={() => setIsPasteModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Tutup</button>
              <button onClick={handlePasteImport} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[10px]">Import Sekarang</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
