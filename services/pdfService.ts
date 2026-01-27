
import { jsPDF } from 'jspdf';
import { QuizResult, Question, QuestionType } from '../types';

const getFullAnswerText = (q: Question, answerValue?: any, isKey: boolean = false): string => {
  const targetAnswer = isKey ? q.correctAnswer : answerValue;
  if (targetAnswer === undefined || targetAnswer === null) return "-";

  if (q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX) {
    if (Array.isArray(targetAnswer)) {
      const labels = q.tfLabels || { true: 'Ya', false: 'Tidak' };
      return q.options?.map((opt, i) => {
        const val = targetAnswer[i];
        const textVal = val === true ? labels.true : val === false ? labels.false : '-';
        return `[${opt}: ${textVal}]`;
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

  // --- HEADER ---
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text('LEMBAR HASIL UJIAN', margin, 22);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`NAMA LENGKAP      : ${identity.name.toUpperCase()}`, margin, 34);
  doc.text(`KELAS / ROMBEL     : ${identity.className}`, margin, 40);
  doc.text(`ASAL SEKOLAH      : ${identity.schoolOrigin}`, margin, 46);
  doc.text(`WAKTU SELESAI   : ${new Date(timestamp).toLocaleString('id-ID')}`, margin, 52);

  // Score Highlight Box
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(pageWidth - 55, 15, 40, 25, 3, 3, 'F');
  doc.setFontSize(8);
  doc.text('SKOR AKHIR', pageWidth - 35, 22, { align: 'center' });
  doc.setFontSize(20);
  doc.text(`${score.toFixed(1)}`, pageWidth - 35, 33, { align: 'center' });

  let y = 65;
  const lineHeight = 5;

  questions.forEach((q, idx) => {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    const studentText = getFullAnswerText(q, studentAns, false);
    const keyText = getFullAnswerText(q, undefined, true);
    const explanationText = q.explanation || "Tidak ada pembahasan.";

    // Split texts to size
    doc.setFontSize(10);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth);
    
    doc.setFontSize(9);
    const ansLines = doc.splitTextToSize(`Jawaban Anda: ${studentText}`, contentWidth - 10);
    const keyLines = doc.splitTextToSize(`Kunci Jawaban: ${keyText}`, contentWidth - 10);
    const expLines = doc.splitTextToSize(`Pembahasan: ${explanationText}`, contentWidth - 10);

    // Calculate total height needed for this block
    const blockHeight = (qLines.length * lineHeight) + 
                        (ansLines.length * 4) + 
                        (keyLines.length * 4) + 
                        (expLines.length * 4) + 15;

    // Check for page break
    if (y + blockHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }

    // Draw Status Indicator (Circle)
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(isCorrect ? 240 : 254, isCorrect ? 253 : 242, isCorrect ? 244 : 242);
    doc.roundedRect(margin - 2, y - 4, contentWidth + 4, blockHeight - 4, 2, 2, 'F');

    // 1. Render Question
    doc.setTextColor(15, 23, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(qLines, margin, y);
    y += (qLines.length * lineHeight) + 2;

    // 2. Render Student Answer
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    if (isCorrect) doc.setTextColor(22, 163, 74); // Green
    else doc.setTextColor(220, 38, 38); // Red
    doc.text(ansLines, margin + 6, y);
    y += (ansLines.length * 4.5);

    // 3. Render Key
    doc.setTextColor(37, 99, 235); // Blue
    doc.setFont("helvetica", "normal");
    doc.text(keyLines, margin + 6, y);
    y += (keyLines.length * 4.5);

    // 4. Render Explanation
    doc.setTextColor(71, 85, 105);
    doc.setFont("helvetica", "italic");
    doc.text(expLines, margin + 6, y);
    y += (expLines.length * 4.5) + 6; // Add space after block
  });

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text(`E-Laporan ini dihasilkan secara otomatis oleh sistem EduCBT Pro. Dicetak pada ${new Date().toLocaleString('id-ID')}`, margin, pageHeight - 10);

  doc.save(`Hasil_Ujian_${identity.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: string, token?: string) => {
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
