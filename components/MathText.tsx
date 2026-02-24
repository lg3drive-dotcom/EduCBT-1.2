
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
   * Fungsi untuk mengubah sintaks Markdown Bold/Italic/Underline menjadi HTML
   */
  const formatMarkdownStyles = (content: string): string => {
    if (!content) return '';
    return content
      .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Bold: **text**
      .replace(/__(.*?)__/g, '<u>$1</u>')     // Underline: __text__
      .replace(/\*(.*?)\*/g, '<i>$1</i>');    // Italic: *text*
  };

  /**
   * Fungsi untuk mengubah format tabel Markdown (| col | col |) menjadi HTML Table
   */
  const parseMarkdownTable = (content: string): string => {
    const lines = content.split('\n');
    let html = '';
    let inTable = false;
    let tableLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      const trimmedLine = originalLine.trim();
      
      // Deteksi baris tabel (diawali dan diakhiri dengan |)
      if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableLines = [];
        }
        tableLines.push(trimmedLine);
      } else {
        if (inTable) {
          html += renderTable(tableLines);
          inTable = false;
          tableLines = [];
        }
        // Jika bukan baris tabel, proses gaya Markdown (bold/italic)
        // Gunakan originalLine agar spasi tidak hilang, dan tambahkan <br/> hanya jika ada baris berikutnya
        html += formatMarkdownStyles(originalLine);
        if (i < lines.length - 1) {
          html += '<br/>';
        }
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

      const cleanCells = line.split('|').slice(1, -1);

      if (index === 0) {
        tableHtml += '<thead class="bg-slate-100"><tr>';
        cleanCells.forEach(cell => {
          const cellContent = formatMarkdownStyles(cell.trim());
          tableHtml += `<th class="border border-slate-300 p-2 font-black text-slate-700">${cellContent}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';
      } else {
        tableHtml += '<tr>';
        cleanCells.forEach(cell => {
          const cellContent = formatMarkdownStyles(cell.trim());
          tableHtml += `<td class="border border-slate-300 p-2 text-slate-600">${cellContent}</td>`;
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
          const textSpan = document.createElement('span');
          // Sekarang mendukung: HTML Tag, Markdown Table, dan Markdown Styles (Bold/Italic)
          textSpan.innerHTML = parseMarkdownTable(part);
          containerRef.current?.appendChild(textSpan);
        }
      });
    }
  }, [text]);

  return <span ref={containerRef} className={className} style={{ ...style, whiteSpace: 'normal' }} />;
};

export default MathText;
