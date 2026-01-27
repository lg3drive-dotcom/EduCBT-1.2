
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

export const generateResultPDF = async (result: QuizResult, questions: Question[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const { identity, score, answers, timestamp } = result;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const contentWidth = pageWidth - (marginX * 2);
  const bodyFontSize = 10;
  const lineSpacing = 5; // Spasi antar baris teks

  // --- HEADER ---
  doc.setFillColor(15, 23, 42); 
  doc.rect(0, 0, pageWidth, 50, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(20);
  doc.text('HASIL EVALUASI SISWA', marginX, 20);
  
  doc.setFontSize(10);
  doc.text(`NAMA LENGKAP : ${identity.name.toUpperCase()}`, marginX, 30);
  doc.text(`KELAS / ROMBEL : ${identity.className}`, marginX, 36);
  doc.text(`TANGGAL UJIAN : ${new Date(timestamp).toLocaleString('id-ID')}`, marginX, 42);

  // Score Badge (Warna biru tetap digunakan)
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(pageWidth - 55, 12, 35, 22, 2, 2, 'F');
  doc.setFontSize(8);
  doc.text('NILAI AKHIR', pageWidth - 37.5, 18, { align: 'center' });
  doc.setFontSize(18);
  doc.text(`${score.toFixed(1)}`, pageWidth - 37.5, 28, { align: 'center' });

  let y = 60;

  for (const [idx, q] of questions.entries()) {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    const studentText = getFullAnswerText(q, studentAns, false);
    const keyText = getFullAnswerText(q, undefined, true);
    const explanationText = q.explanation || "Tidak ada pembahasan.";

    doc.setFontSize(bodyFontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);

    // Render Soal
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth);
    const qHeight = qLines.length * lineSpacing;

    // Cek Page Break
    let estimatedHeight = qHeight + 30; 
    if (q.questionImage) estimatedHeight += 50;

    if (y + estimatedHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }

    doc.text(qLines, marginX, y);
    y += qHeight + 4;

    // Render Gambar jika ada
    if (q.questionImage) {
      try {
        const imgWidth = 80;
        const imgHeight = 45;
        doc.addImage(q.questionImage, 'JPEG', marginX, y, imgWidth, imgHeight);
        y += imgHeight + 6;
      } catch (e) {
        console.warn("PDF Image Load Error", e);
      }
    }

    // Detail Jawaban & Pembahasan
    const detailMargin = marginX + 5;
    const detailWidth = contentWidth - 5;

    // Render Student Answer (Warna hijau/merah tetap digunakan)
    if (isCorrect) doc.setTextColor(22, 163, 74); else doc.setTextColor(220, 38, 38);
    const ansLines = doc.splitTextToSize(`Jawaban Anda: ${studentText}`, detailWidth);
    doc.text(ansLines, detailMargin, y);
    y += (ansLines.length * lineSpacing);

    // Render Key (Warna biru tetap digunakan)
    doc.setTextColor(37, 99, 235);
    const keyLines = doc.splitTextToSize(`Kunci Jawaban: ${keyText}`, detailWidth);
    doc.text(keyLines, detailMargin, y);
    y += (keyLines.length * lineSpacing);

    // Render Explanation (Warna abu-abu tetap digunakan)
    doc.setTextColor(100, 116, 139);
    const expLines = doc.splitTextToSize(`Pembahasan: ${explanationText}`, detailWidth);
    doc.text(expLines, detailMargin, y);
    y += (expLines.length * lineSpacing) + 8; 

    // Garis Pemisah Tipis
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
  }

  // Branding Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak melalui EduCBT Pro v1.2 • ${new Date().toLocaleString('id-ID')}`, marginX, pageHeight - 10);

  doc.save(`Hasil_Ujian_${identity.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: string, token?: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`BANK SOAL - ${token || 'SEMUA'}`, 105, 20, { align: 'center' });
  
  let y = 35;
  doc.setFontSize(10);

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
