
import { Subject, Question, QuestionType, CognitiveLevel } from './types.ts';

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: '1',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C1,
    subject: Subject.PANCASILA,
    phase: 'Fase C',
    material: 'Disediakan soal tentang sila Pancasila, murid dapat menjawab sesuai lambangnya.',
    text: 'Sila pertama Pancasila dilambangkan dengan...',
    explanation: 'Sila pertama "Ketuhanan Yang Maha Esa" dilambangkan dengan Bintang Emas.',
    options: ['Pohon Beringin', 'Bintang', 'Rantai', 'Kepala Banteng'],
    correctAnswer: 1,
    isDeleted: false,
    createdAt: Date.now(),
    order: 1,
    quizToken: 'PANCASILA01'
  },
  {
    id: '2',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C3,
    subject: Subject.MATEMATIKA,
    phase: 'Fase C',
    material: 'Menghitung hasil operasi perkalian dalam konteks soal cerita sederhana.',
    text: 'Berapakah hasil dari 12 dikali 5?',
    explanation: 'Operasi perkalian 12 x 5 = 60.',
    options: ['50', '55', '60', '65'],
    correctAnswer: 2,
    isDeleted: false,
    createdAt: Date.now(),
    order: 1,
    quizToken: 'MTK01'
  }
];

export const SUBJECT_LIST = Object.values(Subject);

export const KURIKULUM_PHASES = [
  'Fase Fondasi',
  'Fase A',
  'Fase B',
  'Fase C',
  'Fase D',
  'Fase E',
  'Fase F'
];

export const BLOOM_LEVELS = [
  CognitiveLevel.C1,
  CognitiveLevel.C2,
  CognitiveLevel.C3,
  CognitiveLevel.C4,
  CognitiveLevel.C5,
  CognitiveLevel.C6
];

export const PUSPENDIK_LEVELS = [
  CognitiveLevel.L1,
  CognitiveLevel.L2,
  CognitiveLevel.L3
];

export const COGNITIVE_LEVELS = [...BLOOM_LEVELS, ...PUSPENDIK_LEVELS];
