
import { createClient } from '@supabase/supabase-js';
import { Question, AppSettings, QuizResult } from '../types';

const SUPABASE_URL = 'https://vgtvyqnkmnjvsznygawf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndHZ5cW5rbW5qdnN6bnlnYXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDk3MTYsImV4cCI6MjA4NDYyNTcxNn0._i60pnyk5-06U1IXtUUEjKKHEsd4duZGLwyKIK5e6z4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ADMIN: Mengirim bank soal ke cloud. 
 * Setiap soal membawa identitas tokennya masing-masing.
 */
export const pushQuestionsToCloud = async (questions: Question[]) => {
  const { error } = await supabase
    .from('questions')
    .upsert(questions.map(q => ({
      id: q.id,
      type: q.type,
      level: q.level,
      subject: q.subject,
      material: q.material,
      text: q.text,
      explanation: q.explanation,
      question_image: q.questionImage,
      options: q.options,
      option_images: q.optionImages,
      correct_answer: q.correctAnswer,
      is_deleted: q.isDeleted,
      created_at: q.createdAt,
      order: q.order,
      quiz_token: (q.quizToken || 'UJI01').toUpperCase() // Fallback ke UJI01 jika kosong
    })));
  
  if (error) {
    console.error("Gagal sinkron soal ke Cloud:", error);
    throw error;
  }
};

/**
 * ADMIN: Mengupdate durasi waktu global (berlaku untuk semua ujian)
 */
export const updateLiveSettings = async (settings: AppSettings) => {
  const { error } = await supabase
    .from('active_settings')
    .upsert({
      id: 1, 
      timer_minutes: settings.timerMinutes
    });
  if (error) console.error("Gagal update settings ke Cloud:", error);
};

/**
 * SISWA: Menarik soal secara dinamis hanya berdasarkan token yang diinput.
 * Tidak peduli pengaturan global apa yang sedang aktif.
 */
export const getLiveExamData = async (studentToken: string) => {
  try {
    const cleanToken = studentToken.trim().toUpperCase();
    
    // Tahap 1: Cari semua soal yang memiliki token ini
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_token', cleanToken)
      .eq('is_deleted', false)
      .order('order', { ascending: true });

    if (questionsError) throw questionsError;

    // Jika tidak ada soal dengan token tersebut, return null (memicu notifikasi di UI)
    if (!questions || questions.length === 0) {
      console.warn(`Tidak ada soal ditemukan untuk token: ${cleanToken}`);
      return null;
    }

    // Tahap 2: Ambil durasi waktu dari settings (opsional, fallback ke 60 menit)
    const { data: settings } = await supabase
      .from('active_settings')
      .select('*')
      .eq('id', 1)
      .single();

    return {
      settings: {
        timerMinutes: settings?.timer_minutes || 60,
        activeSubject: questions[0].subject || 'Ujian Digital' // Ambil nama mapel dari soal pertama
      },
      questions: questions.map(q => ({
        ...q,
        questionImage: q.question_image,
        optionImages: q.option_images,
        correctAnswer: q.correct_answer,
        quizToken: q.quiz_token
      }))
    };
  } catch (err) {
    console.error("Kesalahan koneksi Cloud:", err);
    return null;
  }
};

export const submitResultToCloud = async (result: QuizResult) => {
  const { error } = await supabase
    .from('submissions')
    .insert([{
      id: result.id,
      student_name: result.identity.name,
      class_name: result.identity.className,
      score: result.score,
      answers: result.answers,
      timestamp: result.timestamp,
      subject: result.identity.token.toUpperCase() // Labeli hasil dengan token yang dipakai
    }]);
  return !error;
};

export const listenToSubmissions = (onNewData: (data: any) => void) => {
  return supabase
    .channel('realtime_submissions')
    .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'submissions' }, (payload: any) => {
      onNewData(payload.new);
    })
    .subscribe();
};
