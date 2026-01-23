
import { createClient } from '@supabase/supabase-js';
import { Question, AppSettings, QuizResult } from '../types';

const SUPABASE_URL = 'https://vgtvyqnkmnjvsznygawf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndHZ5cW5rbW5qdnN6bnlnYXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDk3MTYsImV4cCI6MjA4NDYyNTcxNn0._i60pnyk5-06U1IXtUUEjKKHEsd4duZGLwyKIK5e6z4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const sanitizeData = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (key, value) => 
    value === undefined ? null : value
  ));
};

export const pushQuestionsToCloud = async (questions: Question[]) => {
  if (!questions || questions.length === 0) return;

  const payload = questions.map(q => ({
    id: q.id,
    type: q.type,
    level: q.level,
    subject: q.subject,
    phase: q.phase || 'Fase C',
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

  const cleanPayload = sanitizeData(payload);

  const { error } = await supabase
    .from('questions')
    .upsert(cleanPayload, { onConflict: 'id' });
  
  if (error) {
    throw new Error(`Gagal Sinkron Soal: ${error.message}`);
  }
};

export const updateLiveSettings = async (settings: AppSettings) => {
  const payload: any = {
    id: 1, 
    timer_minutes: Number(settings.timerMinutes) || 60
  };

  // Hanya masukkan password jika ada
  if (settings.adminPassword) {
    payload.admin_password = settings.adminPassword;
  }

  const cleanSettings = sanitizeData(payload);

  const { error } = await supabase
    .from('active_settings')
    .upsert(cleanSettings, { onConflict: 'id' });

  if (error) {
    if (error.message.includes('column "admin_password" of relation "active_settings" does not exist') || error.code === '42703') {
      throw new Error("DATABASE_OUTDATED: Kolom 'admin_password' belum ada di tabel 'active_settings'. Silakan jalankan perintah SQL ALTER TABLE di Supabase Dashboard.");
    }
    throw new Error(`Gagal Update Settings: ${error.message}`);
  }
};

export const getGlobalSettings = async () => {
  const { data, error } = await supabase
    .from('active_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    console.warn("Gagal mengambil global settings:", error.message);
    return null;
  }

  return data ? {
    timerMinutes: data.timer_minutes,
    adminPassword: data.admin_password // Jika kolom tidak ada, ini akan bernilai undefined secara otomatis tanpa error di SELECT
  } : null;
};

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
        phase: q.phase || 'Fase C',
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
    throw new Error(err.message || "Gagal mengambil data");
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

  const { error } = await supabase.from('submissions').insert([payload]);
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
