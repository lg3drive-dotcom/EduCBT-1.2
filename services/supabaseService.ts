
import { createClient } from '@supabase/supabase-js';
import { Question, AppSettings, QuizResult } from '../types';

const SUPABASE_URL = 'https://vgtvyqnkmnjvsznygawf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndHZ5cW5rbW5qdnN6bnlnYXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDk3MTYsImV4cCI6MjA4NDYyNTcxNn0._i60pnyk5-06U1IXtUUEjKKHEsd4duZGLwyKIK5e6z4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fungsi pembantu untuk membersihkan data dari undefined
 * Supabase/PostgreSQL tidak menerima undefined, harus null.
 */
const sanitizeData = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    value === undefined ? null : value
  ));
};

/**
 * ADMIN: Mengirim bank soal ke cloud. 
 */
export const pushQuestionsToCloud = async (questions: Question[]) => {
  if (!questions || questions.length === 0) return;

  // Transformasi data ke format tabel database (snake_case)
  const payload = questions.map(q => ({
    id: q.id,
    type: q.type,
    level: q.level,
    subject: q.subject,
    material: q.material || '',
    text: q.text || '',
    explanation: q.explanation || '',
    question_image: q.questionImage || null,
    options: q.options || [],
    option_images: q.optionImages || [],
    correct_answer: q.correctAnswer,
    is_deleted: q.isDeleted || false,
    created_at: q.createdAt || Date.now(),
    order: Number(q.order) || 0,
    quiz_token: (q.quizToken || 'UJI01').trim().toUpperCase() 
  }));

  // Sanitasi akhir: hapus semua 'undefined' yang tersisa
  const cleanPayload = sanitizeData(payload);

  const { error } = await supabase
    .from('questions')
    .upsert(cleanPayload, { 
      onConflict: 'id',
      ignoreDuplicates: false 
    });
  
  if (error) {
    console.error("Supabase Sinkronisasi Soal Gagal:", error);
    throw new Error(`Database Error: ${error.message} (${error.code})`);
  }
};

/**
 * ADMIN: Mengupdate durasi waktu global
 */
export const updateLiveSettings = async (settings: AppSettings) => {
  const cleanSettings = sanitizeData({
    id: 1, 
    timer_minutes: Number(settings.timerMinutes) || 60
  });

  const { error } = await supabase
    .from('active_settings')
    .upsert(cleanSettings, { onConflict: 'id' });

  if (error) {
    console.error("Gagal update settings:", error);
    throw new Error(`Settings Error: ${error.message}`);
  }
};

/**
 * SISWA: Menarik soal berdasarkan token.
 */
export const getLiveExamData = async (studentToken: string) => {
  try {
    const cleanToken = studentToken.trim().toUpperCase();
    
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_token', cleanToken)
      .eq('is_deleted', false)
      .order('order', { ascending: true });

    if (questionsError) throw questionsError;
    if (!questions || questions.length === 0) return null;

    const { data: settings } = await supabase
      .from('active_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    return {
      settings: {
        timerMinutes: settings?.timer_minutes || 60,
        activeSubject: questions[0].subject || 'Ujian Digital'
      },
      questions: questions.map(q => ({
        id: q.id,
        type: q.type,
        level: q.level,
        subject: q.subject,
        material: q.material,
        text: q.text,
        explanation: q.explanation,
        questionImage: q.question_image,
        options: q.options,
        optionImages: q.option_images,
        correctAnswer: q.correct_answer,
        isDeleted: q.is_deleted,
        createdAt: q.created_at,
        order: q.order,
        quizToken: q.quiz_token
      }))
    };
  } catch (err: any) {
    console.error("Fatal Error in getLiveExamData:", err);
    throw new Error(err.message || "Gagal mengambil data dari server");
  }
};

export const submitResultToCloud = async (result: QuizResult) => {
  const payload = sanitizeData({
    id: result.id,
    student_name: result.identity.name,
    class_name: result.identity.className,
    score: result.score,
    answers: result.answers,
    timestamp: result.timestamp,
    subject: result.identity.token.toUpperCase() 
  });

  const { error } = await supabase
    .from('submissions')
    .insert([payload]);

  if (error) {
    console.error("Gagal submit jawaban:", error);
    return false;
  }
  return true;
};

export const listenToSubmissions = (onNewData: (data: any) => void) => {
  return supabase
    .channel('realtime_submissions')
    .on('postgres_changes' as any, { event: 'INSERT', schema: 'public', table: 'submissions' }, (payload: any) => {
      onNewData(payload.new);
    })
    .subscribe();
};
