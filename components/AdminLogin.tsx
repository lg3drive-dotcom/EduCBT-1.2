
import React, { useState } from 'react';

interface AdminLoginProps {
  onLogin: () => void;
  correctPassword?: string;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin, correctPassword = 'admin123' }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === correctPassword) {
      onLogin();
    } else {
      setError(true);
      alert('PASSWORD SALAH!\n\nSilakan kunjungi situs berikut untuk mendapatkan password administrator yang valid. Anda akan dialihkan otomatis.');
      window.location.href = "https://lynk.id/edupreneur25/n3yqk5e4er64";
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-slate-200">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.9L10 .303 17.834 4.9a1 1 0 01.5 1.075l-1.334 8a1 1 0 01-.504.743l-6 3.5a1 1 0 01-.992 0l-6-3.5a1 1 0 01-.504-.743l-1.334-8a1 1 0 01.5-1.075zm2.131 2.22l.774 4.648L10 14.12l4.929-2.353.774-4.648L10 9.303 4.297 7.12z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-800">Admin Dashboard</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Otentikasi Pengelola</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Password Administrator</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(false);
              }}
              className={`w-full px-4 py-4 bg-slate-50 border-2 rounded-2xl outline-none transition-all font-bold ${error ? 'border-red-500 bg-red-50' : 'border-slate-100 focus:border-blue-600'}`}
              placeholder="••••••••"
              autoFocus
            />
            {error && (
              <p className="text-[9px] text-red-500 font-bold mt-2 text-center uppercase tracking-wider animate-pulse">
                Akses Ditolak! Mengalihkan ke halaman bantuan...
              </p>
            )}
          </div>
          <button 
            type="submit"
            className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-slate-200 uppercase tracking-widest text-xs"
          >
            MASUK PANEL ADMIN
          </button>
        </form>
        
        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-2">Lupa Password?</p>
          <a 
            href="https://lynk.id/edupreneur25/n3yqk5e4er64" 
            className="text-blue-600 font-black text-[10px] uppercase hover:underline"
          >
            Dapatkan Password Baru Disini
          </a>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
