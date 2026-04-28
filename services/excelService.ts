
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
      const labels = q.tfLabels || { true: 'Benar', false: 'Salah' };
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
      'NPSN': s.school_origin || '-',
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
    'No', 'Tipe Soal', 'Level', 'Mata Pelajaran', 'Materi', 'Teks Soal', 'Gambar Soal (URL)',
    'Opsi A', 'Gambar Opsi A (URL)', 'Opsi B', 'Gambar Opsi B (URL)',
    'Opsi C', 'Gambar Opsi C (URL)', 'Opsi D', 'Gambar Opsi D (URL)',
    'Opsi E', 'Gambar Opsi E (URL)', 'Kunci Jawaban', 'Pembahasan', 'Token Paket'
  ];

  const questionRows = questions.map((q, idx) => {
    const options = q.options || [];
    const optImages = q.optionImages || [];
    return {
      'No': q.order || idx + 1,
      'Tipe Soal': q.type,
      'Level': q.level || '-',
      'Mata Pelajaran': q.subject || '-',
      'Materi': (q.material || '-'),
      'Teks Soal': (q.text || ''),
      'Gambar Soal (URL)': q.questionImage || '',
      'Opsi A': (options[0] || ''),
      'Gambar Opsi A (URL)': optImages[0] || '',
      'Opsi B': (options[1] || ''),
      'Gambar Opsi B (URL)': optImages[1] || '',
      'Opsi C': (options[2] || ''),
      'Gambar Opsi C (URL)': optImages[2] || '',
      'Opsi D': (options[3] || ''),
      'Gambar Opsi D (URL)': optImages[3] || '',
      'Opsi E': (options[4] || ''),
      'Gambar Opsi E (URL)': optImages[4] || '',
      'Kunci Jawaban': formatCorrectAnswer(q),
      'Pembahasan': (q.explanation || ''),
      'Token Paket': (q.quizToken || '-')
    };
  });

  const ws = XLSX.utils.json_to_sheet(questionRows, { header: headers });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "BANK_SOAL");

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const importQuestionsFromExcel = (file: File): Promise<Question[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const alphaToIndex = (alpha: string) => {
          const char = alpha.trim().toUpperCase().charAt(0);
          return char.charCodeAt(0) - 65;
        };

        const parsedQuestions: Question[] = json.map((row, idx) => {
          const typeStr = String(row['Tipe Soal'] || '').trim();
          let type = QuestionType.SINGLE;
          
          if (typeStr.toLocaleLowerCase().includes('kompleks') || typeStr.toLocaleLowerCase().includes('jamak')) {
            type = QuestionType.MULTIPLE;
          } else if (typeStr.toLocaleLowerCase().includes('benar') || typeStr.toLocaleLowerCase().includes('salah')) {
            type = QuestionType.TRUE_FALSE;
          } else if (typeStr.toLocaleLowerCase().includes('sesuai')) {
            type = QuestionType.MATCH;
          } else {
            type = QuestionType.SINGLE;
          }

          const rawKey = String(row['Kunci Jawaban'] || '');
          
          let correctAnswer: any = 0;
          if (type === QuestionType.MULTIPLE) {
            correctAnswer = rawKey.split(',').map(s => alphaToIndex(s.trim()));
          } else if (type === QuestionType.TRUE_FALSE || type === QuestionType.MATCH) {
             // Expecting T, F, T or B, S, B
             correctAnswer = rawKey.split(',').map(s => {
               const val = s.trim().toUpperCase();
               return val === 'T' || val === 'B' || val === 'TRUE' || val === 'BENAR';
             });
          } else {
            correctAnswer = alphaToIndex(rawKey);
          }

          const options = [
            row['Opsi A'], row['Opsi B'], row['Opsi C'], row['Opsi D'], row['Opsi E']
          ].filter(o => o !== undefined && o !== '').map(o => String(o));

          const optionImages = [
            row['Gambar Opsi A (URL)'], row['Gambar Opsi B (URL)'], row['Gambar Opsi C (URL)'], row['Gambar Opsi D (URL)'], row['Gambar Opsi E (URL)']
          ].map(img => img ? String(img) : undefined);

          return {
            id: `imported-${Date.now()}-${idx}`,
            text: String(row['Teks Soal'] || ''),
            material: String(row['Materi'] || ''),
            explanation: String(row['Pembahasan'] || ''),
            questionImage: row['Gambar Soal (URL)'] ? String(row['Gambar Soal (URL)']) : undefined,
            type: type as QuestionType,
            level: String(row['Level'] || 'C1'),
            options: options,
            optionImages: optionImages.slice(0, options.length),
            correctAnswer: correctAnswer,
            subject: String(row['Mata Pelajaran'] || row['Materi'] || 'Umum'),
            phase: 'Fase C',
            order: Number(row['No']) || idx + 1,
            quizToken: String(row['Token Paket'] || 'UJI01').trim().toUpperCase(),
            tfLabels: { true: 'Benar', false: 'Salah' }, // Default Benar/Salah handles custom logic
            createdAt: Date.now()
          };
        });

        resolve(parsedQuestions);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const exportSubmissionsToExcel = (submissions: any[], fileName: string, questionBank: Question[] = []) => {
  if (!submissions || submissions.length === 0) return;

  const headers = [
    'No',
    'Nama Lengkap',
    'Kelas',
    'NPSN',
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
        'Nama Siswa', 'Kelas', 'NPSN', 'Skor Akhir', 'Waktu Selesai',
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

export const downloadImportTemplate = () => {
  const headers = [
    'No', 'Tipe Soal', 'Level', 'Mata Pelajaran', 'Materi', 'Teks Soal', 'Gambar Soal (URL)',
    'Opsi A', 'Gambar Opsi A (URL)', 'Opsi B', 'Gambar Opsi B (URL)',
    'Opsi C', 'Gambar Opsi C (URL)', 'Opsi D', 'Gambar Opsi D (URL)',
    'Opsi E', 'Gambar Opsi E (URL)', 'Kunci Jawaban', 'Pembahasan', 'Token Paket'
  ];

  const samples = [
    {
      'No': 1,
      'Tipe Soal': '(Pilihan Ganda)',
      'Level': 'C3',
      'Mata Pelajaran': 'PKN',
      'Materi': 'Pancasila',
      'Teks Soal': 'Apa lambang sila ke-2?',
      'Gambar Soal (URL)': '',
      'Opsi A': 'Bintang',
      'Gambar Opsi A (URL)': '',
      'Opsi B': 'Rantai',
      'Gambar Opsi B (URL)': '',
      'Opsi C': 'Pohon Beringin',
      'Gambar Opsi C (URL)': '',
      'Opsi D': 'Kepala Banteng',
      'Gambar Opsi D (URL)': '',
      'Opsi E': 'Padi dan Kapas',
      'Gambar Opsi E (URL)': '',
      'Kunci Jawaban': 'B',
      'Pembahasan': 'Sila ke-2 berlambang Rantai.',
      'Token Paket': 'UJI01'
    },
    {
      'No': 2,
      'Tipe Soal': '(PG Kompleks)',
      'Level': 'C4',
      'Mata Pelajaran': 'IPA',
      'Materi': 'Ekosistem',
      'Teks Soal': 'Mana yang termasuk produsen?',
      'Opsi A': 'Padi', 'Opsi B': 'Rumput', 'Opsi C': 'Ulat', 'Opsi D': 'Elang', 'Opsi E': 'Lumut',
      'Kunci Jawaban': 'A, B, E',
      'Pembahasan': 'Padi, rumput, dan lumut berfotosintesis.',
      'Token Paket': 'UJI01'
    },
    {
      'No': 3,
      'Tipe Soal': '(Benar/Salah)',
      'Level': 'C2',
      'Mata Pelajaran': 'IPA',
      'Materi': 'Biologi',
      'Teks Soal': 'Tentukan pernyataan berikut benar atau salah:',
      'Opsi A': 'Ikan bernapas dengan paru-paru',
      'Opsi B': 'Mamalia menyusui anaknya',
      'Opsi C': 'Burung adalah reptil',
      'Kunci Jawaban': 'S, B, S',
      'Pembahasan': 'Ikan pakai insang, burung aves.',
      'Token Paket': 'UJI01'
    },
    {
      'No': 4,
      'Tipe Soal': '(Sesuai/Tidak Sesuai)',
      'Level': 'C2',
      'Mata Pelajaran': 'IPS',
      'Materi': 'Geografi',
      'Teks Soal': 'Pasangkan pernyataan dengan kategorinya:',
      'Opsi A': 'Jakarta - Ibu Kota Indonesia',
      'Opsi B': 'Surabaya - Ibu Kota Jawa Barat',
      'Kunci Jawaban': 'B, S',
      'Pembahasan': 'Surabaya Ibu Kota Jawa Timur.',
      'Token Paket': 'UJI01'
    }
  ];

  const instructions = [
    { 'Kolom': 'Tipe Soal', 'Penjelasan': 'Wajib diisi: (Pilihan Ganda), (PG Kompleks), (Benar/Salah), atau (Sesuai/Tidak Sesuai)' },
    { 'Kolom': 'Mata Pelajaran', 'Penjelasan': 'Contoh: IPA, IPS, MATEMATIKA, PKN, dll.' },
    { 'Kolom': 'Kunci Jawaban (PG)', 'Penjelasan': 'Cukup satu huruf: A atau B atau C atau D atau E' },
    { 'Kolom': 'Kunci Jawaban (PG Kompleks)', 'Penjelasan': 'Gunakan koma: A, C, D (jawaban benar lebih dari satu)' },
    { 'Kolom': 'Kunci Jawaban (B/S & Sesuai)', 'Penjelasan': 'Gunakan B (Benar) atau S (Salah) dipisah koma sesuai urutan Opsi. Contoh: B, S, B' },
    { 'Kolom': 'Opsi', 'Penjelasan': 'Untuk B/S dan Sesuai, setiap baris pernyataan diletakkan di Opsi A, B, C, dst.' },
    { 'Kolom': 'Token Paket', 'Penjelasan': 'Digunakan untuk mengelompokkan soal (misal: PAS2024)' }
  ];

  const ws = XLSX.utils.json_to_sheet(samples, { header: headers });
  const wsInfo = XLSX.utils.json_to_sheet(instructions);
  
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template_Soal");
  XLSX.utils.book_append_sheet(wb, wsInfo, "Petunjuk_Pengisian");

  XLSX.writeFile(wb, "Template_Impor_Soal.xlsx");
};
