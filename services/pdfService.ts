
import { jsPDF } from 'jspdf';
import { QuizResult, Question, Subject, QuestionType } from '../types';

const getFullAnswerText = (q: Question, answerValue?: any, isKey: boolean = false): string => {
  const targetAnswer = isKey ? q.correctAnswer : answerValue;
  if (targetAnswer === undefined || targetAnswer === null) return "-";

  if (q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX) {
    if (Array.isArray(targetAnswer)) {
      const labels = q.tfLabels || { true: 'Ya', false: 'Tidak' };
      return q.options?.map((opt, i) => {
        const val = targetAnswer[i];
        const textVal = val === true ? labels.true : val === false ? labels.false : '-';
        return `[${opt.substring(0, 15)}...: ${textVal}]`;
      }).join(", ") || "-";
    }
    return "-";
  } else if (q.options) {
    if (Array.isArray(targetAnswer)) {
      return targetAnswer.map(i => q.options?.[i]).join(", ");
    } else {
      return q.options[targetAnswer] !== undefined ? q.options[targetAnswer] : "-";
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
  if (q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX) {
    if (!Array.isArray(q.correctAnswer) || !Array.isArray(studentAnswer)) return false;
    return q.correctAnswer.length === studentAnswer.length && q.correctAnswer.every((v:any, i:number) => v === studentAnswer[i]);
  }
  return false;
};

export const generateResultPDF = (result: QuizResult, questions: Question[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const { identity, score, answers, timestamp } = result;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // --- HEADER SECTION ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text('HASIL EVALUASI UJIAN', margin, 18);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`NAMA LENGKAP  : ${identity.name.toUpperCase()}`, margin, 30);
  doc.text(`KELAS / ROMBEL : ${identity.className}`, margin, 35);
  doc.text(`TANGGAL UJIAN  : ${new Date(timestamp).toLocaleString('id-ID')}`, margin, 40);

  // Score Box
  doc.setFillColor(37, 99, 235); // Blue 600
  doc.roundedRect(pageWidth - 55, 12, 40, 25, 3, 3, 'F');
  doc.setFontSize(8);
  doc.text('TOTAL SKOR', pageWidth - 35, 18, { align: 'center' });
  doc.setFontSize(18);
  doc.text(`${score.toFixed(1)}`, pageWidth - 35, 30, { align: 'center' });

  // --- TABLE HEADER ---
  let yPos = 60;
  const colWidths = {
    no: 10,
    soal: 80,
    jawaban: 40,
    kunci: 40,
    status: 10
  };

  const drawTableHeader = (y: number) => {
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.rect(margin, y, contentWidth, 10, 'D');
    
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    
    let x = margin;
    doc.text('NO', x + 2, y + 6.5);
    x += colWidths.no;
    doc.text('BUTIR PERTANYAAN', x + 2, y + 6.5);
    x += colWidths.soal;
    doc.text('JAWABAN ANDA', x + 2, y + 6.5);
    x += colWidths.jawaban;
    doc.text('KUNCI', x + 2, y + 6.5);
    x += colWidths.kunci;
    doc.text('STAT', x + 2, y + 6.5);
  };

  drawTableHeader(yPos);
  yPos += 10;

  // --- TABLE BODY ---
  questions.forEach((q, idx) => {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    const fullStudentAns = getFullAnswerText(q, studentAns, false);
    const fullKeyText = getFullAnswerText(q, undefined, true);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    
    const soalLines = doc.splitTextToSize(q.text, colWidths.soal - 4);
    const ansLines = doc.splitTextToSize(fullStudentAns, colWidths.jawaban - 4);
    const keyLines = doc.splitTextToSize(fullKeyText, colWidths.kunci - 4);
    
    // Hitung tinggi baris berdasarkan teks terpanjang
    const maxLines = Math.max(soalLines.length, ansLines.length, keyLines.length);
    const rowHeight = (maxLines * 4) + 4;

    // Cek apakah muat di halaman ini
    if (yPos + rowHeight > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
      drawTableHeader(yPos);
      yPos += 10;
    }

    // Draw Row Borders
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, yPos, contentWidth, rowHeight, 'D');
    
    // Print Cells
    let x = margin;
    
    // No
    doc.text(`${idx + 1}`, x + 5, yPos + 5, { align: 'center' });
    x += colWidths.no;
    
    // Soal
    doc.text(soalLines, x + 2, yPos + 5);
    x += colWidths.soal;
    
    // Jawaban (Warna merah jika salah)
    if (!isCorrect) doc.setTextColor(220, 38, 38);
    doc.text(ansLines, x + 2, yPos + 5);
    doc.setTextColor(51, 65, 85);
    x += colWidths.jawaban;
    
    // Kunci
    doc.setTextColor(22, 101, 52);
    doc.text(keyLines, x + 2, yPos + 5);
    doc.setTextColor(51, 65, 85);
    x += colWidths.kunci;
    
    // Status (V / X)
    doc.setFont("helvetica", "bold");
    if (isCorrect) {
      doc.setTextColor(22, 163, 74);
      doc.text('OK', x + 5, yPos + 5, { align: 'center' });
    } else {
      doc.setTextColor(220, 38, 38);
      doc.text('X', x + 5, yPos + 5, { align: 'center' });
    }
    doc.setTextColor(51, 65, 85);

    yPos += rowHeight;
  });

  // Footer Branding
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Diterbitkan otomatis oleh sistem EduCBT Pro • Laporan ini sah tanpa tanda tangan.', margin, pageHeight - 10);

  doc.save(`Hasil_Ujian_${identity.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: Subject, token?: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`BANK SOAL - ${token || 'SEMUA'}`, 105, 20, { align: 'center' });
  
  let y = 35;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  questions.forEach((q, i) => {
    const textLines = doc.splitTextToSize(`${q.order}. ${q.text}`, 170);
    const itemHeight = (textLines.length * 5) + 5;

    if (y + itemHeight > 270) { 
      doc.addPage(); 
      y = 25; 
    }

    doc.text(textLines, 20, y);
    y += itemHeight;
  });
  
  doc.save(`BankSoal_${token || 'Export'}.pdf`);
};
