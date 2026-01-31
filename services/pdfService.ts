
import { jsPDF } from 'jspdf';
import { QuizResult, Question, QuestionType } from '../types';

/**
 * Fungsi utilitas untuk mengubah URL gambar menjadi Base64 secara asinkron
 * Penting agar jsPDF bisa merender gambar dari URL eksternal.
 */
const getImageBase64 = async (url: string): Promise<string | null> => {
  if (!url) return null;
  // Jika sudah base64, langsung kembalikan
  if (url.startsWith('data:')) return url;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Gagal mengambil gambar dari server');
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("PDF Image Fetch Error:", url, err);
    return null;
  }
};

/**
 * Fungsi untuk mengubah notasi LaTeX sederhana menjadi teks yang rapi untuk PDF
 */
const cleanMathForPDF = (text: string): string => {
  if (!text) return "";
  
  return text
    .replace(/\$\$(.*?)\$\$/g, '$1')
    .replace(/\$(.*?)\$/g, '$1')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\neq/g, '≠')
    .replace(/\\le/g, '≤')
    .replace(/\\ge/g, '≥')
    .replace(/\\approx/g, '≈')
    .replace(/\\infty/g, '∞')
    .replace(/\^2/g, '²')
    .replace(/\^3/g, '³')
    .replace(/\^1/g, '¹')
    .replace(/\^0/g, '⁰')
    .replace(/\\sqrt\{(.*?)\}/g, '√($1)')
    .replace(/\\frac\{(.*?)\}\{(.*?)\}/g, '$1/$2')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\pi/g, 'π')
    .replace(/\\degree/g, '°')
    .replace(/\\quad/g, '    ')
    .replace(/\\ /g, ' ')
    .replace(/\\/g, '');
};

const getFullAnswerText = (q: Question, answerValue?: any, isKey: boolean = false): string => {
  const targetAnswer = isKey ? q.correctAnswer : answerValue;
  if (targetAnswer === undefined || targetAnswer === null) return "-";

  let rawText = "-";
  if (q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX) {
    if (Array.isArray(targetAnswer)) {
      const labels = q.tfLabels || { true: 'Ya', false: 'Tidak' };
      rawText = q.options?.map((opt, i) => {
        const val = targetAnswer[i];
        const textVal = val === true ? labels.true : val === false ? labels.false : '-';
        return `[${opt}: ${textVal}]`;
      }).join(", ") || "-";
    }
  } else if (q.options) {
    if (Array.isArray(targetAnswer)) {
      rawText = targetAnswer.map(i => q.options?.[i]).join(", ");
    } else {
      rawText = q.options[targetAnswer] !== undefined ? q.options[targetAnswer] : "-";
    }
  }

  return cleanMathForPDF(rawText);
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
  const lineSpacing = 5;

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

  // Score Badge
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
    
    const cleanQText = cleanMathForPDF(q.text);
    const studentText = getFullAnswerText(q, studentAns, false);
    const keyText = getFullAnswerText(q, undefined, true);
    const explanationText = cleanMathForPDF(q.explanation || "Tidak ada pembahasan.");

    doc.setFontSize(bodyFontSize);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);

    const qLines = doc.splitTextToSize(`${idx + 1}. ${cleanQText}`, contentWidth);
    const qHeight = qLines.length * lineSpacing;

    let estimatedHeight = qHeight + 40; 
    if (q.questionImage) estimatedHeight += 50;

    if (y + estimatedHeight > pageHeight - 20) {
      doc.addPage();
      y = 20;
    }

    doc.text(qLines, marginX, y);
    y += qHeight + 4;

    // FIX: Penanganan Gambar dengan Await Base64
    if (q.questionImage) {
      try {
        const base64Img = await getImageBase64(q.questionImage);
        if (base64Img) {
          const imgWidth = 80;
          const imgHeight = 45;
          const format = base64Img.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
          doc.addImage(base64Img, format, marginX, y, imgWidth, imgHeight);
          y += imgHeight + 6;
        } else {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("[Gambar gagal dimuat]", marginX, y);
          y += 6;
        }
      } catch (e) {
        console.warn("PDF Image Error:", e);
      }
    }

    const detailMargin = marginX + 5;
    const detailWidth = contentWidth - 5;

    // Jawaban Siswa
    doc.setFont("helvetica", "bold");
    if (isCorrect) doc.setTextColor(22, 163, 74); else doc.setTextColor(220, 38, 38);
    const ansLines = doc.splitTextToSize(`Jawaban Anda: ${studentText}`, detailWidth);
    doc.text(ansLines, detailMargin, y);
    y += (ansLines.length * lineSpacing);

    // Kunci Jawaban
    doc.setFont("helvetica", "normal");
    doc.setTextColor(37, 99, 235);
    const keyLines = doc.splitTextToSize(`Kunci Jawaban: ${keyText}`, detailWidth);
    doc.text(keyLines, detailMargin, y);
    y += (keyLines.length * lineSpacing);

    // Pembahasan
    doc.setTextColor(100, 116, 139);
    const expLines = doc.splitTextToSize(`Pembahasan: ${explanationText}`, detailWidth);
    doc.text(expLines, detailMargin, y);
    y += (expLines.length * lineSpacing) + 8; 

    doc.setDrawColor(241, 245, 249);
    doc.line(marginX, y - 4, pageWidth - marginX, y - 4);
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Dicetak melalui EduCBT Pro v1.2 • ${new Date().toLocaleString('id-ID')}`, marginX, pageHeight - 10);

  doc.save(`Hasil_Ujian_${identity.name.replace(/\s+/g, '_')}.pdf`);
};

export const generateQuestionBankPDF = async (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: string, token?: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(`BANK SOAL - ${token || 'SEMUA'}`, 105, 20, { align: 'center' });
  
  let y = 35;
  doc.setFontSize(10);

  for (const q of questions) {
    const cleanQText = cleanMathForPDF(q.text);
    const textLines = doc.splitTextToSize(`${q.order}. ${cleanQText}`, 170);
    const itemHeight = (textLines.length * 5) + (q.questionImage ? 55 : 10);

    if (y + itemHeight > 275) { 
      doc.addPage(); 
      y = 25; 
    }

    doc.text(textLines, 20, y);
    y += (textLines.length * 5) + 2;

    if (q.questionImage) {
      const base64 = await getImageBase64(q.questionImage);
      if (base64) {
        const format = base64.toLowerCase().includes('png') ? 'PNG' : 'JPEG';
        doc.addImage(base64, format, 20, y, 80, 45);
        y += 50;
      }
    }
    y += 5;
  }
  
  doc.save(`BankSoal_${token || 'Export'}.pdf`);
};
