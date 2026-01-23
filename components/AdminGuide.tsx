
import React from 'react';

interface AdminGuideProps {
  onClose: () => void;
}

const AdminGuide: React.FC<AdminGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-8 border-b bg-slate-50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
              <span className="bg-blue-600 text-white p-2 rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              </span>
              Panduan Penggunaan EduCBT
            </h2>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 italic">Panduan Lengkap untuk Administrator & Guru</p>
          </div>
          <button onClick={onClose} className="bg-slate-200 hover:bg-slate-300 p-3 rounded-full transition-all text-slate-600 font-black">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-10 custom-scrollbar">
          {/* STEP 1 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">1</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Memahami "TOKEN" Ujian</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                Satu <b>Token</b> adalah satu paket soal. Contoh: Token <span className="text-blue-600 font-bold">MTK-BAB1</span> berisi soal Matematika Bab 1. 
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
                <li>Klik tombol hitam <b>"TAMBAH"</b> di bagian atas daftar soal.</li>
                <li>Isi <b>Token Akses</b> (Sangat penting!).</li>
                <li>Pilih <b>Tipe Soal</b>: Pilihan Ganda (1 jawaban), Pilihan Jamak (beberapa jawaban), atau Kompleks (Ya/Tidak).</li>
                <li>Gunakan <b>Sistem Level</b> (Bloom/Puspendik) untuk klasifikasi tingkat kesulitan.</li>
                <li>Klik <b>"Tambah Soal"</b> di bagian bawah form untuk menyimpan ke memori perangkat.</li>
              </ul>
            </div>
          </section>

          {/* STEP 3 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">3</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Membuat Soal Otomatis dengan AI</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium mb-3">
                Anda bisa menggunakan fitur AI eksternal untuk membuat puluhan soal dalam hitungan detik:
              </p>
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <ol className="text-xs text-emerald-800 space-y-2 font-bold">
                  <li>1. Klik link <b>"Generate Soal Otomatis ✨"</b> di sidebar kiri.</li>
                  <li>2. Masukkan materi pelajaran di panel AI yang terbuka.</li>
                  <li>3. Setelah AI membuat soal, klik tombol <b>"DOWNLOAD UNTUK CBT"</b>.</li>
                  <li>4. Kembali ke panel ini, lalu di bagian <b>Data & Backup</b>, klik <b>"Upload File .JSON"</b>.</li>
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
                  Perhatian Khusus
                </p>
                <p className="text-xs leading-relaxed opacity-90 font-bold">
                  Soal yang Anda buat atau upload BARU tersimpan di perangkat Anda saja. Agar siswa bisa mengaksesnya, Anda <b>WAJIB</b> menekan tombol biru besar bertuliskan <span className="underline italic">"SINKRONISASI CLOUD"</span> di sidebar kiri. Jika tidak ditekan, siswa akan melihat pesan "Token Tidak Ditemukan".
                </p>
              </div>
            </div>
          </section>

          {/* STEP 5 */}
          <section className="flex gap-6">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center font-black text-xl shrink-0 shadow-sm">5</div>
            <div>
              <h3 className="text-xl font-black text-slate-800 mb-2">Mengatur Waktu & Backup</h3>
              <ul className="text-slate-500 text-sm space-y-2 font-medium list-disc ml-4">
                <li><b>Durasi Ujian:</b> Masukkan angka (menit) di panel kanan, lalu klik "Simpan Waktu".</li>
                <li><b>Backup:</b> Klik "Download Bank Soal" untuk menyimpan semua soal Anda ke komputer dalam format file .JSON. Ini berguna sebagai cadangan jika perangkat Anda direset.</li>
                <li><b>Reset:</b> Menghapus semua daftar soal di layar Anda saat ini agar bisa mulai dari nol.</li>
              </ul>
            </div>
          </section>
        </div>

        <div className="p-8 border-t bg-slate-50 shrink-0 flex justify-center">
          <button onClick={onClose} className="px-12 py-4 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-black transition-all uppercase tracking-widest text-xs">SAYA SUDAH MENGERTI</button>
        </div>
      </div>
    </div>
  );
};

export default AdminGuide;
