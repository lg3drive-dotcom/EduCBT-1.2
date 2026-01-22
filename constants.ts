
import { Question, QuestionType, CognitiveLevel } from './types.ts';

export const SUBJECT_LIST = [
  'Matematika',
  'Bahasa Indonesia',
  'Bahasa Inggris',
  'IPA (Sains)',
  'IPS (Sosial)',
  'Pendidikan Pancasila',
  'PAI & Budi Pekerti',
  'PJOK',
  'Seni Budaya'
];

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: '1',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C1,
    subject: 'Pendidikan Pancasila',
    material: 'Disediakan soal tentang sila Pancasila, murid dapat menjawab sesuai lambangnya.',
    text: 'Sila pertama Pancasila dilambangkan dengan...',
    explanation: 'Sila pertama "Ketuhanan Yang Maha Esa" dilambangkan dengan Bintang Emas.',
    options: ['Pohon Beringin', 'Bintang', 'Rantai', 'Kepala Banteng'],
    correctAnswer: 1,
    isDeleted: false,
    createdAt: Date.now(),
    order: 1,
    quizToken: 'DEMO123'
  }
];

export const COGNITIVE_LEVELS = Object.values(CognitiveLevel);
