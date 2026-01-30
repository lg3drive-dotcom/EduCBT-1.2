
import { Subject, Question, QuestionType, CognitiveLevel } from './types.ts';

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'math-demo-1',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C3,
    subject: Subject.MATEMATIKA,
    phase: 'Fase C',
    material: 'Menyelesaikan operasi hitung pecahan.',
    text: 'Hasil dari operasi hitung $\\frac{3}{4} + \\frac{1}{2}$ adalah...',
    explanation: 'Untuk menjumlahkan pecahan, samakan penyebutnya: $\\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}$ atau $1\\frac{1}{4}$.',
    options: ['$\\frac{4}{6}$', '$\\frac{5}{4}$', '$1\\frac{1}{2}$', '$\\frac{1}{4}$'],
    correctAnswer: 1,
    isDeleted: false,
    createdAt: Date.now(),
    order: 1,
    quizToken: 'MATH_DEMO'
  },
  {
    id: 'math-demo-2',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C1,
    subject: Subject.MATEMATIKA,
    phase: 'Fase C',
    material: 'Bilangan berpangkat dan akar.',
    text: 'Nilai dari $\\sqrt{144} + 5^2$ adalah...',
    explanation: '$\\sqrt{144} = 12$ dan $5^2 = 25$. Maka $12 + 25 = 37$.',
    options: ['22', '37', '49', '169'],
    correctAnswer: 1,
    isDeleted: false,
    createdAt: Date.now(),
    order: 2,
    quizToken: 'MATH_DEMO'
  },
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
  }
];

export const SUBJECT_LIST = Object.values(Subject);
export const KURIKULUM_PHASES = ['Fase Fondasi', 'Fase A', 'Fase B', 'Fase C', 'Fase D', 'Fase E', 'Fase F'];
export const BLOOM_LEVELS = [CognitiveLevel.C1, CognitiveLevel.C2, CognitiveLevel.C3, CognitiveLevel.C4, CognitiveLevel.C5, CognitiveLevel.C6];
export const PUSPENDIK_LEVELS = [CognitiveLevel.L1, CognitiveLevel.L2, CognitiveLevel.L3];
export const COGNITIVE_LEVELS = [...BLOOM_LEVELS, ...PUSPENDIK_LEVELS];
