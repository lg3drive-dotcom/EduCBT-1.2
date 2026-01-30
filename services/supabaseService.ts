
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

export const fetchAllQuestions = async (): Promise<Question[]> => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('is_deleted', false)
    .order('quiz_token', { ascending: true })
    .order('order', { ascending: true });

  if (error) throw error;
  
  return (data || []).map(q => ({
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
    quizToken: q.quiz_token,
    tfLabels: q.tf_labels
  }));
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
    quiz_token: (q.quizToken || 'UJI01').trim().toUpperCase(),
    tf_labels: q.tfLabels || { true: 'Benar', false: 'Salah' }
  }));

  const cleanPayload = sanitizeData(payload);
  const { error } = await supabase.from('questions').upsert(cleanPayload, { onConflict: 'id' });
  if (error) throw new Error(`Gagal Sinkron Soal: ${error.message}`);
};

export const updateLiveSettings = async (settings: AppSettings) => {
  const payload: any = { 
    id: 1, 
    timer_minutes: Number(settings.timerMinutes) || 60
  };
  if (settings.adminPassword) payload.admin_password = settings.adminPassword;
  const { error } = await supabase.from('active_settings').upsert(sanitizeData(payload), { onConflict: 'id' });
  if (error) throw new Error(`Gagal Update Settings: ${error.message}`);
};

export const getGlobalSettings = async () => {
  const { data, error } = await supabase.from('active_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return null;
  return data ? { 
    timerMinutes: data.timer_minutes, 
    adminPassword: data.admin_password
  } : null;
};

export const getLiveExamData = async (studentToken: string) => {
  try {
    const cleanToken = studentToken.trim().toUpperCase();
    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_token', cleanToken)
      .eq('is_deleted', false)
      .order('order', { ascending: true });

    if (qErr) throw qErr;
    if (!questions || questions.length === 0) return null;

    const { data: set } = await supabase.from('active_settings').select('*').eq('id', 1).maybeSingle();

    return {
      settings: { 
        timerMinutes: set?.timer_minutes || 60, 
        activeSubject: questions[0].subject || 'Ujian Digital'
      },
      questions: questions.map(q => ({
        id: q.id, type: q.type, level: q.level, subject: q.subject, material: q.material, text: q.text,
        explanation: q.explanation, questionImage: q.question_image, options: q.options,
        correctAnswer: q.correct_answer, isDeleted: q.is_deleted, order: q.order,
        quizToken: q.quiz_token, tfLabels: q.tf_labels
      }))
    };
  } catch (err: any) { throw new Error(err.message); }
};

export const submitResultToCloud = async (result: QuizResult, subjectName?: string): Promise<{success: boolean, error?: string}> => {
  try {
    const payload = sanitizeData({
      id: result.id, 
      student_name: result.identity.name, 
      class_name: result.identity.className,
      school_origin: result.identity.schoolOrigin || '-', 
      score: Number(result.score) || 0,
      answers: result.answers || {}, 
      timestamp: result.timestamp || Date.now(), 
      subject: result.identity.token.toUpperCase(),
      subject_token: result.identity.token.toUpperCase(),
      subject_name: subjectName || 'Ujian Digital' 
    });
    const { error } = await supabase.from('submissions').insert([payload]);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
};

export const fetchSubmissionsByToken = async (token: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('subject', token.toUpperCase())
    .order('student_name', { ascending: true });

  if (error) throw error;
  return data || [];
};
