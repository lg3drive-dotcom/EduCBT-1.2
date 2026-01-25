
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

  doc.setFillColor(30, 41, 59); 
  doc.rect(0, 0, pageWidth, 55, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text('LAPORAN HASIL UJIAN', pageWidth / 2, 18, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Nama: ${identity.name.toUpperCase()}`, margin, 33);
  doc.text(`Kelas: ${identity.className}`, margin, 38);
  doc.text(`Waktu: ${new Date(timestamp).toLocaleString('id-ID')}`, margin, 43);
  
  doc.setFillColor(37, 99, 235); 
  doc.roundedRect(pageWidth - 55, 15, 40, 22, 3, 3, 'F');
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`${score.toFixed(1)}`, pageWidth - 35, 31, { align: 'center' });

  let yPos = 65;
  doc.setTextColor(0, 0, 0);

  questions.forEach((q, idx) => {
    const studentAns = answers[q.id];
    const isCorrect = checkCorrectness(q, studentAns);
    const fullStudentAns = getFullAnswerText(q, studentAns, false);
    const fullKeyText = getFullAnswerText(q, undefined, true);
    
    doc.setFontSize(9);
    const qLines = doc.splitTextToSize(`${idx + 1}. ${q.text}`, contentWidth - 40);
    const itemHeight = (qLines.length * 5) + 30;

    if (yPos + itemHeight > pageHeight - 15) {
      doc.addPage();
      yPos = 15;
    }

    doc.setDrawColor(226, 232, 240); 
    doc.rect(margin, yPos, contentWidth, itemHeight);
    
    doc.setFont("helvetica", "bold");
    doc.text(qLines, margin + 5, yPos + 8);
    
    doc.setFont("helvetica", "normal");
    doc.text(`Jawaban: ${fullStudentAns}`, margin + 5, yPos + 18 + (qLines.length * 2));
    doc.setTextColor(22, 101, 52);
    doc.text(`Kunci: ${fullKeyText}`, margin + 5, yPos + 24 + (qLines.length * 2));
    doc.setTextColor(0, 0, 0);

    yPos += itemHeight + 5;
  });

  doc.save(`Hasil_${identity.name}.pdf`);
};

export const generateQuestionBankPDF = (questions: Question[], mode: 'kisi' | 'soal' | 'lengkap', subject?: Subject, token?: string) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  doc.setFontSize(14);
  doc.text(`BANK SOAL - ${token || 'SEMUA'}`, 105, 20, { align: 'center' });
  
  let y = 30;
  questions.forEach((q, i) => {
    doc.setFontSize(10);
    doc.text(`${q.order}. ${q.text}`, 20, y);
    y += 10;
    if (y > 270) { doc.addPage(); y = 20; }
  });
  
  doc.save(`BankSoal_${token || 'Export'}.pdf`);
};
