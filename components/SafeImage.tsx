import React, { useState, useEffect, useRef } from 'react';
import { normalizeImageUrl } from '../utils.ts';

interface SafeImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  onClick?: () => void;
  label?: string;
  mode?: 'admin' | 'student' | 'print';
  style?: React.CSSProperties;
}

const MAX_AUTO_RETRIES = 2;

const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt = 'Gambar Soal',
  className = '',
  onClick,
  label = 'Gambar',
  mode = 'admin',
  style
}) => {
  const normalizedUrl = normalizeImageUrl(src);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  // Reset state immediately whenever image URL changes
  useEffect(() => {
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    setHasError(false);
    setRetryCount(0);

    if (!normalizedUrl) {
      setIsLoading(false);
      return;
    }

    // If image is already cached synchronously in the browser, skip loading state
    if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    return () => {
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [normalizedUrl]);

  if (!normalizedUrl) {
    return null;
  }

  const handleImageLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleImageError = () => {
    if (mode !== 'print' && retryCount < MAX_AUTO_RETRIES) {
      const delay = retryCount === 0 ? 800 : 1800;
      retryTimerRef.current = window.setTimeout(() => {
        setRetryCount(prev => prev + 1);
      }, delay);
    } else {
      setIsLoading(false);
      setHasError(true);
    }
  };

  const handleManualRetry = () => {
    setHasError(false);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
  };

  if (hasError) {
    if (mode === 'admin') {
      return (
        <div className="w-full max-w-lg mx-auto p-4 bg-amber-50 border-2 border-dashed border-amber-300 rounded-2xl text-left shadow-sm my-2 select-text">
          <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase mb-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>Tautan {label} Gagal Dimuat</span>
          </div>
          <p className="text-[11px] text-amber-900 leading-relaxed mb-3 font-medium">
            Browser tidak dapat menampilkan gambar dari tautan ini. Kemungkinan penyebab:
          </p>
          <ul className="text-[10px] text-amber-800 list-disc list-inside space-y-1 mb-3">
            <li><strong>Bukan file gambar langsung:</strong> Tautan merupakan halaman web (misal tampilan Google Drive/ImgBB), bukan file <code>.png/.jpg/.webp</code>.</li>
            <li><strong>Akses dibatasi:</strong> Jika menggunakan Google Drive, ubah izin file menjadi <em>"Siapa saja yang memiliki link"</em> (Anyone with the link).</li>
            <li><strong>Hotlink diblokir / Koneksi lambat:</strong> Server penyedia gambar menolak atau membatasi permintaan.</li>
          </ul>
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-200">
            <button
              type="button"
              onClick={handleManualRetry}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-black uppercase transition-all"
            >
              Muat Ulang
            </button>
            <a
              href={normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-sm active:scale-95"
            >
              <span>Tes Buka Link di Tab Baru</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <span className="text-[9px] font-mono text-slate-500 truncate max-w-xs bg-white px-2 py-1 rounded border border-amber-200" title={normalizedUrl}>
              {normalizedUrl}
            </span>
          </div>
        </div>
      );
    }

    if (mode === 'student') {
      return (
        <div className="w-full max-w-md mx-auto p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center my-4 shadow-sm">
          <p className="text-xs font-bold text-slate-700 mb-2">
            ⚠️ {label} sedang tidak dapat dimuat otomatis dari server sumber.
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleManualRetry}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-[10px] font-bold"
            >
              Coba Muat Ulang
            </button>
            <a
              href={normalizedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold shadow-sm"
            >
              <span>Buka Gambar di Tab Baru</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        </div>
      );
    }

    // mode === 'print'
    return (
      <div className="border border-dashed border-slate-300 rounded p-2 text-center text-xs text-slate-500 my-2">
        [Tautan {label} tidak dapat dimuat]
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center max-w-full">
      {isLoading && mode !== 'print' && (
        <div className="flex items-center gap-2 px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-500 text-xs font-bold animate-pulse">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin shrink-0" />
          <span>Memuat {label.toLowerCase()}...</span>
        </div>
      )}
      <img
        key={`${normalizedUrl}_${retryCount}`}
        ref={imgRef}
        src={normalizedUrl}
        alt={alt}
        className={`${className} ${isLoading && mode !== 'print' ? 'opacity-0 absolute w-0 h-0 overflow-hidden pointer-events-none' : ''}`}
        onClick={onClick}
        style={style}
        referrerPolicy="no-referrer"
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading={mode === 'student' ? 'eager' : 'lazy'}
        decoding="async"
      />
    </div>
  );
};

export default SafeImage;
