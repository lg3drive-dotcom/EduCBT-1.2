
import { jsPDF } from 'jspdf';
import { QuizResult, Question, Subject, QuestionType } from '../types';

/**
 * Fungsi pembantu untuk mendapatkan teks jawaban lengkap
 */
const getFullAnswerText = (q: Question, answerValue?: any): string => {
  const targetAnswer = answerValue !== undefined ? answerValue : q.correctAnswer;
  
  if (targetAnswer === undefined || targetAnswer === null) return "Tidak dijawab";

  if (q.type === QuestionType.COMPLEX_CATEGORY) {
    return q.options?.map((opt, i) => `[${opt}: ${targetAnswer[i] ? 'Ya' : 'Tidak'}]`).join(", ") || "-";
  } else if (q.type === QuestionType.SHORT_ANSWER) {
    return String(targetAnswer);
  } else if (q.options) {
    if (Array.isArray(targetAnswer)) {
      return targetAnswer.map(i => q.options?.[i]).join(", ");
    } else {
      return q.options[targetAnswer] || "-";
    }
  }
  return "-";
};

/**
 * Mengecek apakah jawaban siswa benar
 */
const checkCorrectness = (q: Question, studentAnswer: any): boolean => {
  if (studentAnswer === undefined || studentAnswer === null) return false;

  if (q.type === QuestionType.SINGLE) return studentAnswer === q.correctAnswer;
  if (q.type === QuestionType.SHORT_ANSWER) return String(studentAnswer).toLowerCase().trim() === String(q.correctAnswer).toLowerCase().trim();
  
  if (Array.isArray(q.correctAnswer) && Array.isArray(studentAnswer)) {
    return q.correctAnswer.length === studentAnswer.length && 
           q.correctAnswer.every((v, i) => v === studentAnswer[i]);
  }
  
  return false;
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
 * Menggambar Daftar Soal ke dalam dokumen PDF
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

/**
 * Laporan Hasil Ujian Lengkap (LJK Digital PDF)
 */
export const generateResultPDF = (result: QuizResult, questions: Question[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const { identity, score, answers, timestamp } = result;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // --- HEADER SECTION ---
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text('LAPORAN HASIL UJIAN', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Identitas: ${identity.name} (${identity.className})`, margin, 32);
  doc.text(`Waktu: ${new Date(timestamp).toLocaleString('id-ID')}`, margin, 37);
  
  doc.setFillColor(37, 99, 235); // Blue-600
  doc.roundedRect(pageWidth - 55, 12, 40, 22, 3, 3, 'F');
  doc.setFontSize(8);
  doc.text('SKOR AKHIR', pageWidth - 35, 18, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${score.toFixed(1)}`, pageWidth - 35, 28, { align: 'center' });

  // --- BODY SECTION (Daftar Soal) ---
  let yPos = 55;
  doc.setTextColor(0, 0, 0);

  questions.forEach((q, idx) => {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    const fullStudentAns = getFullAnswerText(q, studentAns);
    const fullKeyText = getFullAnswerText(q);
    
    // Tentukan Tinggi Row
    doc.setFontSize(9);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth - 40);
    const ansLines = doc.splitTextToSize(`Jawaban Anda: ${fullStudentAns}`, contentWidth - 40);
    const keyLines = doc.splitTextToSize(`Kunci Jawaban: ${fullKeyText}`, contentWidth - 40);
    const exLines = doc.splitTextToSize(`Pembahasan: ${q.explanation || '-'}`, contentWidth - 40);
    
    const itemHeight = (qLines.length + ansLines.length + keyLines.length + exLines.length) * 5 + 15;

    // Cek New Page
    if (yPos + itemHeight > pageHeight - 15) {
      doc.addPage();
      yPos = 15;
    }

    // Border Box
    doc.setDrawColor(226, 232, 240); // Slate-200
    doc.rect(margin, yPos, contentWidth, itemHeight);
    
    // Status Badge
    if (isCorrect) {
      doc.setFillColor(220, 252, 231); // Green-100
      doc.rect(pageWidth - margin - 25, yPos + 5, 20, 8, 'F');
      doc.setTextColor(22, 101, 52); // Green-800
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text('BENAR', pageWidth - margin - 15, yPos + 10.5, { align: 'center' });
    } else {
      doc.setFillColor(254, 226, 226); // Red-100
      doc.rect(pageWidth - margin - 25, yPos + 5, 20, 8, 'F');
      doc.setTextColor(153, 27, 27); // Red-800
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text('SALAH', pageWidth - margin - 15, yPos + 10.5, { align: 'center' });
    }

    // Teks Detail
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(qLines, margin + 5, yPos + 8);
    
    doc.setFont("helvetica", "normal");
    let currentTextY = yPos + 8 + (qLines.length * 5);
    doc.text(ansLines, margin + 5, currentTextY + 5);
    
    doc.setFont("helvetica", "bold");
    doc.setTextColor(22, 101, 52);
    doc.text(keyLines, margin + 5, currentTextY + 10 + (ansLines.length * 4));
    
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(exLines, margin + 5, currentTextY + 18 + (ansLines.length * 4) + (keyLines.length * 4));

    yPos += itemHeight + 5;
  });

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`EduCBT Digital Report • Generate ID: ${result.id}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save(`Hasil_Ujian_${identity.name}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: Subject) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  drawKisiKisiSection(doc, questions, subject);
  doc.addPage();
  drawSoalSection(doc, questions, subject);
  doc.save(`BankSoal_Lengkap_${subject || 'SemuaMapel'}.pdf`);
};
