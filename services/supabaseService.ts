
import { createClient } from '@supabase/supabase-js';
import { Question, AppSettings, QuizResult } from '../types';

/**
 * PANDUAN PENGISIAN:
 * 1. Buka Dashboard Supabase Anda.
 * 2. Pergi ke Settings (ikon gerigi) > API.
 * 3. Salin 'Project URL' dan tempel ke SUPABASE_URL di bawah.
 * 4. Salin 'anon public' key dan tempel ke SUPABASE_ANON_KEY di bawah.
 */

const SUPABASE_URL = 'https://vgtvyqnkmnjvsznygawf.supabase.co'; // Contoh: https://abcxyz.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndHZ5cW5rbW5qdnN6bnlnYXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDk3MTYsImV4cCI6MjA4NDYyNTcxNn0._i60pnyk5-06U1IXtUUEjKKHEsd4duZGLwyKIK5e6z4'; // Deretan kode sangat panjang

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ADMIN: Mengirim bank soal ke cloud
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
      order: q.order
    })));
  if (error) console.error("Gagal sinkron soal ke Cloud:", error);
};

/**
 * ADMIN: Mengupdate pengaturan ujian (Token & Mapel)
 */
export const updateLiveSettings = async (settings: AppSettings) => {
  const { error } = await supabase
    .from('active_settings')
    .update({
      timer_minutes: settings.timerMinutes,
      active_token: settings.activeToken,
      active_subject: settings.activeSubject
    })
    .eq('id', 1);
  if (error) console.error("Gagal update settings ke Cloud:", error);
};

/**
 * SISWA: Mengambil data ujian aktif saat login
 */
export const getLiveExamData = async () => {
  try {
    const { data: settings, error: settingsError } = await supabase
      .from('active_settings')
      .select('*')
      .single();
      
    if (settingsError || !settings) return null;

    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('subject', settings.active_subject)
      .eq('is_deleted', false)
      .order('order', { ascending: true });

    if (questionsError) return null;

    return {
      settings: {
        timerMinutes: settings.timer_minutes,
        activeToken: settings.active_token,
        activeSubject: settings.active_subject
      },
      questions: questions || []
    };
  } catch (err) {
    console.error("Cloud Connection Error:", err);
    return null;
  }
};

/**
 * SISWA: Mengirim jawaban ke server
 */
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
      subject: result.identity.token
    }]);
  return !error;
};

/**
 * GURU: Mengambil hasil pengerjaan secara real-time
 */
export const listenToSubmissions = (onNewData: (data: any) => void) => {
  // Fix: Added mandatory 'schema' property and used 'as any' casting to resolve the TypeScript overload mismatch for 'postgres_changes'
  return supabase
    .channel('realtime_submissions')
    .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'submissions' }, (payload: any) => {
      onNewData(payload.new);
    })
    .subscribe();
};
