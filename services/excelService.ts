
import { Question, QuestionType } from '../types';
import * as XLSX from 'xlsx';

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
  
  if (q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
    if (Array.isArray(q.correctAnswer)) {
      const labels = q.tfLabels || { true: 'B', false: 'S' };
      return q.correctAnswer
        .map((val: boolean) => (val === true ? labels.true[0] : labels.false[0]))
        .join(', ');
    }
  }
  
  return String(q.correctAnswer || '-');
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
  if (q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
    if (!Array.isArray(q.correctAnswer) || !Array.isArray(studentAnswer)) return false;
    return q.correctAnswer.length === studentAnswer.length && q.correctAnswer.every((v:any, i:number) => v === studentAnswer[i]);
  }
  return false;
};

const cleanTextRaw = (text: string): string => {
  if (!text) return '';
  return text.toString().replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
};

export const exportMultiSheetAnalysis = (submissions: any[], questions: Question[], fileName: string) => {
  if (!submissions || submissions.length === 0 || !questions || questions.length === 0) {
    alert("Data tidak lengkap untuk membuat laporan analisis.");
    return;
  }

  // --- SHEET 1: DATA SISWA & JAWABAN ---
  const studentRows = submissions.map((s, idx) => {
    const row: any = {
      'No': idx + 1,
      'Nama Siswa': s.student_name,
      'Kelas': s.class_name,
      'Sekolah': s.school_origin || '-',
      'Skor Akhir': s.score.toFixed(1),
      'Waktu Selesai': new Date(s.timestamp).toLocaleString('id-ID'),
    };

    // Tambahkan kolom jawaban per nomor
    questions.forEach((q, qIdx) => {
      const ans = s.answers?.[q.id];
      const isCorrect = checkCorrectness(q, ans);
      const label = `Soal ${qIdx + 1}`;
      
      let displayAns = "";
      if (ans === undefined || ans === null) displayAns = "KOSONG";
      else if (q.type === QuestionType.SINGLE) displayAns = indexToAlpha(ans);
      else displayAns = JSON.stringify(ans);

      row[label] = displayAns;
      row[`Status ${qIdx + 1}`] = isCorrect ? 'BENAR' : 'SALAH';
    });

    return row;
  });

  // --- SHEET 2: REFERENSI SOAL & KUNCI ---
  const questionRows = questions.map((q, idx) => {
    const options = q.options || [];
    const optImages = q.optionImages || [];
    return {
      'No': q.order || idx + 1,
      'ID Soal': q.id,
      'Tipe': q.type,
      'Level': q.level || '-',
      'Butir Pertanyaan': cleanTextRaw(q.text),
      'Gambar Soal (URL)': q.questionImage || '',
      'Opsi A': cleanTextRaw(options[0] || ''),
      'Gambar Opsi A (URL)': optImages[0] || '',
      'Opsi B': cleanTextRaw(options[1] || ''),
      'Gambar Opsi B (URL)': optImages[1] || '',
      'Opsi C': cleanTextRaw(options[2] || ''),
      'Gambar Opsi C (URL)': optImages[2] || '',
      'Opsi D': cleanTextRaw(options[3] || ''),
      'Gambar Opsi D (URL)': optImages[3] || '',
      'Opsi E': cleanTextRaw(options[4] || ''),
      'Gambar Opsi E (URL)': optImages[4] || '',
      'Kunci Jawaban': formatCorrectAnswer(q),
      'Pembahasan': cleanTextRaw(q.explanation || 'Tidak ada pembahasan.')
    };
  });

  // Buat Workbook
  const wb = XLSX.utils.book_new();
  
  const wsStudents = XLSX.utils.json_to_sheet(studentRows);
  const wsQuestions = XLSX.utils.json_to_sheet(questionRows);

  XLSX.utils.book_append_sheet(wb, wsStudents, "HASIL_SISWA");
  XLSX.utils.book_append_sheet(wb, wsQuestions, "REFERENSI_SOAL");

  // Download
  XLSX.writeFile(wb, `${fileName}.xlsx`);
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
      (q.material || '-').replace(/;/g, ','),
      (q.text || '').replace(/;/g, ','),
      q.questionImage || '',
      (options[0] || '').replace(/;/g, ','), optImages[0] || '',
      (options[1] || '').replace(/;/g, ','), optImages[1] || '',
      (options[2] || '').replace(/;/g, ','), optImages[2] || '',
      (options[3] || '').replace(/;/g, ','), optImages[3] || '',
      (options[4] || '').replace(/;/g, ','), optImages[4] || '',
      formatCorrectAnswer(q),
      (q.explanation || '').replace(/;/g, ','),
      (q.quizToken || '-')
    ].join(';');
  });

  const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.click();
};

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
    return [
      idx + 1,
      `"${s.student_name}"`,
      `"${s.class_name}"`,
      `"${s.school_origin || '-'}"`,
      `"${s.subject_token || s.subject || '-'}"`,
      `"${s.subject_name || 'Ujian Digital'}"`,
      s.score.toFixed(1),
      new Date(s.timestamp).toLocaleDateString('id-ID'),
      new Date(s.timestamp).toLocaleTimeString('id-ID')
    ].join(';');
  });

  const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.click();
};

export const exportFullSubmissionsToCSV = (submissions: any[], fileName: string) => {
    if (!submissions || submissions.length === 0) return;

    const allKeys = new Set<string>();
    submissions.forEach(s => {
        if (s.answers) Object.keys(s.answers).forEach(k => allKeys.add(k));
    });
    const sortedKeys = Array.from(allKeys).sort();

    const headers = [
        'Nama Siswa', 'Kelas', 'Sekolah', 'Skor Akhir', 'Waktu Selesai',
        ...sortedKeys.map(k => `Q_${k}`)
    ];

    const rows = submissions.map(s => {
        const answers = s.answers || {};
        const answerCols = sortedKeys.map(k => {
            const ans = answers[k];
            if (ans === undefined || ans === null) return '';
            return `"${JSON.stringify(ans).replace(/"/g, '""')}"`;
        });

        return [
            `"${s.student_name}"`,
            `"${s.class_name}"`,
            `"${s.school_origin || '-'}"`,
            s.score.toFixed(1),
            new Date(s.timestamp).toLocaleString('id-ID'),
            ...answerCols
        ].join(';');
    });

    const csvContent = "sep=;\n" + "\uFEFF" + headers.join(';') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${fileName}.csv`);
    link.click();
};
