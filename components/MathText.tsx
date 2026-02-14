
import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface MathTextProps {
  text: string;
  className?: string;
  style?: React.CSSProperties;
}

const MathText: React.FC<MathTextProps> = ({ text, className, style }) => {
  const containerRef = useRef<HTMLSpanElement>(null);

  /**
   * Fungsi untuk mengubah format tabel Markdown (| col | col |) menjadi HTML Table
   */
  const parseMarkdownTable = (content: string): string => {
    const lines = content.split('\n');
    let html = '';
    let inTable = false;
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Deteksi baris tabel (diawali dan diakhiri dengan | atau mengandung banyak |)
      if (line.startsWith('|') && line.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(line);
      } else {
        if (inTable) {
          html += renderTable(tableLines);
          inTable = false;
          tableLines = [];
        }
        html += line + '<br/>';
      }
    }

    if (inTable) {
      html += renderTable(tableLines);
    }

    return html;
  };

  const renderTable = (lines: string[]): string => {
    if (lines.length < 2) return lines.join('<br/>');

    let tableHtml = '<div class="overflow-x-auto my-4"><table class="min-w-full border-collapse border border-slate-300 text-sm">';
    
    lines.forEach((line, index) => {
      // Abaikan baris pemisah |---|---|
      if (line.includes('---') && line.includes('|')) return;

      const cells = line.split('|').filter(cell => cell.trim() !== '' || line.indexOf(cell) > 0 && line.indexOf(cell) < line.length - 1);
      
      // Bersihkan array dari cell kosong di ujung
      const cleanCells = line.split('|').slice(1, -1);

      if (index === 0) {
        tableHtml += '<thead class="bg-slate-100"><tr>';
        cleanCells.forEach(cell => {
          tableHtml += `<th class="border border-slate-300 p-2 font-black text-slate-700">${cell.trim()}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr>';
        cleanCells.forEach(cell => {
          tableHtml += `<td class="border border-slate-300 p-2 text-slate-600">${cell.trim()}</td>`;
        });
        tableHtml += '</tr>';
      }
    });

    tableHtml += '</tbody></table></div>';
    return tableHtml;
  };

  useEffect(() => {
    if (containerRef.current) {
      const content = text || '';
      // Regex untuk mendeteksi teks di antara $...$ (inline) atau $$...$$ (block)
      const parts = content.split(/(\$\$[\s\S]*?\$\$|\$.*?\$)/g);
      
      containerRef.current.innerHTML = '';
      
      parts.forEach(part => {
        if (!part) return;

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
          // Bagian teks biasa: sekarang mendukung HTML dan Tabel Markdown
          const textSpan = document.createElement('span');
          // Proses tabel markdown dan izinkan tag HTML
          textSpan.innerHTML = parseMarkdownTable(part);
          containerRef.current?.appendChild(textSpan);
        }
      });
    }
  }, [text]);

  return <span ref={containerRef} className={className} style={{ ...style, whiteSpace: 'normal' }} />;
};

export default MathText;
