
import React, { useState, useRef, useMemo } from 'react';
import { AppSettings, Question, ExternalLinks } from '../types';
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
  const [newAdminPass, setNewAdminPass] = useState(settings.adminPassword || '');
  
  // External Links States - Ensuring all fields are covered
  const [links, setLinks] = useState<ExternalLinks>(settings.externalLinks || {
    passwordHelp: '',
    aiGenerator: '',
    adminEmailDisplay: ''
  });

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

  const handleSaveAllSettings = () => {
    onUpdateSettings({
      ...settings,
      timerMinutes: parseInt(timer) || 60,
      adminPassword: newAdminPass,
      externalLinks: links
    });
    alert('SELURUH PENGATURAN BERHASIL DISIMPAN!\n\nKlik tombol "KIRIM KE CLOUD" di sidebar untuk menyinkronkan ke server.');
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
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* HEADER SECTION */}
      <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100 mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tight">Admin Pusat — Konfigurasi Sistem</h2>
        <p className="text-emerald-100 text-xs font-medium mt-2">Kelola durasi ujian, keamanan password, dan link bantuan eksternal di sini.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PENGATURAN KEAMANAN & DURASI */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M2.166 4.9L10 .303 17.834 4.9a1 1 0 01.5 1.075l-1.334 8a1 1 0 01-.504.743l-6 3.5a1 1 0 01-.992 0l-6-3.5a1 1 0 01-.504-.743l-1.334-8a1 1 0 01.5-1.075zm2.131 2.22l.774 4.648L10 14.12l4.929-2.353.774-4.648L10 9.303 4.297 7.12z" clipRule="evenodd" /></svg>
              Keamanan & Akun Utama
            </h2>
            
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-2xl border border-red-100 mb-4">
                <p className="text-[9px] font-black text-red-600 uppercase tracking-widest mb-1">Peringatan Keamanan</p>
                <p className="text-[10px] text-red-500 font-medium leading-relaxed italic">Password ini adalah kunci masuk Dashboard Admin. Jangan bagikan kepada siapapun.</p>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Password Baru Administrator</label>
                <input 
                  type="text" 
                  value={newAdminPass} 
                  onChange={(e) => setNewAdminPass(e.target.value)} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:border-blue-600 transition-all text-xs" 
                  placeholder="Ganti Password Login..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Durasi Default (Menit)</label>
                <input 
                  type="number" 
                  value={timer} 
                  onChange={(e) => setTimer(e.target.value)} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:border-blue-600 transition-all text-xs" 
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
              Utilitas Data Lokal
            </h2>
            <div className="space-y-4">
              <div className="max-h-32 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 custom-scrollbar">
                {availableTokens.map(token => (
                  <label key={token} className="flex items-center gap-3 p-2 hover:bg-white rounded-xl cursor-pointer">
                    <input type="checkbox" checked={selectedTokens.includes(token)} onChange={() => toggleToken(token)} className="w-4 h-4 accent-blue-600" />
                    <span className="text-[10px] font-black text-slate-500 uppercase">{token}</span>
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={handleExportJSON} disabled={selectedTokens.length === 0} className="w-full bg-slate-900 disabled:opacity-20 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">Export JSON (Backup)</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl border border-blue-100 text-[10px] uppercase tracking-widest transition-all">Upload JSON (Restore)</button>
                <button onClick={handleResetData} className="w-full text-red-500 font-bold py-2 text-[9px] uppercase tracking-widest hover:bg-red-50 rounded-lg">Kosongkan Bank Soal Lokal</button>
              </div>
            </div>
          </div>
        </div>

        {/* KONFIGURASI LINK EKSTERNAL — DIPERLENGKAP */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-black text-slate-800 mb-6 flex items-center gap-2 uppercase tracking-widest">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" /></svg>
              Integrasi & Link Eksternal
            </h2>
            <div className="space-y-5">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest mb-1 leading-none">Konfigurasi Tautan Sistem</p>
                <p className="text-[10px] text-purple-400 font-medium leading-tight">Pengaturan link bantuan password, asisten AI, dan informasi kontak admin.</p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">1. Link Bantuan Lupa Password Admin</label>
                  <input 
                    type="text" 
                    value={links.passwordHelp} 
                    onChange={(e) => setLinks({...links, passwordHelp: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-purple-600 transition-all text-xs" 
                    placeholder="URL (lynk.id / website)"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">2. Link Generator Soal AI Lab</label>
                  <input 
                    type="text" 
                    value={links.aiGenerator} 
                    onChange={(e) => setLinks({...links, aiGenerator: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-purple-600 transition-all text-xs" 
                    placeholder="URL AI Studio App"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">3. Label Email Admin (Halaman Depan)</label>
                  <input 
                    type="text" 
                    value={links.adminEmailDisplay} 
                    onChange={(e) => setLinks({...links, adminEmailDisplay: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-purple-600 transition-all text-xs" 
                    placeholder="Contoh: admin@sekolah.sch.id"
                  />
                </div>
              </div>
              
              <div className="pt-2 border-t border-slate-100">
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center italic">Jika di masa depan ada penambahan link eksternal baru, akan otomatis muncul di panel ini.</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
             <h2 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-widest">Evaluasi Akhir</h2>
             <button 
              onClick={handleDownloadRecap} 
              disabled={selectedTokens.length === 0 || isDownloading} 
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all"
            >
              {isDownloading ? 'MEMPROSES...' : 'Download Rekap Nilai (Format Excel)'}
            </button>
            <p className="text-[9px] text-slate-400 font-bold mt-4 italic text-center uppercase tracking-widest leading-relaxed">
              Data ditarik secara real-time dari Server Cloud Supabase berdasarkan token yang Anda pilih di atas.
            </p>
          </div>
        </div>
      </div>

      {/* FOOTER SAVE BUTTON */}
      <div className="mt-10 p-4 sticky bottom-4 z-10">
        <button 
          onClick={handleSaveAllSettings} 
          className="w-full max-w-md mx-auto block bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-blue-300 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs"
        >
          Simpan Seluruh Konfigurasi & Link
        </button>
      </div>

      {/* MODAL PASTE JSON */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Paste Bank Soal</h3>
              </div>
              <button onClick={() => setIsPasteModalOpen(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-black">×</button>
            </div>
            <div className="p-8 flex-1 overflow-y-auto">
              <textarea 
                className="w-full h-80 p-6 bg-slate-50 border-2 border-slate-100 rounded-3xl font-mono text-xs outline-none focus:border-blue-500 transition-all"
                placeholder='Tempel kumpulan soal di sini...'
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
              />
            </div>
            <div className="p-8 border-t bg-slate-50 flex gap-4">
              <button onClick={() => setIsPasteModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px]">Tutup</button>
              <button onClick={handlePasteImport} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-[10px]">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
