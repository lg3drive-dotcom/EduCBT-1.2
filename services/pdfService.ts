
import { jsPDF } from 'jspdf';
import { QuizResult, Question, QuestionType } from '../types';
import { normalizeImageUrl } from '../utils.ts';

/**
 * Fungsi utilitas untuk mengubah URL gambar menjadi Base64 secara asinkron
 * Penting agar jsPDF bisa merender gambar dari URL eksternal.
 */
const getImageBase64 = async (url: string): Promise<string | null> => {
  if (!url || typeof url !== 'string') return null;
  const trimmedUrl = normalizeImageUrl(url);
  if (!trimmedUrl) return null;

  // Jika sudah berupa data URI (base64)
  if (trimmedUrl.startsWith('data:')) return trimmedUrl;

  // Daftar kandidat URL: langsung, lalu proxy CORS wsrv.nl & images.weserv.nl
  const candidateUrls: string[] = [
    trimmedUrl,
    `https://wsrv.nl/?url=${encodeURIComponent(trimmedUrl)}&output=png`,
    `https://images.weserv.nl/?url=${encodeURIComponent(trimmedUrl)}&output=png`
  ];

  for (const candidate of candidateUrls) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      
      const response = await fetch(candidate, {
        signal: controller.signal,
        mode: 'cors',
        headers: {
          'Accept': 'image/*'
        }
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const blob = await response.blob();
        if (blob && blob.size > 0) {
          const dataUrl = await new Promise<string | null>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const res = reader.result;
              resolve(typeof res === 'string' ? res : null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
          if (dataUrl) return dataUrl;
        }
      }
    } catch {
      // Abaikan dan coba kandidat berikutnya tanpa console.error
    }
  }

  // Fallback sekunder: Gunakan Image() element dengan CrossOrigin + Canvas
  try {
    const canvasResult = await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      let done = false;

      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          img.src = '';
          resolve(null);
        }
      }, 4000);

      img.onload = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width || 300;
          canvas.height = img.naturalHeight || img.height || 200;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(null);
            return;
          }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(null);
        }
      };

      img.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(null);
      };

      // Coba load via proxy weserv
      img.src = `https://wsrv.nl/?url=${encodeURIComponent(trimmedUrl)}&output=png`;
    });

    if (canvasResult) return canvasResult;
  } catch {
    // Abaikan
  }

  // Jika tetap gagal diakses karena batasan CORS asal, beri catatan ramah (bukan console.error)
  console.warn("[PDF] Info: Gambar tidak dapat dimuat ke PDF karena pembatasan host eksternal:", trimmedUrl);
  return null;
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
  // Fix: Property 'COMPLEX_CATEGORY' and 'TRUE_FALSE_COMPLEX' do not exist on type 'typeof QuestionType'. Use MATCH and TRUE_FALSE instead.
  if (q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
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
  // Fix: Property 'COMPLEX_CATEGORY' and 'TRUE_FALSE_COMPLEX' do not exist on type 'typeof QuestionType'. Use MATCH and TRUE_FALSE instead.
  if (q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
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
  doc.text(`Dicetak melalui E-Pro CBT Pro v1.2 • ${new Date().toLocaleString('id-ID')}`, marginX, pageHeight - 10);

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
    const itemHeight = (textLines.length * 5) + (q.questionImage ? 50 : 0) + (q.bottomImage ? 50 : 0) + 10;

    if (y + itemHeight > 275) { 
      doc.addPage(); 
      y = 25; 
    }

    if (q.questionImage) {
      try {
        const base64 = await getImageBase64(q.questionImage);
        if (base64) {
          const isPng = base64.toLowerCase().startsWith('data:image/png') || base64.toLowerCase().includes('.png');
          const format = isPng ? 'PNG' : 'JPEG';
          doc.addImage(base64, format, 20, y, 80, 45);
          y += 50;
        }
      } catch {
        // Abaikan jika format gambar tidak didukung jsPDF
      }
    }

    doc.text(textLines, 20, y);
    y += (textLines.length * 5) + 2;

    if (q.bottomImage) {
      try {
        const btmBase64 = await getImageBase64(q.bottomImage);
        if (btmBase64) {
          const isPng = btmBase64.toLowerCase().startsWith('data:image/png') || btmBase64.toLowerCase().includes('.png');
          const format = isPng ? 'PNG' : 'JPEG';
          doc.addImage(btmBase64, format, 20, y, 80, 45);
          y += 50;
        }
      } catch {
        // Abaikan
      }
    }
    y += 5;
  }
  
  doc.save(`BankSoal_${token || 'Export'}.pdf`);
};

