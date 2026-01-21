
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, QuestionType, CognitiveLevel } from "../types.ts";

/**
 * Menghasilkan gambar ilustrasi soal menggunakan Gemini Image
 */
export const generateAIImage = async (prompt: string): Promise<string | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Ilustrasi pendidikan sekolah untuk soal: "${prompt}". Gaya desain vektor flat modern, warna cerah, bersih, tanpa teks atau angka di dalam gambar.` }],
      },
      config: { 
        imageConfig: { aspectRatio: "1:1" } 
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    return null;
  } catch (error: any) {
    console.error("AI Image Generation Error:", error);
    throw error;
  }
};

/**
 * Menghasilkan kumpulan soal secara otomatis berdasarkan materi atau file
 */
export const generateBatchAIQuestions = async (
  subject: Subject, 
  material: string, 
  count: number, 
  specificType: QuestionType | 'RANDOM',
  specificLevel: CognitiveLevel | 'RANDOM',
  fileData?: { data: string, mimeType: string },
  customPrompt?: string
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
  
  const levelInstruction = specificLevel !== 'RANDOM' 
    ? `Semua soal HARUS memiliki level kognitif: ${specificLevel}.`
    : `Tentukan level kognitif (C1-C6) yang paling sesuai. Prioritaskan C4-C6 untuk soal analisis/HOTS.`;

  let cleanBase64 = "";
  if (fileData) {
    cleanBase64 = fileData.data.includes("base64,") 
      ? fileData.data.split("base64,")[1] 
      : fileData.data;
  }

  const promptText = `Anda adalah ahli kurikulum pendidikan Indonesia. 
             Tugas: Buatkan ${count} butir soal untuk mata pelajaran "${subject}".
             
             KONTEKS MATERI:
             ${material ? `- Ringkasan Materi: "${material}"` : '- Gunakan dokumen yang dilampirkan sebagai sumber materi utama.'}
             
             ${customPrompt ? `INSTRUKSI TAMBAHAN (PENTING): "${customPrompt}"` : ''}

             KRITERIA SOAL:
             - Tipe Soal: ${specificType !== 'RANDOM' ? specificType : 'Variasikan antara Pilihan Ganda, Jamak, Kompleks, dan Isian.'}
             - Level Kognitif: ${levelInstruction}
             
             ATURAN JAWABAN (correctAnswer):
             - Jika "Pilihan Ganda": harus angka index (0-3).
             - Jika "Pilihan Jamak": harus array index [0, 2].
             - Jika "Pilihan Ganda Kompleks": harus array boolean [true, false, true, true].
             - Jika "Isian Singkat": harus string teks.

             Hasilkan respon dalam format JSON ARRAY.`;

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
              correctAnswer: { type: Type.STRING }
            },
            required: ["text", "type", "level", "material", "explanation", "options", "correctAnswer"]
          }
        }
      }
    });

    const responseText = response.text;
    if (!responseText) throw new Error("AI tidak memberikan respon teks.");

    const raw = JSON.parse(responseText);
    
    return raw.map((q: any) => {
      let standardizedAnswer = q.correctAnswer;
      try {
        if (q.type === QuestionType.SINGLE) {
          standardizedAnswer = parseInt(String(q.correctAnswer), 10);
          if (isNaN(standardizedAnswer)) standardizedAnswer = 0;
        } else if (q.type === QuestionType.MULTIPLE || q.type === QuestionType.COMPLEX_CATEGORY) {
          if (typeof q.correctAnswer === 'string') {
            standardizedAnswer = JSON.parse(q.correctAnswer.replace(/'/g, '"'));
          }
        }
      } catch (e) {
        console.warn("Gagal menstandarisasi jawaban:", q.correctAnswer);
      }

      return { 
        ...q, 
        correctAnswer: standardizedAnswer, 
        subject, 
        isDeleted: false, 
        createdAt: Date.now() 
      };
    });
  } catch (e: any) {
    console.error("Gemini API Error:", e);
    throw e;
  }
};
