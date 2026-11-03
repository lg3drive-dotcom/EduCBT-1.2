import React, { useState, useRef, useMemo } from 'react';
import { AppSettings, Question, ExternalLinks } from '../types';
import { fetchSubmissionsByToken, deleteQuestionsByTokenFromCloud, updateQuestionTokenInCloud } from '../services/supabaseService';
import { exportSubmissionsToExcel, downloadImportTemplate, importQuestionsFromExcel } from '../services/excelService';

interface AdminSettingsProps {
  settings: AppSettings;
  questions: Question[];
  onUpdateSettings: (newSettings: AppSettings) => void;
  onImportQuestions: (newQuestions: Question[], mode: 'replace' | 'append') => void;
  onReset: () => void;
  onDeleteQuestionsByTokens?: (tokens: string[]) => void;
  onRenameToken?: (oldToken: string, newToken: string) => void;
}

interface ToastNotification {
  type: 'success' | 'error' | 'info';
  title?: string;
  message: string;
}

const AdminSettings: React.FC<AdminSettingsProps> = ({ 
  settings, 
  questions, 
  onUpdateSettings, 
  onImportQuestions, 
  onReset,
  onDeleteQuestionsByTokens,
  onRenameToken
}) => {
  const [timer, setTimer] = useState(settings.timerMinutes.toString());
  const [newAdminPass, setNewAdminPass] = useState(settings.adminPassword || '');
  
  // External Links States
  const [links, setLinks] = useState<ExternalLinks>(settings.externalLinks || {
    passwordHelp: '',
    aiGenerator: '',
    aiAnalysis: '',
    adminEmailDisplay: ''
  });

  const [selectedTokens, setSelectedTokens] = useState<string[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [manualDeleteToken, setManualDeleteToken] = useState('');

  // Rename Token States
  const [renameOldToken, setRenameOldToken] = useState('');
  const [renameCustomOldToken, setRenameCustomOldToken] = useState('');
  const [renameNewToken, setRenameNewToken] = useState('');
  const [isSyncRenameToCloud, setIsSyncRenameToCloud] = useState(true);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [isRenamingCloud, setIsRenamingCloud] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSuccessData, setRenameSuccessData] = useState<{
    oldToken: string;
    newToken: string;
    localCount: number;
    cloudCount: number | null;
    submissionsCount?: number | null;
  } | null>(null);
  
  // Modals & In-App UI States (No window.alert/prompt/confirm)
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  
  // Reset confirmation modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Cloud & Local Deletion Modal states
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');
  const [isDeletingCloud, setIsDeletingCloud] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccessData, setDeleteSuccessData] = useState<{
    count: number | null;
    localCount: number;
    tokens: string[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (type: 'success' | 'error' | 'info', message: string, title?: string) => {
    setToast({ type, message, title });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4500);
  };

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
    showToast('success', 'Konfigurasi disimpan di perangkat. Klik tombol "KIRIM KE CLOUD" di panel navigasi jika ingin menyinkronkan ke server.', 'Pengaturan Berhasil Disimpan');
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
      showToast('error', 'Pilih minimal satu paket (token) melalui checklist di atas untuk membuat backup JSON.', 'Pilih Token');
      return;
    }
    const filteredQs = questions.filter(q => 
      !q.isDeleted && q.quizToken && selectedTokens.includes(q.quizToken.toUpperCase())
    );
    if (filteredQs.length === 0) {
      showToast('error', 'Tidak ada butir soal ditemukan pada token yang dipilih.', 'Data Kosong');
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
    showToast('success', `File backup JSON untuk ${filteredQs.length} butir soal berhasil diunduh.`, 'Export Berhasil');
  };

  const handleDownloadRecap = async () => {
    if (selectedTokens.length === 0) {
      showToast('error', 'Pilih minimal satu paket (token) di atas untuk mengunduh rekap nilai siswa.', 'Pilih Token');
      return;
    }

    setIsDownloading(true);
    try {
      let totalDownloaded = 0;
      for (const token of selectedTokens) {
        const data = await fetchSubmissionsByToken(token);
        if (data && data.length > 0) {
          exportSubmissionsToExcel(data, `Rekap_Nilai_${token}_${new Date().toISOString().split('T')[0]}`, questions);
          totalDownloaded += data.length;
        }
      }
      if (totalDownloaded > 0) {
        showToast('success', `Berhasil mengunduh rekap nilai (${totalDownloaded} catatan siswa).`, 'Download Selesai');
      } else {
        showToast('info', 'Belum ada data nilai ujian siswa yang tersimpan di server untuk token ini.', 'Tidak Ada Data Nilai');
      }
    } catch (err: any) {
      showToast('error', `Gagal mengambil data dari server: ${err.message}`, 'Gagal Mengunduh');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const imported = await importQuestionsFromExcel(file);
        onImportQuestions(imported, 'append');
        showToast('success', `${imported.length} soal baru telah berhasil diimpor dari file Excel.`, 'Import Excel Berhasil');
        if (fileInputRef.current) fileInputRef.current.value = '';
      } catch (err: any) {
        showToast('error', 'Gagal membaca file Excel. Pastikan format kolom sesuai dengan template standar.', 'Format Excel Salah');
      }
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const imported = JSON.parse(event.target?.result as string);
          if (!Array.isArray(imported)) {
            showToast('error', 'Format file JSON tidak valid. Harus berupa array butir soal.', 'Gagal Import');
            return;
          }
          onImportQuestions(imported, 'append');
          showToast('success', `${imported.length} soal baru telah berhasil diimpor dari file JSON.`, 'Import JSON Berhasil');
          if (fileInputRef.current) fileInputRef.current.value = '';
        } catch(err: any) { 
          showToast('error', 'Gagal membaca file JSON. Pastikan isi file valid.', 'Gagal Import'); 
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePasteImport = () => {
    if (!pasteContent.trim()) {
      showToast('error', 'Silakan tempel teks JSON terlebih dahulu.', 'Teks Kosong');
      return;
    }

    try {
      const imported = JSON.parse(pasteContent);
      if (!Array.isArray(imported)) {
        showToast('error', 'Data JSON harus berupa array kumpulan soal.', 'Format Salah');
        return;
      }
      onImportQuestions(imported, 'append');
      showToast('success', `${imported.length} soal baru telah berhasil diimpor.`, 'Import Berhasil');
      setPasteContent('');
      setIsPasteModalOpen(false);
    } catch (e) {
      showToast('error', 'Format JSON tidak valid. Pastikan Anda menyalin seluruh teks dengan lengkap.', 'Format Salah');
    }
  };

  const effectiveOldToken = renameOldToken === '__MANUAL__'
    ? renameCustomOldToken.trim().toUpperCase()
    : renameOldToken.trim().toUpperCase();

  const handleOpenRenameModal = () => {
    const oldT = effectiveOldToken;
    const newT = renameNewToken.trim().toUpperCase();

    if (!oldT) {
      showToast('error', 'Pilih atau masukkan token lama yang ingin diubah.', 'Token Lama Belum Dipilih');
      return;
    }
    if (!newT) {
      showToast('error', 'Ketik kode token baru yang diinginkan.', 'Token Baru Kosong');
      return;
    }
    if (oldT === newT) {
      showToast('error', 'Token baru harus berbeda dengan token lama.', 'Token Sama');
      return;
    }

    setRenameError(null);
    setRenameSuccessData(null);
    setIsRenameModalOpen(true);
  };

  const executeRenameToken = async () => {
    const oldT = effectiveOldToken;
    const newT = renameNewToken.trim().toUpperCase();
    if (!oldT || !newT || oldT === newT) return;

    setIsRenamingCloud(true);
    setRenameError(null);

    const localMatchCount = questions.filter(
      q => q.quizToken && q.quizToken.trim().toUpperCase() === oldT
    ).length;

    let cloudUpdatedCount: number | null = null;
    let submissionsUpdatedCount: number | null = null;

    try {
      if (isSyncRenameToCloud) {
        const res = await updateQuestionTokenInCloud(oldT, newT, true);
        if (!res.success) {
          throw new Error(res.error || 'Gagal mengubah token soal di Supabase Cloud.');
        }
        cloudUpdatedCount = res.count ?? 0;
        submissionsUpdatedCount = res.submissionsCount ?? 0;
      }

      // Update di memori perangkat lokal
      if (onRenameToken) {
        onRenameToken(oldT, newT);
      }

      setRenameSuccessData({
        oldToken: oldT,
        newToken: newT,
        localCount: localMatchCount,
        cloudCount: cloudUpdatedCount,
        submissionsCount: submissionsUpdatedCount
      });

      showToast(
        'success',
        `Token "${oldT}" berhasil diubah menjadi "${newT}"${cloudUpdatedCount !== null ? ` (${cloudUpdatedCount} butir di server)` : ''}.`,
        'Token Berhasil Diubah'
      );

      // Reset form
      setRenameNewToken('');
      if (renameOldToken === '__MANUAL__') {
        setRenameCustomOldToken('');
      } else {
        setRenameOldToken(newT);
      }
    } catch (err: any) {
      console.error("Rename token error:", err);
      setRenameError(err.message || 'Terjadi kesalahan saat mengubah token di server.');
      showToast('error', err.message || 'Gagal mengubah token.', 'Gagal Mengubah Token');
    } finally {
      setIsRenamingCloud(false);
    }
  };

  const handleOpenDeleteModal = () => {
    const tokensToDelete = [...selectedTokens];
    if (manualDeleteToken.trim()) {
      const cleanManual = manualDeleteToken.trim().toUpperCase();
      if (!tokensToDelete.includes(cleanManual)) {
        tokensToDelete.push(cleanManual);
      }
    }

    if (tokensToDelete.length === 0) {
      showToast('error', 'Pilih token dari checklist di atas atau ketik token manual pada kolom yang tersedia.', 'Pilih Token Dulu');
      return;
    }

    setDeleteConfirmInput('');
    setDeleteError(null);
    setDeleteSuccessData(null);
    setIsDeleteModalOpen(true);
  };

  const executeDeleteQuestions = async () => {
    const tokensToDelete = [...selectedTokens];
    if (manualDeleteToken.trim()) {
      const cleanManual = manualDeleteToken.trim().toUpperCase();
      if (!tokensToDelete.includes(cleanManual)) {
        tokensToDelete.push(cleanManual);
      }
    }

    if (tokensToDelete.length === 0) return;
    if (deleteConfirmInput.trim() !== 'HAPUS') return;

    setIsDeletingCloud(true);
    setDeleteError(null);

    const localMatchCount = questions.filter(
      q => q.quizToken && tokensToDelete.includes(q.quizToken.trim().toUpperCase())
    ).length;

    try {
      const res = await deleteQuestionsByTokenFromCloud(tokensToDelete);
      if (!res.success) {
        throw new Error(res.error || 'Terjadi kesalahan saat menghapus di database Supabase.');
      }

      // Update local state via callback
      if (onDeleteQuestionsByTokens) {
        onDeleteQuestionsByTokens(tokensToDelete);
      }

      // Uncheck deleted tokens
      setSelectedTokens(prev => prev.filter(t => !tokensToDelete.includes(t)));
      setManualDeleteToken('');

      // Show in-modal success message
      setDeleteSuccessData({
        count: res.count ?? 0,
        localCount: localMatchCount,
        tokens: tokensToDelete
      });
    } catch (err: any) {
      console.error("Delete failed:", err);
      setDeleteError(err.message || 'Gagal menghapus soal dari Supabase Cloud.');
    } finally {
      setIsDeletingCloud(false);
    }
  };

  const targetTokensList = useMemo(() => {
    const list = [...selectedTokens];
    if (manualDeleteToken.trim()) {
      const cleanManual = manualDeleteToken.trim().toUpperCase();
      if (!list.includes(cleanManual)) list.push(cleanManual);
    }
    return list;
  }, [selectedTokens, manualDeleteToken]);

  const targetLocalMatchCount = useMemo(() => {
    return questions.filter(
      q => q.quizToken && targetTokensList.includes(q.quizToken.trim().toUpperCase())
    ).length;
  }, [questions, targetTokensList]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 relative">
      {/* IN-APP TOAST NOTIFICATION BANNER */}
      {toast && (
        <div className="fixed top-5 right-5 z-[300] max-w-md w-full animate-bounce-short">
          <div className={`p-4 rounded-2xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
            toast.type === 'success' 
              ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50 shadow-emerald-900/40' 
              : toast.type === 'error'
              ? 'bg-red-950/90 text-red-100 border-red-500/50 shadow-red-900/40'
              : 'bg-slate-900/90 text-slate-100 border-slate-700 shadow-slate-900/40'
          }`}>
            <div className="shrink-0 mt-0.5">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              ) : toast.type === 'error' ? (
                <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div className="flex-1 text-xs">
              {toast.title && <p className="font-black uppercase tracking-wider mb-0.5">{toast.title}</p>}
              <p className="font-medium opacity-90 leading-relaxed">{toast.message}</p>
            </div>
            <button 
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white font-black text-sm p-1 ml-1"
            >×</button>
          </div>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="bg-emerald-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-emerald-100 mb-8">
        <h2 className="text-2xl font-black uppercase tracking-tight">Admin Pusat — Konfigurasi Sistem</h2>
        <p className="text-emerald-100 text-xs font-medium mt-2">Kelola durasi ujian, keamanan password, pembersihan paket soal Cloud/Lokal, dan link bantuan di sini.</p>
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-sm font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" /></svg>
                Utilitas Data Lokal
              </h2>
              {availableTokens.length > 0 && (
                <button
                  type="button"
                  onClick={selectAllTokens}
                  className="text-[9px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider"
                >
                  {selectedTokens.length === availableTokens.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div className="max-h-36 overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50 custom-scrollbar">
                {availableTokens.length === 0 ? (
                  <p className="text-[10px] text-slate-400 p-3 italic text-center">Belum ada token soal yang dimuat di lokal.</p>
                ) : (
                  availableTokens.map(token => {
                    const qCount = questions.filter(q => !q.isDeleted && q.quizToken?.toUpperCase() === token).length;
                    return (
                      <label key={token} className="flex items-center justify-between p-2 hover:bg-white rounded-xl cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedTokens.includes(token)} onChange={() => toggleToken(token)} className="w-4 h-4 accent-blue-600" />
                          <span className="text-[10px] font-black text-slate-700 uppercase">{token}</span>
                        </div>
                        <span className="text-[9px] font-bold text-slate-400">{qCount} soal</span>
                      </label>
                    );
                  })
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={handleExportJSON} disabled={selectedTokens.length === 0} className="w-full bg-slate-900 disabled:opacity-20 text-white font-black py-3 rounded-xl text-[10px] uppercase tracking-widest transition-all">Export JSON (Backup)</button>
                <input type="file" ref={fileInputRef} className="hidden" accept=".json,.xlsx,.xls" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} className="w-full bg-blue-50 text-blue-600 font-bold py-3 rounded-xl border border-blue-100 text-[10px] uppercase tracking-widest transition-all">Upload JSON/Excel (Restore)</button>
                <button onClick={() => setIsPasteModalOpen(true)} className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-xl border border-slate-200 text-[10px] uppercase tracking-widest transition-all">Paste JSON (Manual)</button>
                <button 
                  onClick={downloadImportTemplate} 
                  className="w-full bg-emerald-50 text-emerald-700 font-black py-3 rounded-xl border border-emerald-200 shadow-sm text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  Download Format Excel (Template)
                </button>
                <button 
                  onClick={() => setIsResetModalOpen(true)} 
                  className="w-full text-slate-400 font-bold py-2 text-[9px] uppercase tracking-widest hover:bg-slate-100 hover:text-red-500 rounded-lg transition-colors"
                >
                  Kosongkan Bank Soal Lokal
                </button>
              </div>
            </div>
          </div>

          {/* FITUR UBAH TOKEN SOAL (SUPABASE CLOUD & LOKAL) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-indigo-200/90">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-indigo-700 flex items-center gap-2 uppercase tracking-widest">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Ubah Token Soal
              </h2>
              <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                Cloud & Lokal
              </span>
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-4">
              Ganti nama token paket soal lama ke kode token baru. Perubahan ini dapat langsung disinkronkan ke <strong className="text-indigo-600 font-bold">Database Supabase Cloud</strong> sehingga siswa langsung bisa mengakses ujian dengan token baru.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Pilih Token Lama yang Ingin Diubah</label>
                <select 
                  value={renameOldToken} 
                  onChange={(e) => setRenameOldToken(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:border-indigo-600 text-xs uppercase transition-all"
                >
                  <option value="">-- Pilih Token Dari Bank Soal --</option>
                  {availableTokens.map(token => {
                    const count = questions.filter(q => !q.isDeleted && q.quizToken?.toUpperCase() === token).length;
                    return (
                      <option key={token} value={token}>
                        {token} ({count} butir soal)
                      </option>
                    );
                  })}
                  <option value="__MANUAL__">+ Ketik Token Manual (Khusus Server Cloud)</option>
                </select>
              </div>

              {renameOldToken === '__MANUAL__' && (
                <div className="animate-in fade-in duration-200">
                  <label className="block text-[10px] font-black text-indigo-600 uppercase mb-1 ml-1">Ketik Token Lama Manual</label>
                  <input 
                    type="text" 
                    value={renameCustomOldToken} 
                    onChange={(e) => setRenameCustomOldToken(e.target.value.toUpperCase())}
                    placeholder="Contoh: PAS-IPA-2025"
                    className="w-full px-4 py-3 bg-indigo-50/50 border-2 border-indigo-200 rounded-xl font-black outline-none focus:border-indigo-600 uppercase tracking-widest text-xs"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Token Baru yang Diinginkan</label>
                <input 
                  type="text" 
                  value={renameNewToken} 
                  onChange={(e) => setRenameNewToken(e.target.value.toUpperCase())}
                  placeholder="Contoh: PAS-IPA2026"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:border-indigo-600 uppercase tracking-widest text-xs"
                />
              </div>

              {/* Opsi Sinkronisasi Supabase */}
              <label className="flex items-start gap-3 p-3.5 bg-indigo-50/80 rounded-2xl border border-indigo-100 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={isSyncRenameToCloud} 
                  onChange={(e) => setIsSyncRenameToCloud(e.target.checked)} 
                  className="w-5 h-5 accent-indigo-600 mt-0.5 rounded cursor-pointer"
                />
                <div>
                  <span className="text-[11px] font-black text-indigo-950 block">Sinkronkan Langsung ke Supabase Cloud</span>
                  <span className="text-[10px] text-indigo-700 font-medium leading-relaxed block mt-0.5">
                    Memperbarui tabel <strong>questions</strong> & riwayat jawaban <strong>submissions</strong> di database Supabase Cloud.
                  </span>
                </div>
              </label>

              <button
                type="button"
                onClick={handleOpenRenameModal}
                disabled={!effectiveOldToken || !renameNewToken.trim() || effectiveOldToken === renameNewToken.trim().toUpperCase()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                GANTI KODE TOKEN SOAL
              </button>
            </div>
          </div>

          {/* FITUR HAPUS SOAL PER TOKEN (SUPABASE CLOUD & LOKAL) */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border-2 border-red-200/80">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-red-600 flex items-center gap-2 uppercase tracking-widest">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Hapus Soal per Token
              </h2>
              <span className="text-[9px] bg-red-100 text-red-700 font-black px-2.5 py-1 rounded-full uppercase tracking-wider">
                Cloud & Lokal
              </span>
            </div>

            <p className="text-[10px] text-slate-500 font-medium leading-relaxed mb-4">
              Fitur ini akan menghapus seluruh butir soal dengan token yang dipilih secara permanen dari <strong className="text-red-600 font-bold">Database Supabase Cloud</strong> dan dari memori bank soal lokal.
            </p>

            <div className="space-y-4">
              {selectedTokens.length > 0 ? (
                <div className="p-3 bg-red-50 border border-red-100 rounded-2xl">
                  <p className="text-[9px] font-black text-red-500 uppercase tracking-widest mb-1.5">
                    Token Terpilih ({selectedTokens.length}):
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTokens.map(t => (
                      <span key={t} className="inline-flex items-center gap-1.5 bg-red-600 text-white font-black text-[10px] px-2.5 py-1 rounded-xl">
                        {t}
                        <button 
                          type="button" 
                          onClick={() => toggleToken(t)} 
                          className="hover:text-red-200 font-black ml-0.5"
                          title="Hapus dari pilihan"
                        >×</button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-[10px] text-slate-400 font-medium italic">
                    Centang token pada daftar di atas, atau masukkan token manual di bawah.
                  </p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">Ketik Token Manual (Opsional)</label>
                <input 
                  type="text" 
                  value={manualDeleteToken} 
                  onChange={(e) => setManualDeleteToken(e.target.value.toUpperCase())}
                  placeholder="Contoh: PAS-MTK26"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black outline-none focus:border-red-500 uppercase tracking-widest text-xs"
                />
                <p className="text-[9px] text-slate-400 font-medium mt-1 ml-1 italic">
                  Gunakan input ini jika soal sudah terhapus di perangkat lokal namun masih tersisa di Supabase Cloud.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenDeleteModal}
                disabled={selectedTokens.length === 0 && !manualDeleteToken.trim()}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-red-200 flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                HAPUS SOAL DARI SUPABASE & LOKAL
              </button>
            </div>
          </div>
        </div>

        {/* KONFIGURASI LINK EKSTERNAL */}
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
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">3. Link Analisis Cerdas AI</label>
                  <input 
                    type="text" 
                    value={links.aiAnalysis} 
                    onChange={(e) => setLinks({...links, aiAnalysis: e.target.value})} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-medium outline-none focus:border-purple-600 transition-all text-xs" 
                    placeholder="URL Dashboard Analisis AI"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 ml-1">4. Label Email Admin (Halaman Depan)</label>
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
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white font-black py-4 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  MEMPROSES UNDUHAN...
                </>
              ) : 'Download Rekap Nilai (Format Excel)'}
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
          className="w-full max-w-md mx-auto block bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-blue-300 transition-all active:scale-95 uppercase tracking-[0.2em] text-xs cursor-pointer"
        >
          Simpan Seluruh Konfigurasi & Link
        </button>
      </div>

      {/* IN-APP MODAL: KONFIRMASI UBAH TOKEN SOAL CLOUD & LOKAL */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-indigo-200 flex flex-col max-h-[95vh] animate-scale-up">
            {/* Header */}
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Konfirmasi Ganti Token Soal</h3>
                  <p className="text-[11px] text-indigo-100 font-medium">Perbarui kode token di bank soal & database</p>
                </div>
              </div>
              {!isRenamingCloud && (
                <button 
                  onClick={() => setIsRenameModalOpen(false)} 
                  className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-black text-white transition-colors cursor-pointer"
                >×</button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-5">
              {renameSuccessData ? (
                /* SUCCESS STATE */
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-50">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Token Berhasil Diubah!</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">Paket soal kini menggunakan kode token baru.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Token Sebelumnya:</span>
                      <span className="font-black text-slate-500 bg-slate-200 px-2 py-0.5 rounded-lg line-through">{renameSuccessData.oldToken}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Token Baru (Aktif):</span>
                      <span className="font-black text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-lg">{renameSuccessData.newToken}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Bank Soal Lokal:</span>
                      <span className="font-black text-emerald-600">{renameSuccessData.localCount} butir soal diperbarui</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Database Supabase Cloud:</span>
                      <span className="font-black text-emerald-600">
                        {renameSuccessData.cloudCount !== null ? `${renameSuccessData.cloudCount} butir soal di server` : 'Tidak disinkronkan ke server'}
                      </span>
                    </div>
                    {typeof renameSuccessData.submissionsCount === 'number' && renameSuccessData.submissionsCount > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-600">Riwayat Nilai Siswa:</span>
                        <span className="font-black text-emerald-600">{renameSuccessData.submissionsCount} catatan siswa diperbarui</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setIsRenameModalOpen(false);
                      setRenameSuccessData(null);
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-all cursor-pointer"
                  >
                    Tutup & Selesai
                  </button>
                </div>
              ) : (
                /* CONFIRMATION FORM */
                <>
                  <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-2xl gap-2">
                    <div className="text-center flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Token Lama</p>
                      <p className="text-sm sm:text-base font-black text-slate-800 uppercase truncate mt-0.5">{effectiveOldToken}</p>
                    </div>
                    <div className="text-indigo-600 px-2 shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </div>
                    <div className="text-center flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Token Baru</p>
                      <p className="text-sm sm:text-base font-black text-indigo-700 uppercase truncate mt-0.5">{renameNewToken.trim().toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600">
                    <p className="font-bold text-slate-800">Dampak perubahan token:</p>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-[11px]">
                      <div className="flex items-start gap-2">
                        <span className="text-indigo-600 font-bold shrink-0">1.</span>
                        <p>
                          <strong className="text-slate-800">Bank Soal Lokal:</strong> Seluruh soal dengan token lama ({questions.filter(q => q.quizToken?.toUpperCase() === effectiveOldToken).length} soal) akan diubah menjadi <strong className="text-indigo-600 font-bold">{renameNewToken.trim().toUpperCase()}</strong>.
                        </p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-indigo-600 font-bold shrink-0">2.</span>
                        <p>
                          <strong className="text-slate-800">Supabase Cloud:</strong> {isSyncRenameToCloud ? (
                            <>Tabel <strong>questions</strong> di server akan langsung diperbarui sehingga siswa yang login dengan token baru dapat langsung mengakses paket soal ini.</>
                          ) : (
                            <span className="text-amber-600 font-bold">Sinkronisasi Cloud dimatikan. Data hanya diubah di perangkat ini.</span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {renameError && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-2xl text-xs text-red-800 space-y-1">
                      <p className="font-black uppercase tracking-wider">Gagal Mengubah Token:</p>
                      <p className="font-medium">{renameError}</p>
                    </div>
                  )}

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={isRenamingCloud}
                      onClick={() => setIsRenameModalOpen(false)}
                      className="flex-1 py-4 font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={isRenamingCloud}
                      onClick={executeRenameToken}
                      className="flex-[2] bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isRenamingCloud ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          MEMPERBARUI DI SUPABASE...
                        </>
                      ) : (
                        'YA, UBAH TOKEN SEKARANG'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: KONFIRMASI HAPUS SOAL CLOUD & LOKAL (NO NATIVE PROMPT/CONFIRM) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-xl overflow-hidden shadow-2xl border border-red-200 flex flex-col max-h-[95vh] animate-scale-up">
            {/* Header */}
            <div className="p-6 bg-red-600 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Konfirmasi Hapus Soal Permanen</h3>
                  <p className="text-[11px] text-red-100 font-medium">Tindakan ini tidak dapat dibatalkan</p>
                </div>
              </div>
              {!isDeletingCloud && (
                <button 
                  onClick={() => setIsDeleteModalOpen(false)} 
                  className="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center font-black text-white transition-colors cursor-pointer"
                >×</button>
              )}
            </div>

            {/* Modal Body */}
            <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-5">
              {deleteSuccessData ? (
                /* SUCCESS STATE */
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl mx-auto flex items-center justify-center shadow-lg shadow-emerald-50">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-slate-800 uppercase tracking-tight">Penghapusan Berhasil!</h4>
                    <p className="text-xs text-slate-500 font-medium mt-1">Soal untuk paket token terpilih telah berhasil dibersihkan.</p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Token Dihapus:</span>
                      <span className="font-black text-slate-900 bg-slate-200 px-2 py-0.5 rounded-lg">{deleteSuccessData.tokens.join(', ')}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Database Supabase Cloud:</span>
                      <span className="font-black text-emerald-600">{deleteSuccessData.count !== null ? `${deleteSuccessData.count} butir soal` : 'Data server dibersihkan'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-600">Bank Soal Lokal:</span>
                      <span className="font-black text-emerald-600">{deleteSuccessData.localCount} butir soal dihapus</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsDeleteModalOpen(false);
                      setDeleteSuccessData(null);
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-all cursor-pointer"
                  >
                    Tutup & Selesai
                  </button>
                </div>
              ) : (
                /* CONFIRMATION FORM */
                <>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                    <p className="text-[10px] font-black text-red-700 uppercase tracking-widest mb-1.5">
                      Token yang akan dihapus:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {targetTokensList.map(t => (
                        <span key={t} className="px-3 py-1 bg-red-600 text-white font-black text-xs rounded-xl shadow-sm">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 text-xs text-slate-600">
                    <p className="font-bold text-slate-800">Cakupan penghapusan saat Anda melanjutkan:</p>
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-[11px]">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 font-bold shrink-0">1.</span>
                        <p><strong className="text-slate-800">Cloud Supabase:</strong> Seluruh baris soal dengan token di atas akan dihapus langsung dari database server.</p>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 font-bold shrink-0">2.</span>
                        <p><strong className="text-slate-800">Bank Soal Lokal:</strong> <span className="font-black text-red-600">{targetLocalMatchCount} butir soal</span> yang tersimpan di perangkat ini akan dibersihkan.</p>
                      </div>
                    </div>
                  </div>

                  {deleteError && (
                    <div className="p-4 bg-red-100 border border-red-300 rounded-2xl text-xs text-red-800 space-y-1">
                      <p className="font-black uppercase tracking-wider">Gagal Menghapus:</p>
                      <p className="font-medium">{deleteError}</p>
                    </div>
                  )}

                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="block text-[11px] font-black text-slate-700">
                      Ketik kata <span className="text-red-600 font-black">HAPUS</span> (huruf besar) untuk membuka kunci konfirmasi:
                    </label>
                    <input 
                      type="text" 
                      value={deleteConfirmInput} 
                      onChange={(e) => setDeleteConfirmInput(e.target.value.toUpperCase())}
                      placeholder="Ketik HAPUS"
                      disabled={isDeletingCloud}
                      className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-300 focus:border-red-600 rounded-xl font-black text-sm uppercase tracking-widest outline-none transition-all"
                    />
                  </div>

                  <div className="pt-3 flex gap-3">
                    <button
                      type="button"
                      disabled={isDeletingCloud}
                      onClick={() => setIsDeleteModalOpen(false)}
                      className="flex-1 py-4 font-black text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl uppercase tracking-widest text-[10px] transition-all cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={deleteConfirmInput !== 'HAPUS' || isDeletingCloud}
                      onClick={executeDeleteQuestions}
                      className="flex-[2] bg-red-600 hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl text-[10px] uppercase tracking-widest shadow-xl shadow-red-200 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                      {isDeletingCloud ? (
                        <>
                          <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                          </svg>
                          MENGHAPUS DI SUPABASE & LOKAL...
                        </>
                      ) : (
                        'YA, HAPUS PERMANEN SEKARANG'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* IN-APP MODAL: KONFIRMASI RESET DATA LOKAL (NO NATIVE CONFIRM) */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[250] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl p-6 sm:p-8 space-y-5 animate-scale-up border border-slate-200">
            <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Kosongkan Bank Soal Lokal?</h3>
              <p className="text-xs text-slate-500 font-medium mt-2 leading-relaxed">
                Seluruh data soal di memori perangkat ini akan dikosongkan. Tindakan ini <strong className="text-slate-800">tidak</strong> menghapus data di Supabase Cloud.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="flex-1 py-3.5 font-black text-slate-500 hover:bg-slate-100 rounded-xl uppercase tracking-widest text-[10px] transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onReset();
                  setIsResetModalOpen(false);
                  showToast('info', 'Bank soal lokal telah dikosongkan.', 'Reset Berhasil');
                }}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black py-3.5 rounded-xl uppercase tracking-widest text-[10px] shadow-lg shadow-amber-200 transition-all cursor-pointer"
              >
                Ya, Kosongkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PASTE JSON */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Paste Bank Soal</h3>
              </div>
              <button onClick={() => setIsPasteModalOpen(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center font-black cursor-pointer">×</button>
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
              <button onClick={() => setIsPasteModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase tracking-widest text-[10px] cursor-pointer">Tutup</button>
              <button onClick={handlePasteImport} className="flex-[2] bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase tracking-widest text-[10px] cursor-pointer">Import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
