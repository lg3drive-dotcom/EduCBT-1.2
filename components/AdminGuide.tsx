
import React from 'react';

interface AdminGuideProps {
  onClose: () => void;
}

const AdminGuide: React.FC<AdminGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b bg-blue-600 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black flex items-center gap-3">
              <span className="bg-white/20 p-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
              </span>
              Selamat Datang, Administrator!
            </h2>
            <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Sistem Ujian Berbasis Komputer E-Pro CBT Pro 1.2</p>
          </div>
          <button onClick={onClose} className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all text-white font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-10 custom-scrollbar">
          <div className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100 italic">
            <p className="text-blue-800 font-medium leading-relaxed text-sm">
              "Halo Bapak/Ibu Guru! Senang sekali Anda menggunakan E-Pro CBT. Panel ini dirancang untuk memudahkan Anda mengelola ujian secara digital dan efisien. Ikuti panduan singkat di bawah ini agar Anda bisa memaksimalkan semua fitur yang tersedia."
            </p>
          </div>

          {/* STEP 1 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">1</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Memahami "TOKEN" Ujian</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Satu <b>Token</b> adalah satu paket soal. Contoh: Token <span className="text-blue-600 font-bold">UJIAN_01</span>. 
                Siswa hanya bisa masuk jika mereka mengetik Token yang sama persis dengan yang Anda buat di Bank Soal.
              </p>
            </div>
          </section>

          {/* STEP 2 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">2</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Cara Menambah Soal Manual</h3>
              <ul className="text-slate-500 text-sm space-y-2 font-medium list-disc ml-4">
                <li>Klik tombol <b>"TAMBAH"</b> di bagian atas.</li>
                <li>Isi <b>Token Akses</b> (Pastikan unik dan mudah diingat siswa).</li>
                <li>Pilih <b>Tipe Soal</b>: Pilihan Ganda, Pilihan Jamak, atau Kompleks.</li>
                <li>Gunakan <b>Sistem Level</b> untuk klasifikasi kognitif.</li>
                <li>Klik <b>"Simpan"</b> untuk menyimpan ke memori perangkat.</li>
              </ul>
            </div>
          </section>

          {/* STEP 3 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">3</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Membuat Soal dengan AI ✨</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium mb-3">
                Buat puluhan soal dalam detik dengan fitur kecerdasan buatan:
              </p>
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <ol className="text-xs text-emerald-800 space-y-2 font-bold">
                  <li>1. Klik <b>"Generate Soal Otomatis ✨"</b> di sidebar.</li>
                  <li>2. Masukkan topik atau upload file materi acuan.</li>
                  <li>3. Klik <b>"DOWNLOAD UNTUK CBT"</b> untuk mendapatkan file JSON.</li>
                  <li>4. Di panel ini, gunakan tombol <b>"Upload File .JSON"</b> di panel kanan.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* STEP 4 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">4</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">SINKRONISASI CLOUD (PENTING!)</h3>
              <div className="p-5 bg-red-600 text-white rounded-[2rem] shadow-xl">
                <p className="text-sm font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                  Wajib Diperhatikan
                </p>
                <p className="text-xs leading-relaxed opacity-90 font-bold">
                  Soal baru hanya tersimpan di perangkat ini. Anda <b>WAJIB</b> menekan tombol biru <b>"KIRIM KE CLOUD"</b> di sidebar kiri agar siswa bisa menemukan ujian Anda.
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="p-8 border-t bg-slate-50 shrink-0 flex justify-center">
          <button onClick={onClose} className="px-12 py-4 bg-blue-600 text-white font-black rounded-2xl shadow-xl hover:bg-blue-700 transition-all uppercase tracking-widest text-xs">MULAI KELOLA UJIAN</button>
        </div>
      </div>
    </div>
  );
};

export default AdminGuide;
