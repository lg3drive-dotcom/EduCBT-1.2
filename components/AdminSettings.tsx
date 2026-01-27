
import React, { useState, useRef, useMemo } from 'react';
import { AppSettings, Question } from '../types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mengambil daftar unik quizToken dari bank soal yang tersedia
  const availableTokens = useMemo(() => {
    const tokens = questions
      .filter(q => !q.isDeleted && q.quizToken)
      .map(q => q.quizToken!.toUpperCase());
    return Array.from(new Set(tokens)).sort();
  }, [questions]);

  const handleSave = () => {
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (!Array.isArray(imported)) {
          alert("Format file tidak valid. File harus berisi array soal.");
          return;
        }

        const userChoice = confirm(
          `Ditemukan ${imported.length} soal baru.\n\n` +
          `PILIH TINDAKAN:\n` +
          `OK = TAMBAH (Gabungkan soal baru dengan yang sudah ada)\n` +
          `BATAL = GANTI (Hapus semua soal lama dan ganti dengan yang baru)`
        );

        if (userChoice) {
          onImportQuestions(imported, 'append');
          alert(`BERHASIL: ${imported.length} soal baru telah ditambahkan ke bank soal.`);
        } else {
          const confirmReplace = confirm("PERINGATAN: Semua soal lama akan DIHAPUS. Lanjutkan?");
          if (confirmReplace) {
            onImportQuestions(imported, 'replace');
            alert(`BERHASIL: Bank soal telah diganti dengan ${imported.length} soal baru.`);
          }
        }
        
        if (fileInputRef.current) fileInputRef.current.value = '';

      } catch(e) { 
        alert("Gagal membaca file. Pastikan file dalam format .json yang benar."); 
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* PENGATURAN WAKTU */}
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

      {/* BACKUP JSON DENGAN PILIH TOKEN */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
          Backup & Import JSON
        </h2>

        <div className="space-y-4">
          <div className="flex justify-between items-center px-1 mb-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pilih Token Paket</label>
            <button 
              onClick={selectAllTokens}
              className="text-[9px] font-black text-purple-600 uppercase hover:underline"
            >
              {selectedTokens.length === availableTokens.length ? 'Hapus Semua' : 'Pilih Semua'}
            </button>
          </div>
          
          <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 custom-scrollbar">
            {availableTokens.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-4 font-bold">Bank soal kosong.</p>
            ) : (
              availableTokens.map(token => (
                <label key={token} className="flex items-center gap-3 p-2.5 hover:bg-white rounded-xl cursor-pointer transition-colors group">
                  <input 
                    type="checkbox" 
                    checked={selectedTokens.includes(token)}
                    onChange={() => toggleToken(token)}
                    className="w-4 h-4 rounded accent-purple-600"
                  />
                  <span className={`text-[11px] font-black uppercase tracking-tight ${selectedTokens.includes(token) ? 'text-purple-700' : 'text-slate-500'}`}>
                    {token}
                  </span>
                </label>
              ))
            )}
          </div>

          <button 
            onClick={handleExportJSON} 
            disabled={selectedTokens.length === 0}
            className="w-full bg-slate-900 disabled:bg-slate-200 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-black transition-all uppercase text-[10px] tracking-widest flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 0 002-2v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Download Backup ({selectedTokens.length})
          </button>
          
          <div className="relative py-4">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
            <div className="relative flex justify-center"><span className="bg-white px-2 text-[8px] font-black text-slate-300 uppercase tracking-widest">Atau Unggah Data</span></div>
          </div>

          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".json" 
            onChange={handleFileChange} 
          />
          
          <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white text-blue-600 font-bold py-4 rounded-2xl border-2 border-blue-100 hover:bg-blue-50 transition-all uppercase text-[10px] tracking-widest">Upload File .JSON</button>
        </div>
      </div>
      
      {/* TIPS & RESET */}
      <div className="p-5 bg-blue-50 border border-blue-100 rounded-3xl">
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Tips Admin</p>
        <p className="text-[11px] text-blue-800 leading-relaxed font-medium">Jangan lupa menekan tombol <b>Sinkronisasi Cloud</b> setelah melakukan Reset atau Import data agar perubahan aktif di sisi siswa.</p>
        <button onClick={() => { if(confirm('Kosongkan semua soal di perangkat?')) onReset(); }} className="mt-4 w-full text-red-500 text-[9px] font-black uppercase tracking-[0.2em] border border-red-100 py-2 rounded-xl hover:bg-red-50">Reset Lokal</button>
      </div>
    </div>
  );
};

export default AdminSettings;
