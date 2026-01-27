
import { Question, QuestionType } from '../types';

const indexToAlpha = (idx: number) => String.fromCharCode(65 + idx);

const formatCorrectAnswer = (q: Question): string => {
  if (q.type === QuestionType.SINGLE) {
    return typeof q.correctAnswer === 'number' ? indexToAlpha(q.correctAnswer) : '-';
  }
  
  if (q.type === QuestionType.MULTIPLE) {
    if (Array.isArray(q.correctAnswer)) {
      return q.correctAnswer
        .map((idx: number) => indexToAlpha(idx))
        .sort()
        .join(', ');
    }
  }
  
  if (q.type === QuestionType.COMPLEX_CATEGORY || q.type === QuestionType.TRUE_FALSE_COMPLEX) {
    if (Array.isArray(q.correctAnswer)) {
      // Sesuai screenshot: B = Benar/Sesuai, S = Salah/Tidak Sesuai
      return q.correctAnswer
        .map((val: boolean) => (val === true ? 'B' : 'S'))
        .join(', ');
    }
  }
  
  return String(q.correctAnswer || '-');
};

const cleanText = (text: string): string => {
  if (!text) return '';
  // Menghapus karakter yang bisa merusak format CSV dan membungkus dengan kutip ganda
  const cleaned = text.toString().replace(/"/g, '""').replace(/\n/g, ' ');
  return `"${cleaned}"`;
};

export const exportQuestionsToExcel = (questions: Question[], fileName: string) => {
  if (questions.length === 0) return;

  // Header 19 Kolom sesuai permintaan
  const headers = [
    'No', 
    'Tipe Soal', 
    'Level', 
    'Materi', 
    'Teks Soal', 
    'Gambar Soal (URL)',
    'Opsi A', 
    'Gambar Opsi A (URL)',
    'Opsi B', 
    'Gambar Opsi B (URL)',
    'Opsi C', 
    'Gambar Opsi C (URL)',
    'Opsi D', 
    'Gambar Opsi D (URL)',
    'Opsi E', 
    'Gambar Opsi E (URL)',
    'Kunci Jawaban', 
    'Pembahasan',
    'Token Paket'
  ];

  const rows = questions.map((q, idx) => {
    const options = q.options || [];
    const optImages = q.optionImages || [];

    return [
      q.order || idx + 1,
      q.type,
      q.level || '-',
      cleanText(q.material || '-'),
      cleanText(q.text),
      q.questionImage || '',
      cleanText(options[0] || ''), optImages[0] || '',
      cleanText(options[1] || ''), optImages[1] || '',
      cleanText(options[2] || ''), optImages[2] || '',
      cleanText(options[3] || ''), optImages[3] || '',
      cleanText(options[4] || ''), optImages[4] || '',
      cleanText(formatCorrectAnswer(q)),
      cleanText(q.explanation || ''),
      cleanText(q.quizToken || '-')
    ].join(',');
  });

  // UTF-8 BOM agar Excel mengenali karakter lokal dengan benar
  const csvContent = "\uFEFF" + headers.join(',') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
