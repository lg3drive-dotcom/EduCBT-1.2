
import { Subject, Question, QuestionType, CognitiveLevel } from './types';

export const INITIAL_QUESTIONS: Question[] = [
  {
    id: '1',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C1,
    subject: Subject.PANCASILA,
    material: 'Disediakan soal tentang sila Pancasila, murid dapat menjawab sesuai lambangnya.',
    text: 'Sila pertama Pancasila dilambangkan dengan...',
    explanation: 'Sila pertama "Ketuhanan Yang Maha Esa" dilambangkan dengan Bintang Emas. Bintang dimaksudkan sebagai sebuah cahaya, seperti layaknya Tuhan yang menjadi cahaya kerohanian bagi setiap manusia.',
    options: ['Pohon Beringin', 'Bintang', 'Rantai', 'Kepala Banteng'],
    correctAnswer: 1,
    isDeleted: false,
    createdAt: Date.now(),
    order: 1
  },
  {
    id: '2',
    type: QuestionType.SINGLE,
    level: CognitiveLevel.C3,
    subject: Subject.MATEMATIKA,
    material: 'Menghitung hasil operasi perkalian dalam konteks soal cerita sederhana.',
    text: 'Berapakah hasil dari 12 dikali 5?',
    explanation: 'Operasi perkalian 12 x 5 dapat dihitung dengan menjumlahkan angka 12 sebanyak 5 kali (12+12+12+12+12) atau 5 sebanyak 12 kali. Hasilnya adalah 60.',
    options: ['50', '55', '60', '65'],
    correctAnswer: 2,
    isDeleted: false,
    createdAt: Date.now(),
    order: 1
  }
];

export const SUBJECT_LIST = Object.values(Subject);
export const COGNITIVE_LEVELS = Object.values(CognitiveLevel);
