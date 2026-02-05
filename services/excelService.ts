
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
      return q.correctAnswer
        .map((val: boolean) => (val === true ? 'B' : 'S'))
        .join(', ');
    }
  }
  
  return String(q.correctAnswer || '-');
};

const cleanText = (text: string): string => {
  if (!text) return '';
  const cleaned = text.toString().replace(/"/g, '""').replace(/\n/g, ' ').replace(/;/g, ',');
  return `"${cleaned}"`;
};

export const exportQuestionsToExcel = (questions: Question[], fileName: string) => {
  if (questions.length === 0) return;

  const headers = [
    'No', 'Tipe Soal', 'Level', 'Materi', 'Teks Soal', 'Gambar Soal (URL)',
    'Opsi A', 'Gambar Opsi A (URL)', 'Opsi B', 'Gambar Opsi B (URL)',
    'Opsi C', 'Gambar Opsi C (URL)', 'Opsi D', 'Gambar Opsi D (URL)',
    'Opsi E', 'Gambar Opsi E (URL)', 'Kunci Jawaban', 'Pembahasan', 'Token Paket'
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
    ].join(';');
  });

  const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
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

/**
 * Ekspor hasil pengerjaan siswa ke Excel (Rekap Ringkas)
 */
export const exportSubmissionsToExcel = (submissions: any[], fileName: string, questionBank: Question[] = []) => {
  if (!submissions || submissions.length === 0) return;

  const headers = [
    'No',
    'Nama Lengkap',
    'Kelas',
    'Asal Sekolah',
    'ID Token',
    'Mapel',
    'Nilai',
    'Tanggal',
    'Waktu Selesai'
  ];

  const rows = submissions.map((s, idx) => {
    const token = (s.subject_token || s.subject || '-').toUpperCase();
    let realSubjectName = s.subject_name;
    
    if (!realSubjectName || realSubjectName.toUpperCase() === token) {
      const matchInBank = questionBank.find(q => q.quizToken?.toUpperCase() === token);
      if (matchInBank) realSubjectName = matchInBank.subject;
      else realSubjectName = s.subject_name || s.subject || 'Ujian Digital';
    }

    const dateObj = s.timestamp ? new Date(s.timestamp) : null;
    const formattedDate = dateObj ? dateObj.toLocaleDateString('id-ID') : '-';
    const formattedTime = dateObj ? dateObj.toLocaleTimeString('id-ID') : '-';

    return [
      idx + 1,
      `"${s.student_name}"`,
      `"${s.class_name}"`,
      `"${s.school_origin || '-'}"`,
      `"${token}"`,
      `"${realSubjectName}"`,
      s.score.toFixed(1).replace('.', ','),
      `"${formattedDate}"`,
      `"${formattedTime}"`
    ].join(';');
  });

  const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
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

/**
 * Ekspor Data Lengkap (Full CSV) untuk Analisis Butir Soal
 */
export const exportFullSubmissionsToCSV = (submissions: any[], fileName: string) => {
  if (!submissions || submissions.length === 0) return;

  // Header mencakup data identitas dan data jawaban mentah (JSON)
  const headers = [
    'SubmissionID',
    'Nama Siswa',
    'Kelas',
    'Sekolah',
    'Token Ujian',
    'Skor Akhir',
    'Timestamp',
    'Raw_Answers_JSON'
  ];

  const rows = submissions.map(s => {
    return [
      `"${s.id}"`,
      `"${s.student_name}"`,
      `"${s.class_name}"`,
      `"${s.school_origin || '-'}"`,
      `"${(s.subject_token || s.subject || '').toUpperCase()}"`,
      s.score.toFixed(2).replace('.', ','),
      `"${new Date(s.timestamp).toISOString()}"`,
      `"${JSON.stringify(s.answers).replace(/"/g, '""')}"`
    ].join(';');
  });

  const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}_FULL_ANALYSIS.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
