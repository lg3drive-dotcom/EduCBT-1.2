
import React from 'react';
import { StudentIdentity, AppSettings } from '../types';

interface ConfirmIdentityProps {
  identity: StudentIdentity;
  settings: AppSettings;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmIdentity: React.FC<ConfirmIdentityProps> = ({ identity, settings, onConfirm, onCancel }) => {
  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        <div className="bg-slate-900 p-8 text-white text-center">
          <h2 className="text-2xl font-black uppercase tracking-widest">Konfirmasi Data Peserta</h2>
          <p className="text-slate-400 text-xs mt-2 font-bold italic">Periksa kembali data diri Anda sebelum memulai ujian</p>
        </div>
        
        <div className="p-10 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nama Peserta</p>
              <p className="text-xl font-black text-slate-800">{identity.name}</p>
            </div>
            <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kelas / Rombel</p>
              <p className="text-xl font-black text-slate-800">{identity.className}</p>
            </div>
            <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Mata Pelajaran</p>
              <p className="text-xl font-black text-blue-700">{settings.activeSubject}</p>
            </div>
            <div className="p-6 bg-orange-50 rounded-3xl border border-orange-100">
              <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Alokasi Waktu</p>
              <p className="text-xl font-black text-orange-700">{settings.timerMinutes} Menit</p>
            </div>
          </div>

          <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 flex gap-4 items-start">
            <div className="bg-amber-100 p-2 rounded-full text-amber-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-xs text-amber-700 font-medium leading-relaxed">
              Tombol <b>MULAI</b> akan aktif jika waktu ujian sudah dimulai. Pastikan Anda tidak menutup browser selama ujian berlangsung. Jawaban akan tersimpan otomatis di server Cloud.
            </p>
          </div>

          <div className="flex gap-4 pt-4">
            <button onClick={onCancel} className="flex-1 py-5 font-black text-slate-400 hover:text-slate-600 transition-all uppercase tracking-widest text-xs">Batal</button>
            <button onClick={onConfirm} className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-blue-200 transition-all active:scale-95 uppercase tracking-widest">Mulai Ujian Sekarang</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmIdentity;
