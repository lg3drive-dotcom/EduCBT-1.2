
import { jsPDF } from 'jspdf';
import { QuizResult, Question, Subject, QuestionType } from '../types';

/**
 * Mendapatkan teks jawaban lengkap.
 * @param q Objek soal
 * @param answerValue Nilai jawaban (bisa dari siswa atau kunci)
 * @param isKey Apakah kita sedang mengambil teks untuk Kunci Jawaban?
 */
const getFullAnswerText = (q: Question, answerValue?: any, isKey: boolean = false): string => {
  // Jika mencari kunci, gunakan correctAnswer. Jika mencari jawaban siswa, gunakan answerValue.
  const targetAnswer = isKey ? q.correctAnswer : answerValue;
  
  // Jika data tidak ada (tidak dijawab oleh siswa)
  if (targetAnswer === undefined || targetAnswer === null) return "-";

  if (q.type === QuestionType.COMPLEX_CATEGORY) {
    if (Array.isArray(targetAnswer)) {
      const allNull = targetAnswer.every(v => v === null || v === undefined);
      if (allNull) return "-";
      
      return q.options?.map((opt, i) => {
        const val = targetAnswer[i];
        const textVal = val === true ? 'Ya' : val === false ? 'Tidak' : '-';
        return `[${opt}: ${textVal}]`;
      }).join(", ") || "-";
    }
    return "-";
  } else if (q.options) {
    if (Array.isArray(targetAnswer)) {
      if (targetAnswer.length === 0) return "-";
      return targetAnswer.map(i => q.options?.[i]).join(", ");
    } else {
      // Pastikan index valid
      const text = q.options[targetAnswer];
      return text !== undefined ? text : "-";
    }
  }
  return "-";
};

const checkCorrectness = (q: Question, studentAnswer: any): boolean => {
  if (studentAnswer === undefined || studentAnswer === null) return false;

  if (q.type === QuestionType.SINGLE) return studentAnswer === q.correctAnswer;
  
  if (q.type === QuestionType.MULTIPLE) {
    if (!Array.isArray(q.correctAnswer) || !Array.isArray(studentAnswer)) return false;
    const correctSet = new Set(q.correctAnswer);
    const studentSet = new Set(studentAnswer);
    return correctSet.size === studentSet.size && [...correctSet].every(x => studentSet.has(x));
  }

  if (q.type === QuestionType.COMPLEX_CATEGORY) {
    if (!Array.isArray(q.correctAnswer) || !Array.isArray(studentAnswer)) return false;
    return q.correctAnswer.length === studentAnswer.length && 
           q.correctAnswer.every((v, i) => v === studentAnswer[i]);
  }
  
  return false;
};

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
    // Gunakan isKey=true untuk kisi-kisi
    const fullKeyText = getFullAnswerText(q, undefined, true);
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
    if (q.options) {
      q.options.forEach((opt, i) => {
        const prefix = q.type === QuestionType.COMPLEX_CATEGORY ? `[ ] ` : `${String.fromCharCode(65 + i)}. `;
        questionAndOptions += `${prefix}${opt}\n`;
      });
    }

    // Gunakan isKey=true untuk kunci jawaban
    const keyAndEx = `KUNCI: ${getFullAnswerText(q, undefined, true)}\n\nKET: ${q.explanation || '-'}`;

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
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Header Background
  doc.setFillColor(30, 41, 59); 
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text('LAPORAN HASIL UJIAN', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Identitas: ${identity.name} (${identity.className})`, margin, 32);
  doc.text(`Waktu: ${new Date(timestamp).toLocaleString('id-ID')}`, margin, 37);
  
  // Skor Badge
  doc.setFillColor(37, 99, 235); 
  doc.roundedRect(pageWidth - 55, 12, 40, 22, 3, 3, 'F');
  doc.setFontSize(8);
  doc.text('SKOR AKHIR', pageWidth - 35, 18, { align: 'center' });
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${score.toFixed(1)}`, pageWidth - 35, 28, { align: 'center' });

  let yPos = 55;
  doc.setTextColor(0, 0, 0);

  questions.forEach((q, idx) => {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    
    // Perbaikan: studentAns dilempar ke answerValue, isKey=false (default)
    const fullStudentAns = getFullAnswerText(q, studentAns, false);
    // Perbaikan: Untuk kunci jawaban gunakan isKey=true
    const fullKeyText = getFullAnswerText(q, undefined, true);
    
    doc.setFontSize(9);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth - 40);
    const ansLines = doc.splitTextToSize(`Jawaban Anda: ${fullStudentAns}`, contentWidth - 40);
    const keyLines = doc.splitTextToSize(`Kunci Jawaban: ${fullKeyText}`, contentWidth - 40);
    const exLines = doc.splitTextToSize(`Pembahasan: ${q.explanation || '-'}`, contentWidth - 40);
    
    const itemHeight = (qLines.length + ansLines.length + keyLines.length + exLines.length) * 5 + 15;

    if (yPos + itemHeight > pageHeight - 15) {
      doc.addPage();
      yPos = 15;
    }

    doc.setDrawColor(226, 232, 240); 
    doc.rect(margin, yPos, contentWidth, itemHeight);
    
    // Label Status
    if (isCorrect) {
      doc.setFillColor(220, 252, 231); 
      doc.rect(pageWidth - margin - 25, yPos + 5, 20, 8, 'F');
      doc.setTextColor(22, 101, 52); 
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text('BENAR', pageWidth - margin - 15, yPos + 10.5, { align: 'center' });
    } else {
      doc.setFillColor(254, 226, 226); 
      doc.rect(pageWidth - margin - 25, yPos + 5, 20, 8, 'F');
      doc.setTextColor(153, 27, 27); 
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.text('SALAH', pageWidth - margin - 15, yPos + 10.5, { align: 'center' });
    }

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
    doc.setTextColor(100, 116, 139); 
    doc.text(exLines, margin + 5, currentTextY + 18 + (ansLines.length * 4) + (keyLines.length * 4));

    yPos += itemHeight + 5;
  });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(148, 163, 184);
  doc.text(`EduCBT Digital Report • ID: ${result.id}`, pageWidth / 2, pageHeight - 8, { align: 'center' });

  doc.save(`LJK_${identity.name}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: Subject) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  drawKisiKisiSection(doc, questions, subject);
  doc.addPage();
  drawSoalSection(doc, questions, subject);
  doc.save(`BankSoal_${subject || 'Semua'}.pdf`);
};
