
import { jsPDF } from 'jspdf';
import { QuizResult, Question, Subject, QuestionType } from '../types';

/**
 * Fungsi pembantu untuk mendapatkan teks jawaban lengkap
 */
const getFullAnswerText = (q: Question): string => {
  if (q.type === QuestionType.COMPLEX_CATEGORY) {
    return q.options?.map((opt, i) => `[${opt}: ${q.correctAnswer[i] ? 'Sesuai' : 'Tidak'}]`).join(", ") || "-";
  } else if (q.type === QuestionType.SHORT_ANSWER) {
    return String(q.correctAnswer);
  } else if (q.options) {
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer.map(i => q.options?.[i]).join(", ");
    } else {
      return q.options[q.correctAnswer] || "-";
    }
  }
  return "-";
};

/**
 * Menggambar Tabel Kisi-kisi ke dalam dokumen PDF
 */
const drawKisiKisiSection = (doc: jsPDF, questions: Question[], subject?: Subject, startY: number = 25): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(subject ? `KISI-KISI SOAL - ${subject.toUpperCase()}` : 'KISI-KISI SOAL CBT', pageWidth / 2, startY - 10, { align: 'center' });
  
  doc.setLineWidth(0.3);
  doc.line(margin, startY - 5, pageWidth - margin, startY - 5);

  let yPos = startY;
  
  const columns = [
    { header: 'NO', width: 10 },
    { header: 'MAPEL', width: 25 },
    { header: 'MATERI / INDIKATOR', width: 50 },
    { header: 'LEVEL', width: 20 },
    { header: 'TIPE', width: 35 },
    { header: 'KUNCI JAWABAN', width: 50 }
  ];

  const drawHeader = (y: number) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.rect(margin, y, contentWidth, 10, 'S');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    let x = margin;
    columns.forEach(col => {
      doc.text(col.header, x + (col.width/2), y + 6, { align: 'center' });
      doc.line(x, y, x, y + 10);
      x += col.width;
    });
    doc.line(x, y, x, y + 10);
  };

  drawHeader(yPos);
  yPos += 10;

  questions.forEach((q, idx) => {
    const fullKeyText = getFullAnswerText(q);
    doc.setFontSize(7);
    const materiLines = doc.splitTextToSize(q.material || "-", columns[2].width - 4);
    const keyLines = doc.splitTextToSize(fullKeyText, columns[5].width - 4);
    
    const rowHeight = Math.max(materiLines.length * 4, keyLines.length * 4, 10);

    if (yPos + rowHeight > pageHeight - 15) {
      doc.addPage();
      yPos = 15;
      drawHeader(yPos);
      yPos += 10;
    }

    doc.setFont("helvetica", "normal");
    let x = margin;
    doc.rect(margin, yPos, contentWidth, rowHeight);
    doc.text((idx + 1).toString(), x + columns[0].width / 2, yPos + 6, { align: 'center' });
    x += columns[0].width;
    doc.text(q.subject, x + 2, yPos + 6);
    x += columns[1].width;
    doc.text(materiLines, x + 2, yPos + 4);
    x += columns[2].width;
    doc.text(q.level.split(' ')[0], x + 2, yPos + 6);
    x += columns[3].width;
    doc.text(q.type, x + 2, yPos + 6);
    x += columns[4].width;
    doc.text(keyLines, x + 2, yPos + 4);
    
    yPos += rowHeight;
  });

  return yPos;
};

/**
 * Menggambar Daftar Soal ke dalam dokumen PDF dalam bentuk TABEL
 */
const drawSoalSection = (doc: jsPDF, questions: Question[], subject?: Subject, startY: number = 25): number => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(subject ? `DAFTAR BUTIR SOAL - ${subject.toUpperCase()}` : 'DAFTAR BUTIR SOAL CBT', pageWidth / 2, startY - 10, { align: 'center' });
  doc.line(margin, startY - 5, pageWidth - margin, startY - 5);

  let yPos = startY;
  
  const columns = [
    { header: 'NO', width: 10 },
    { header: 'BUTIR PERTANYAAN & OPSI', width: 130 },
    { header: 'KUNCI & PEMBAHASAN', width: 50 }
  ];

  const drawHeader = (y: number) => {
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.rect(margin, y, contentWidth, 10, 'S');
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = margin;
    columns.forEach(col => {
      doc.text(col.header, x + (col.width/2), y + 6, { align: 'center' });
      doc.line(x, y, x, y + 10);
      x += col.width;
    });
    doc.line(x, y, x, y + 10);
  };

  drawHeader(yPos);
  yPos += 10;

  questions.forEach((q, idx) => {
    // Menyiapkan teks pertanyaan dan opsi
    let questionAndOptions = `${q.text}\n\n`;
    if (q.type === QuestionType.SHORT_ANSWER) {
      questionAndOptions += `(Isian Singkat)`;
    } else if (q.options) {
      q.options.forEach((opt, i) => {
        const prefix = q.type === QuestionType.COMPLEX_CATEGORY ? `[ ] ` : `${String.fromCharCode(65 + i)}. `;
        questionAndOptions += `${prefix}${opt}\n`;
      });
    }

    const keyAndEx = `KUNCI: ${getFullAnswerText(q)}\n\nKET: ${q.explanation || '-'}`;

    doc.setFontSize(8);
    const qLines = doc.splitTextToSize(questionAndOptions, columns[1].width - 4);
    const exLines = doc.splitTextToSize(keyAndEx, columns[2].width - 4);
    
    const rowHeight = Math.max(qLines.length * 4.5, exLines.length * 4.5, 15);

    if (yPos + rowHeight > pageHeight - 15) {
      doc.addPage();
      yPos = 15;
      drawHeader(yPos);
      yPos += 10;
    }

    doc.rect(margin, yPos, contentWidth, rowHeight);
    let x = margin;
    doc.setFont("helvetica", "bold");
    doc.text((idx + 1).toString(), x + columns[0].width / 2, yPos + 6, { align: 'center' });
    x += columns[0].width;
    doc.setFont("helvetica", "normal");
    doc.text(qLines, x + 2, yPos + 6);
    x += columns[1].width;
    doc.setFont("helvetica", "italic");
    doc.text(exLines, x + 2, yPos + 6);

    yPos += rowHeight;
  });

  return yPos;
};

export const generateResultPDF = (result: QuizResult, questions: Question[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const { identity, score, answers, timestamp } = result;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - (margin * 2);

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text('HASIL UJIAN SISWA', pageWidth / 2, 20, { align: 'center' });
  doc.line(margin, 25, pageWidth - margin, 25);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nama: ${identity.name}`, margin, 35);
  doc.text(`Kelas: ${identity.className}`, margin, 40);
  doc.text(`Tanggal: ${new Date(timestamp).toLocaleDateString('id-ID')}`, pageWidth - margin, 35, { align: 'right' });
  
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, 50, contentWidth, 20, 'F');
  doc.setFontSize(18);
  doc.text(`SKOR: ${score.toFixed(1)} / 100`, pageWidth / 2, 63, { align: 'center' });

  doc.save(`Hasil_${identity.name}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: Subject) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  // Sebagaimana diminta, langsung download lengkap dengan format tabel
  drawKisiKisiSection(doc, questions, subject);
  doc.addPage();
  drawSoalSection(doc, questions, subject);
  doc.save(`BankSoal_Lengkap_${subject || 'SemuaMapel'}.pdf`);
};
