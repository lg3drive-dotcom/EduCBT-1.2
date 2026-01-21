
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, QuestionType, CognitiveLevel } from "../types";

export const generateAIImage = async (prompt: string): Promise<string | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Ilustrasi pendidikan untuk: "${prompt}". Gaya vektor flat, bersih, tanpa teks.` }],
      },
      config: { imageConfig: { aspectRatio: "1:1" } }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error) {
    console.error("AI Image Error:", error);
    return null;
  }
};

export const generateBatchAIQuestions = async (
  subject: Subject, 
  material: string, 
  count: number, 
  specificType: QuestionType | 'RANDOM',
  specificLevel: CognitiveLevel | 'RANDOM',
  fileData?: { data: string, mimeType: string },
  customPrompt?: string
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const levelInstruction = specificLevel !== 'RANDOM' 
    ? `Semua soal HARUS memiliki level kognitif: ${specificLevel}.`
    : `Tentukan level kognitif (C1-C6) yang paling sesuai. Prioritaskan C4-C6 untuk soal analisis.`;

  // Membersihkan base64 data jika ada prefix 'data:...base64,'
  let cleanBase64 = "";
  if (fileData) {
    cleanBase64 = fileData.data.includes("base64,") 
      ? fileData.data.split("base64,")[1] 
      : fileData.data;
  }

  const promptText = `Tugas: Buatkan ${count} soal ${subject} dalam bahasa Indonesia.
             ${material ? `Gunakan materi ini sebagai referensi: "${material}"` : 'Gunakan dokumen yang dilampirkan sebagai sumber materi utama.'}
             
             ${customPrompt ? `INSTRUKSI KHUSUS DARI GURU (WAJIB DIIKUTI): "${customPrompt}"` : ''}

             Tipe Soal: ${specificType !== 'RANDOM' ? specificType : 'Variasikan tipe soal'}
             Level Kognitif: ${levelInstruction}
             
             ATURAN FORMAT JAWABAN (correctAnswer):
             1. "${QuestionType.SINGLE}": Harus angka index (0-3).
             2. "${QuestionType.MULTIPLE}": Harus array angka index, misal [0, 2].
             3. "${QuestionType.COMPLEX_CATEGORY}": Harus array boolean [true, false, true, true] sesuai jumlah options.
             4. "${QuestionType.SHORT_ANSWER}": Harus string jawaban singkat.

             Hasilkan array JSON yang valid.`;

  const parts: any[] = [{ text: promptText }];

  if (fileData && cleanBase64) {
    parts.push({
      inlineData: {
        data: cleanBase64,
        mimeType: fileData.mimeType
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: Object.values(QuestionType) },
              level: { type: Type.STRING, enum: Object.values(CognitiveLevel) },
              material: { type: Type.STRING },
              explanation: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctAnswer: { type: Type.STRING, description: "Bisa berupa angka, array angka, array boolean, atau string tergantung tipe soal" }
            },
            required: ["text", "type", "level", "material", "explanation", "options", "correctAnswer"]
          }
        }
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error("Empty AI response");

    const raw = JSON.parse(responseText);
    
    return raw.map((q: any) => {
      let standardizedAnswer = q.correctAnswer;
      
      if (q.type === QuestionType.SINGLE) {
        if (typeof q.correctAnswer === 'string') {
          const parsed = parseInt(q.correctAnswer, 10);
          if (!isNaN(parsed)) standardizedAnswer = parsed;
          else {
            const foundIdx = q.options?.findIndex((opt: string) => opt.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim());
            standardizedAnswer = foundIdx !== -1 ? foundIdx : 0;
          }
        } else standardizedAnswer = Number(q.correctAnswer) || 0;
      } 
      else if (q.type === QuestionType.MULTIPLE) {
        try {
          let arr = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
          standardizedAnswer = Array.isArray(arr) ? arr.map((v:any) => parseInt(v)) : [];
        } catch { standardizedAnswer = []; }
      }
      else if (q.type === QuestionType.COMPLEX_CATEGORY) {
        try {
          let arr = typeof q.correctAnswer === 'string' ? JSON.parse(q.correctAnswer) : q.correctAnswer;
          if (Array.isArray(arr)) {
            standardizedAnswer = arr.map((v:any) => v === true || v === "true" || v === 1 || v === "Sesuai");
          } else {
            standardizedAnswer = q.options.map(() => true);
          }
        } catch { standardizedAnswer = q.options.map(() => true); }
      }

      return { 
        ...q, 
        correctAnswer: standardizedAnswer, 
        subject, 
        isDeleted: false, 
        createdAt: Date.now() 
      };
    });
  } catch (e) {
    console.error("Detailed AI Generation Error:", e);
    return [];
  }
};
