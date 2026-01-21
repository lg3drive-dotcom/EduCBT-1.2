
export enum Subject {
  PANCASILA = 'Pendidikan Pancasila',
  INDONESIA = 'Bahasa Indonesia',
  MATEMATIKA = 'Matematika',
  IPAS = 'IPAS',
  SENI = 'Seni Budaya',
  SUNDA = 'Bahasa Sunda',
  INGGRIS = 'Bahasa Inggris',
  TKA_INDONESIA = 'TKA Bahasa Indonesia',
  TKA_MATEMATIKA = 'TKA Matematika'
}

export enum QuestionType {
  SINGLE = 'Pilihan Ganda',
  MULTIPLE = 'Pilihan Jamak (MCMA)',
  COMPLEX_CATEGORY = 'Pilihan Ganda Kompleks',
  SHORT_ANSWER = 'Isian Singkat'
}

export enum CognitiveLevel {
  C1 = 'C1 Mengingat',
  C2 = 'C2 Memahami',
  C3 = 'C3 Menerapkan',
  C4 = 'C4 Menganalisis',
  C5 = 'C5 Mengevaluasi',
  C6 = 'C6 Mencipta'
}

export interface Question {
  id: string;
  type: QuestionType;
  level: CognitiveLevel;
  subject: Subject;
  material: string; 
  text: string;
  explanation: string;
  questionImage?: string;
  options?: string[]; // Statements for COMPLEX_CATEGORY or Choices for SINGLE/MULTIPLE
  optionImages?: (string | undefined)[];
  correctAnswer: any; // Indeks (SINGLE), Array Indeks (MULTIPLE), Array Boolean (COMPLEX_CATEGORY), String (SHORT)
  isDeleted: boolean;
  createdAt: number;
  order: number;
}

export interface StudentIdentity {
  name: string;
  className: string;
  birthDate: string;
  token: string;
}

export interface QuizResult {
  id: string;
  identity: StudentIdentity;
  score: number;
  totalQuestions: number;
  answers: { [key: string]: any };
  manualCorrections: { [key: string]: number }; 
  timestamp: number;
  duration: number;
  isCorrected: boolean;
}

export interface AppSettings {
  timerMinutes: number;
  activeToken: string;
  activeSubject: Subject;
}
