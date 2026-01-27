
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
  const marginX = 20; // Margin lebih lebar agar aman
  const contentWidth = pageWidth - (marginX * 2);

  // --- HEADER ---
  doc.setFillColor(15, 23, 42); 
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text('HASIL EVALUASI SISWA', marginX, 22);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`NAMA LENGKAP      : ${identity.name.toUpperCase()}`, marginX, 34);
  doc.text(`KELAS / ROMBEL     : ${identity.className}`, marginX, 40);
  doc.text(`TANGGAL UJIAN    : ${new Date(timestamp).toLocaleString('id-ID')}`, marginX, 46);

  // Score Badge
  doc.setFillColor(37, 99, 235);
  doc.roundedRect(pageWidth - 60, 15, 40, 25, 3, 3, 'F');
  doc.setFontSize(8);
  doc.text('NILAI AKHIR', pageWidth - 40, 22, { align: 'center' });
  doc.setFontSize(20);
  doc.text(`${score.toFixed(1)}`, pageWidth - 40, 33, { align: 'center' });

  let y = 65;

  for (const [idx, q] of questions.entries()) {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    const studentText = getFullAnswerText(q, studentAns, false);
    const keyText = getFullAnswerText(q, undefined, true);
    const explanationText = q.explanation || "Tidak ada pembahasan.";

    // 1. Hitung Baris Soal (Font Bold)
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth);
    const qHeight = qLines.length * 5;

    // 2. Cek apakah muat di halaman ini?
    let estimatedHeight = qHeight + 35; // Estimasi dasar termasuk detail jawaban
    if (q.questionImage) estimatedHeight += 50; // Tambah jika ada gambar

    if (y + estimatedHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }

    // Border Blok Soal (Soft Background)
    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(252, 253, 255);
    // Draw background placeholder (will adjust later if needed, but for list it's fine)

    // Render Soal
    doc.setTextColor(15, 23, 42);
    doc.text(qLines, marginX, y);
    y += qHeight + 3;

    // Render Gambar Stimulus jika ada
    if (q.questionImage) {
      try {
        // Simple heuristic: assume image fits in 80mm width
        const imgWidth = 80;
        const imgHeight = 45;
        doc.addImage(q.questionImage, 'JPEG', marginX + 5, y, imgWidth, imgHeight);
        y += imgHeight + 5;
      } catch (e) {
        console.warn("PDF Image Load Error", e);
      }
    }

    // Detail Jawaban & Pembahasan (Lebar dikurangi karena indentasi)
    const detailMargin = marginX + 8;
    const detailWidth = contentWidth - 10;
    doc.setFontSize(9);

    // Render Student Answer
    doc.setFont("helvetica", "bold");
    if (isCorrect) doc.setTextColor(22, 163, 74); else doc.setTextColor(220, 38, 38);
    const ansLines = doc.splitTextToSize(`Jawaban Anda: ${studentText}`, detailWidth);
    doc.text(ansLines, detailMargin, y);
    y += (ansLines.length * 4.5) + 1;

    // Render Key
    doc.setFont("helvetica", "normal");
    doc.setTextColor(37, 99, 235);
    const keyLines = doc.splitTextToSize(`Kunci Jawaban: ${keyText}`, detailWidth);
    doc.text(keyLines, detailMargin, y);
    y += (keyLines.length * 4.5) + 1;

    // Render Explanation
    doc.setFont("helvetica", "italic");
    doc.setTextColor(100, 116, 139);
    const expLines = doc.splitTextToSize(`Pembahasan: ${explanationText}`, detailWidth);
    doc.text(expLines, detailMargin, y);
    y += (expLines.length * 4.5) + 10; // Extra space between questions

    // Horizontal Separator
    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y - 5, pageWidth - marginX, y - 5);
  }

  // Branding Footer
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak melalui EduCBT Pro v1.2 • ${new Date().toLocaleString('id-ID')}`, marginX, pageHeight - 10);

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
