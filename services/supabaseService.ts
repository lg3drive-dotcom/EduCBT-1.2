
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
    bottomImage: q.bottom_image || (q as any).bottomImage || (q as any).questionImageBottom || null,
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

export const fetchQuestionsByToken = async (token: string): Promise<Question[]> => {
  const { data, error } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_token', token.toUpperCase())
    .eq('is_deleted', false)
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
    bottomImage: q.bottom_image || (q as any).bottomImage || (q as any).questionImageBottom || null,
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

  const buildPayload = (includeBottomImage: boolean) => questions.map(q => {
    const item: any = {
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
      tf_labels: q.tfLabels || { true: 'T', false: 'F' }
    };
    if (includeBottomImage && (q.bottomImage || (q as any).questionImageBottom)) {
      item.bottom_image = q.bottomImage || (q as any).questionImageBottom || null;
    }
    return item;
  });

  try {
    const fullPayload = sanitizeData(buildPayload(true));
    const { error } = await supabase.from('questions').upsert(fullPayload, { onConflict: 'id' });
    if (error) {
      // Jika kolom bottom_image belum ada di tabel Supabase, lakukan fallback tanpa bottom_image
      if (error.message && (error.message.includes('bottom_image') || error.code === 'PGRST204')) {
        const fallbackPayload = sanitizeData(buildPayload(false));
        const { error: retryError } = await supabase.from('questions').upsert(fallbackPayload, { onConflict: 'id' });
        if (retryError) throw new Error(`Gagal Sinkron Soal: ${retryError.message}`);
        return;
      }
      throw new Error(`Gagal Sinkron Soal: ${error.message}`);
    }
  } catch (err: any) {
    throw err;
  }
};

export const updateLiveSettings = async (settings: AppSettings) => {
  const fullPayload: any = { 
    id: 1, 
    timer_minutes: Number(settings.timerMinutes) || 60,
    external_links: settings.externalLinks || {}
  };
  if (settings.adminPassword) fullPayload.admin_password = settings.adminPassword;

  const { error } = await supabase.from('active_settings').upsert(sanitizeData(fullPayload), { onConflict: 'id' });
  
  if (error && error.message.includes('external_links')) {
    const safePayload: any = { 
      id: 1, 
      timer_minutes: Number(settings.timerMinutes) || 60
    };
    if (settings.adminPassword) safePayload.admin_password = settings.adminPassword;
    
    const { error: retryError } = await supabase.from('active_settings').upsert(sanitizeData(safePayload), { onConflict: 'id' });
    if (retryError) throw new Error(`Gagal Update Settings (Retry): ${retryError.message}`);
    return;
  }

  if (error) throw new Error(`Gagal Update Settings: ${error.message}`);
};

export const getGlobalSettings = async () => {
  const { data, error } = await supabase.from('active_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return null;
  return data ? { 
    timerMinutes: data.timer_minutes, 
    adminPassword: data.admin_password,
    externalLinks: data.external_links
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
        activeSubject: questions[0].subject || 'Ujian Digital',
        externalLinks: set?.external_links
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
        bottomImage: q.bottom_image || (q as any).bottomImage || (q as any).questionImageBottom || null,
        options: q.options,
        optionImages: q.option_images, // Menambahkan kolom ini agar gambar opsi muncul di sisi siswa
        correctAnswer: q.correct_answer, 
        isDeleted: q.is_deleted, 
        order: q.order,
        quizToken: q.quiz_token, 
        tfLabels: q.tf_labels
      }))
    };
  } catch (err: any) { throw new Error(err.message); }
};

