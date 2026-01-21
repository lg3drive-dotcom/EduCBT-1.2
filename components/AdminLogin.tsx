
import React, { useState } from 'react';

interface AdminLoginProps {
  onLogin: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Default dummy admin password is 'admin123'
    if (password === 'admin123') {
      onLogin();
    } else {
      alert('Password Admin Salah!');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2.166 4.9L10 .303 17.834 4.9a1 1 0 01.5 1.075l-1.334 8a1 1 0 01-.504.743l-6 3.5a1 1 0 01-.992 0l-6-3.5a1 1 0 01-.504-.743l-1.334-8a1 1 0 01.5-1.075zm2.131 2.22l.774 4.648L10 14.12l4.929-2.353.774-4.648L10 9.303 4.297 7.12z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800">Admin Dashboard</h2>
          <p className="text-slate-500">Masukan password akses pengelola</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Password Admin</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoFocus
            />
          </div>
          <button 
            type="submit"
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
          >
            MASUK PANEL ADMIN
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
