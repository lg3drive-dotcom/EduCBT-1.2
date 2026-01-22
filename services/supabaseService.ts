
import { createClient } from '@supabase/supabase-js';
import { Question, AppSettings, QuizResult } from '../types';

const SUPABASE_URL = 'https://vgtvyqnkmnjvsznygawf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZndHZ5qW5rbW5qdnN6bnlnYXdmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkwNDk3MTYsImV4cCI6MjA4NDYyNTcxNn0._i60pnyk5-06U1IXtUUEjKKHEsd4duZGLwyKIK5e6z4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * ADMIN: Mengirim bank soal ke cloud dengan label TOKEN masing-masing soal
 */
export const pushQuestionsToCloud = async (questions: Question[], activeToken: string) => {
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
      quiz_token: q.quizToken?.toUpperCase() || activeToken.toUpperCase()
    })));
  if (error) console.error("Gagal sinkron soal ke Cloud:", error);
};

export const updateLiveSettings = async (settings: AppSettings) => {
  const { error } = await supabase
    .from('active_settings')
    .upsert({
      id: 1, 
      timer_minutes: settings.timerMinutes,
      active_token: settings.activeToken
    });
  if (error) console.error("Gagal update settings ke Cloud:", error);
};

export const getLiveExamData = async (studentToken: string) => {
  try {
    const cleanToken = studentToken.toUpperCase();
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_token', cleanToken)
      .eq('is_deleted', false)
      .order('order', { ascending: true });

    if (questionsError || !questions || questions.length === 0) return null;

    const { data: settings } = await supabase
      .from('active_settings')
      .select('*')
      .single();

    return {
      settings: {
        timerMinutes: settings?.timer_minutes || 60,
        activeToken: cleanToken
      },
      questions: questions.map(q => ({
        ...q,
        questionImage: q.question_image,
        optionImages: q.option_images,
        correctAnswer: q.correct_answer
      }))
    };
  } catch (err) {
    console.error("Cloud Connection Error:", err);
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
      subject: result.identity.token.toUpperCase() 
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
