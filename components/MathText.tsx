import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

const MathText: React.FC<MathTextProps> = ({ text, className, style }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const content = text || '';
      // Regex untuk mendeteksi teks di antara $...$ (inline) atau $$...$$ (block)
      const parts = content.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g);
      
      containerRef.current.innerHTML = '';
      
      parts.forEach(part => {
        if (!part) return; // Abaikan string kosong hasil split

        if (part.startsWith('$$') && part.endsWith('$$')) {
          const formula = part.slice(2, -2);
          const span = document.createElement('span');
          span.className = 'block my-4 text-center';
          try {
            katex.render(formula, span, { displayMode: true, throwOnError: false });
          } catch (e) {
            span.textContent = part;
          }
          containerRef.current?.appendChild(span);
        } else if (part.startsWith('$') && part.endsWith('$')) {
          const formula = part.slice(1, -1);
          const span = document.createElement('span');
          try {
            katex.render(formula, span, { displayMode: false, throwOnError: false });
          } catch (e) {
            span.textContent = part;
          }
          containerRef.current?.appendChild(span);
        } else {
          const textSpan = document.createElement('span');
          textSpan.textContent = part;
          containerRef.current?.appendChild(textSpan);
        }
      });
    }
  }, [text]);

  return <span ref={containerRef} className={className} style={{ ...style, whiteSpace: 'pre-wrap' }} />;
};

export default MathText;