export const submitResultToCloud = async (result: QuizResult, subjectName?: string): Promise<{success: boolean, error?: string}> => {
  try {
    const payload: any = {
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
    };

    const cleanPayload = sanitizeData(payload);
    const { error } = await supabase.from('submissions').insert([cleanPayload]);
    
    // Jika kolom subject_name atau subject_token tidak ditemukan (error schema cache)
    if (error && (error.message.includes('subject_name') || error.message.includes('subject_token') || error.message.includes('school_origin'))) {
        console.warn("Mendeteksi ketidakcocokan kolom database. Mencoba mengirim ulang tanpa kolom tambahan...");
        
        // Hapus kolom yang sering bermasalah jika belum dibuat di Supabase user
        delete cleanPayload.subject_name;
        delete cleanPayload.subject_token;
        // Opsional: delete cleanPayload.school_origin; // Jika school_origin juga belum ada
        
        const { error: retryError } = await supabase.from('submissions').insert([cleanPayload]);
        if (retryError) return { success: false, error: `Retry Gagal: ${retryError.message}` };
        return { success: true };
    }

    return error ? { success: false, error: error.message } : { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
};

export const fetchSubmissionsByToken = async (token: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('submissions')
    .select('*')
    .eq('subject', token.toUpperCase())
    .order('student_name', { ascending: true }); // DIKEMBALIKAN: Urutan berdasarkan nama siswa (A-Z)

  if (error) throw error;
  return data || [];
};

export const deleteQuestionsByTokenFromCloud = async (tokens: string[] | string): Promise<{ success: boolean; count?: number | null; error?: string }> => {
  try {
    const rawList = Array.isArray(tokens) ? tokens : [tokens];
    const tokenList = rawList
      .map(t => (t || '').trim())
      .filter(Boolean);

    if (tokenList.length === 0) return { success: true, count: 0 };

    // Include variants (exact, uppercase, lowercase) to guarantee matching in Supabase
    const variants = Array.from(new Set([
      ...tokenList,
      ...tokenList.map(t => t.toUpperCase()),
      ...tokenList.map(t => t.toLowerCase())
    ]));

    // 1. Attempt hard DELETE from Supabase
    let { data, error, count } = await supabase
      .from('questions')
      .delete({ count: 'exact' })
      .in('quiz_token', variants);

    // 2. If hard delete fails (e.g. RLS policy prevents DELETE on anon key), fallback to soft-delete
    if (error) {
      console.warn("Hard delete error, attempting soft delete fallback:", error.message);
      const softRes = await supabase
        .from('questions')
        .update({ is_deleted: true }, { count: 'exact' })
        .in('quiz_token', variants);

      if (softRes.error) {
        throw new Error(`Gagal menghapus di Supabase (${error.message}). Percobaan alternatif juga gagal (${softRes.error.message})`);
      }
      return { success: true, count: softRes.count ?? 0 };
    }

    return { success: true, count: count ?? 0 };
  } catch (err: any) {
    console.error("Error deleting questions by token from cloud:", err);
    return { success: false, error: err.message || 'Gagal menghapus soal di cloud Supabase' };
  }
};

export const updateQuestionTokenInCloud = async (
  oldToken: string, 
  newToken: string,
  updateSubmissions: boolean = true
): Promise<{ success: boolean; count?: number | null; submissionsCount?: number | null; error?: string }> => {
  try {
    const cleanOld = (oldToken || '').trim();
    const cleanNew = (newToken || '').trim().toUpperCase();

    if (!cleanOld || !cleanNew) {
      return { success: false, error: 'Token lama dan token baru wajib diisi.' };
    }
    if (cleanOld.toUpperCase() === cleanNew) {
      return { success: false, error: 'Token baru harus berbeda dengan token lama.' };
    }

    const variants = Array.from(new Set([
      cleanOld,
      cleanOld.toUpperCase(),
      cleanOld.toLowerCase()
    ]));

    // 1. Perbarui token butir soal di tabel questions
    const { error, count } = await supabase
      .from('questions')
      .update({ quiz_token: cleanNew }, { count: 'exact' })
      .in('quiz_token', variants);

    if (error) {
      throw new Error(`Gagal mengubah token soal di Supabase: ${error.message}`);
    }

    let submissionsCount = 0;
    // 2. Perbarui juga riwayat jawaban di tabel submissions (jika ada)
    if (updateSubmissions) {
      try {
        const subRes = await supabase
          .from('submissions')
          .update({ subject: cleanNew, subject_token: cleanNew }, { count: 'exact' })
          .in('subject', variants);
        submissionsCount = subRes.count ?? 0;
      } catch (subErr) {
        console.warn("Notice: update submissions optional warning:", subErr);
      }
    }

    return { success: true, count: count ?? 0, submissionsCount };
  } catch (err: any) {
    console.error("Error updating question token in cloud:", err);
    return { success: false, error: err.message || 'Gagal mengubah token soal di Supabase' };
  }
};