export interface ExamPdfConfig {
  institutionName: string;
  schoolName: string;
  schoolAddress: string;
  examTitle: string;
  academicYear: string;
  subjectName: string;
  className: string;
  examDate: string;
  timeAllocation: string;
  showOfficialKop: boolean;
  showInstructions: boolean;
  fontSize?: 'compact' | 'normal' | 'large';
  optionsLayout?: '1-col' | '2-col';
}

export const generateStandardExamPDF = async (
  questions: Question[], 
  config: ExamPdfConfig, 
  mode: 'student' | 'master' | 'key_only' | 'ljk', 
  token?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentWidth = pageWidth - (marginX * 2);

  let y = 15;

  const checkPageBreak = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - 15) {
      doc.addPage();
      y = 15;
      return true;
    }
    return false;
  };

  // 1. KOP NASKAH SOAL RESMI
  if (config.showOfficialKop) {
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    const instLines = doc.splitTextToSize(config.institutionName.toUpperCase(), contentWidth);
    doc.text(instLines, pageWidth / 2, y, { align: 'center' });
    y += (instLines.length * 4) + 1;

    doc.setFontSize(13);
    doc.text(config.schoolName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    y += 5;

    doc.setFont("times", "italic");
    doc.setFontSize(8);
    doc.text(config.schoolAddress, pageWidth / 2, y, { align: 'center' });
    y += 3;

    // Double line KOP
    doc.setLineWidth(0.8);
    doc.line(marginX, y, pageWidth - marginX, y);
    doc.setLineWidth(0.3);
    doc.line(marginX, y + 1, pageWidth - marginX, y + 1);
    y += 5;
  }

  // 2. JUDUL UJIAN
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.text(config.examTitle.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 4.5;
  doc.setFontSize(9.5);
  doc.text(config.academicYear.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;

  // 3. TABEL IDENTITAS
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  const col1X = marginX;
  const col2X = marginX + 28;
  const col3X = marginX + 95;
  const col4X = marginX + 125;

  doc.text("Mata Pelajaran", col1X, y);
  doc.text(`: ${config.subjectName}`, col2X, y);
  doc.text("Hari, Tanggal", col3X, y);
  doc.text(`: ${config.examDate}`, col4X, y);
  y += 4;

  doc.text("Kelas / Fase", col1X, y);
  doc.text(`: ${config.className}`, col2X, y);
  doc.text("Alokasi Waktu", col3X, y);
  doc.text(`: ${config.timeAllocation}`, col4X, y);
  y += 4;

  doc.text("Kode / Token", col1X, y);
  doc.text(`: ${token || '-'}`, col2X, y);
  doc.text("Nama Peserta", col3X, y);
  doc.text(`: .......................................`, col4X, y);
  y += 6;

  // 4. PETUNJUK UMUM
  if (config.showInstructions) {
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.2);
    doc.rect(marginX, y, contentWidth, 22);

    doc.setFont("times", "bold");
    doc.setFontSize(8);
    doc.text("PETUNJUK UMUM:", marginX + 2, y + 4);

    doc.setFont("times", "normal");
    doc.setFontSize(7.5);
    doc.text("1. Berdoalah sebelum mulai mengerjakan soal. | 2. Tulis nama dan nomor pada lembar jawaban.", marginX + 2, y + 8);
    doc.text("3. Periksa dan bacalah setiap butir soal dengan saksama sebelum menjawab.", marginX + 2, y + 12);
    doc.text("4. Dahulukan menjawab soal-soal yang Anda anggap lebih mudah.", marginX + 2, y + 16);
    doc.text("5. Periksalah kembali seluruh pekerjaan Anda sebelum diserahkan kepada pengawas ujian.", marginX + 2, y + 20);
    y += 26;
  }

  // 5. ISI SOAL ATAU KUNCI JAWABAN
  if (mode === 'key_only') {
    doc.setFont("times", "bold");
    doc.setFontSize(11);
    doc.text("LEMBAR KUNCI JAWABAN REKAPITULASI", pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(9);
    doc.rect(marginX, y, contentWidth, 7);
    doc.text("No", marginX + 4, y + 5);
    doc.text("Tipe Soal", marginX + 16, y + 5);
    doc.text("Kunci Jawaban", marginX + 65, y + 5);
    doc.text("Level", marginX + 130, y + 5);
    y += 7;

    doc.setFont("times", "normal");
    for (let i = 0; i < questions.length; i++) {
      checkPageBreak(8);
      const q = questions[i];
      let keyStr = "-";
      if (q.type === QuestionType.SINGLE) {
        keyStr = q.correctAnswer !== undefined ? String.fromCharCode(65 + q.correctAnswer) : '-';
      } else if (q.type === QuestionType.MULTIPLE && Array.isArray(q.correctAnswer)) {
        keyStr = q.correctAnswer.map(ans => String.fromCharCode(65 + ans)).join(', ');
      } else if ((q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH) && Array.isArray(q.correctAnswer)) {
        keyStr = q.correctAnswer.map((v, idx) => `${idx + 1}:${v === true ? 'B' : 'S'}`).join(' ');
      }

      doc.rect(marginX, y, contentWidth, 6);
      doc.text(`${q.order || i + 1}`, marginX + 4, y + 4.5);
      doc.text(`${q.type.substring(0, 18)}`, marginX + 16, y + 4.5);
      doc.setFont("times", "bold");
      doc.text(`${keyStr}`, marginX + 65, y + 4.5);
      doc.setFont("times", "normal");
      doc.text(`${(q.level || '-').substring(0, 16)}`, marginX + 130, y + 4.5);
      y += 6;
    }
  } else {
    // Mode Siswa atau Master Guru
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qNum = `${q.order || i + 1}.`;
      const cleanText = cleanMathForPDF(q.text);
      const textLines = doc.splitTextToSize(cleanText, contentWidth - 10);
      const qHeight = (textLines.length * 4.5) + (q.questionImage ? 45 : 0) + (q.bottomImage ? 45 : 0) + (q.options ? q.options.length * 5 : 10);

      checkPageBreak(Math.min(qHeight, 60));

      // 1. Gambar Atas jika ada (sebelum teks soal)
      if (q.questionImage) {
        try {
          const imgBase64 = await getImageBase64(q.questionImage);
          if (imgBase64) {
            checkPageBreak(45);
            const isPng = imgBase64.toLowerCase().startsWith('data:image/png') || imgBase64.toLowerCase().includes('.png');
            const format = isPng ? 'PNG' : 'JPEG';
            doc.addImage(imgBase64, format, marginX + 7, y, 65, 38);
            y += 42;
          }
        } catch {
          // Abaikan
        }
      }

      doc.setFont("times", "bold");
      doc.setFontSize(10);
      doc.text(qNum, marginX, y);

      doc.setFont("times", "normal");
      doc.text(textLines, marginX + 7, y);
      y += (textLines.length * 4.5) + 2;

      // 2. Gambar Bawah jika ada (setelah teks soal, sebelum opsi jawaban)
      if (q.bottomImage) {
        try {
          const btmBase64 = await getImageBase64(q.bottomImage);
          if (btmBase64) {
            checkPageBreak(45);
            const isPng = btmBase64.toLowerCase().startsWith('data:image/png') || btmBase64.toLowerCase().includes('.png');
            const format = isPng ? 'PNG' : 'JPEG';
            doc.addImage(btmBase64, format, marginX + 7, y, 65, 38);
            y += 42;
          }
        } catch {
          // Abaikan
        }
      }

      // Opsi Pilihan Ganda
      if (q.type === QuestionType.SINGLE && q.options) {
        for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
          checkPageBreak(6);
          const letter = String.fromCharCode(65 + optIdx);
          const isCorrect = q.correctAnswer === optIdx;
          const optClean = cleanMathForPDF(q.options[optIdx]);
          const optLines = doc.splitTextToSize(optClean, contentWidth - 25);

          if (mode === 'master' && isCorrect) {
            doc.setFont("times", "bold");
            doc.text(`${letter}. ${optLines[0]}`, marginX + 10, y);
            doc.setFontSize(7.5);
            doc.text("[KUNCI]", marginX + contentWidth - 20, y);
            doc.setFontSize(10);
          } else {
            doc.setFont("times", "normal");
            doc.text(`${letter}. ${optLines[0]}`, marginX + 10, y);
          }
          y += 4.5;
        }
      } else if (q.type === QuestionType.MULTIPLE && q.options) {
        for (let optIdx = 0; optIdx < q.options.length; optIdx++) {
          checkPageBreak(6);
          const isCorrect = Array.isArray(q.correctAnswer) && q.correctAnswer.includes(optIdx);
          const optClean = cleanMathForPDF(q.options[optIdx]);
          doc.rect(marginX + 10, y - 3, 3, 3);
          if (mode === 'master' && isCorrect) {
            doc.text("✓", marginX + 10.5, y - 0.5);
          }
          doc.text(optClean, marginX + 15, y);
          y += 4.5;
        }
      } else if (q.type === QuestionType.TRUE_FALSE || q.type === QuestionType.MATCH) {
        if (q.options) {
          checkPageBreak(15);
          doc.setFontSize(8);
          doc.text("Pernyataan:", marginX + 10, y);
          y += 3.5;
          for (let sIdx = 0; sIdx < q.options.length; sIdx++) {
            checkPageBreak(5);
            const ans = Array.isArray(q.correctAnswer) ? q.correctAnswer[sIdx] : null;
            const optClean = cleanMathForPDF(q.options[sIdx]);
            const ansTag = mode === 'master' ? (ans === true ? '[BENAR]' : ans === false ? '[SALAH]' : '') : '[   ]';
            doc.text(`- ${optClean} ${ansTag}`, marginX + 12, y);
            y += 4;

            const optImg = q.optionImages?.[sIdx];
            if (optImg) {
              try {
                const optImgBase64 = await getImageBase64(optImg);
                if (optImgBase64) {
                  checkPageBreak(25);
                  const isPng = optImgBase64.toLowerCase().startsWith('data:image/png') || optImgBase64.toLowerCase().includes('.png');
                  const format = isPng ? 'PNG' : 'JPEG';
                  doc.addImage(optImgBase64, format, marginX + 14, y, 40, 22);
                  y += 24;
                }
              } catch {
                // Abaikan kesalahan rendering gambar
              }
            }
          }
          doc.setFontSize(10);
        }
      }

      if (mode === 'master' && q.explanation) {
        checkPageBreak(8);
        doc.setFont("times", "italic");
        doc.setFontSize(8);
        doc.text(`Pembahasan: ${cleanMathForPDF(q.explanation)}`, marginX + 7, y);
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        y += 4.5;
      }

      y += 4; // Space between questions
    }
  }

  // Footer on all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont("times", "italic");
    doc.setFontSize(7.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(marginX, pageHeight - 8, pageWidth - marginX, pageHeight - 8);
    doc.text(
      `Naskah Soal: ${config.subjectName} (${token || 'Umum'}) • Halaman ${p} dari ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  const safeFilename = (token || config.subjectName || 'Ujian').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Naskah_Soal_${safeFilename}_${mode}.pdf`);
};

