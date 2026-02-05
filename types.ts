
export enum Subject {
  PANCASILA = 'Pendidikan Pancasila',
  INDONESIA = 'Bahasa Indonesia',
  MATEMATIKA = 'Matematika',
  IPAS = 'IPAS',
  SENI = 'Seni Budaya',
  SUNDA = 'Bahasa Sunda',
  INGGRIS = 'Bahasa Inggris'
}

export enum QuestionType {
  SINGLE = 'Pilihan Ganda',
  MULTIPLE = 'Pilihan Jamak (MCMA)',
  TRUE_FALSE = '(Benar/Salah)',
  MATCH = '(Sesuai/Tidak Sesuai)'
}

export enum CognitiveLevel {
  C1 = 'C1 Mengingat',
  C2 = 'C2 Memahami',
  C3 = 'C3 Menerapkan',
  C4 = 'C4 Menganalisis',
  C5 = 'C5 Mengevaluasi',
  C6 = 'C6 Mencipta',
  L1 = 'Level 1 (Pengetahuan & Pemahaman)',
  L2 = 'Level 2 (Aplikasi)',
  L3 = 'Level 3 (Penalaran)'
}

export interface ExternalLinks {
  passwordHelp: string;
  aiGenerator: string;
  aiAnalysis: string;
  adminEmailDisplay: string;
}

export interface Question {
  id: string;
  type: QuestionType;
  level: string; 
  subject: string; 
  phase?: string;
  material: string; 
  text: string;
  explanation: string;
  questionImage?: string;
  options?: string[]; 
  optionImages?: (string | undefined)[];
  correctAnswer: any; 
  isDeleted: boolean;
  createdAt: number;
  order: number;
  quizToken?: string; 
  tfLabels?: {
    true: string;
    false: string;
  };
}

export interface StudentIdentity {
  name: string;
  className: string;
  schoolOrigin: string;
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
  activeSubject?: string;
  adminPassword?: string;
  externalLinks?: ExternalLinks;
}
