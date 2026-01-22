
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, QuestionType, CognitiveLevel } from "../types.ts";

/**
 * Menghasilkan gambar ilustrasi soal menggunakan Gemini 3 Pro Image
 */
export const generateAIImage = async (prompt: string): Promise<string | null> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key sistem tidak ditemukan. Hubungi administrator.");
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `Ilustrasi pendidikan sekolah untuk soal: "${prompt}". Gaya desain vektor flat modern, warna cerah, bersih, tanpa teks atau angka di dalam gambar.` }],
      },
      config: { 
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" } 
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
 * Menghasilkan kumpulan soal secara otomatis menggunakan Gemini 3 Pro
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
  if (!process.env.API_KEY) {
    throw new Error("API Key sistem tidak ditemukan. Hubungi administrator.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const levelInstruction = specificLevel !== 'RANDOM' 
    ? `Semua soal HARUS memiliki level kognitif: ${specificLevel}.`
    : `Tentukan level kognitif (C1-C6) yang paling sesuai. Prioritaskan C4-C6 untuk soal analisis/HOTS.`;

  let cleanBase64 = "";
  if (fileData) {
    cleanBase64 = fileData.data.includes("base64,") 
      ? fileData.data.split("base64,")[1] 
      : fileData.data;
  }

  const promptText = `Anda adalah pakar pembuat soal ujian Indonesia.
             Buatkan ${count} butir soal untuk mata pelajaran "${subject}".
             
             KONTEKS MATERI:
             ${material ? `- Ringkasan Materi: "${material}"` : '- Gunakan lampiran file sebagai sumber utama.'}
             ${customPrompt ? `INSTRUKSI TAMBAHAN: "${customPrompt}"` : ''}

             KRITERIA:
             - Tipe: ${specificType !== 'RANDOM' ? specificType : 'Variasikan Tipe Soal'}
             - Level: ${levelInstruction}
             
             PANDUAN JAWABAN (correctAnswer):
             - SINGLE: Angka indeks (0-3).
             - MULTIPLE: Array angka [0, 2].
             - COMPLEX: Array boolean [true, false].
             - SHORT: String teks singkat.`;

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
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 4000 },
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
    if (!responseText) throw new Error("AI memberikan respons kosong.");

    const raw = JSON.parse(responseText);
    
    return raw.map((q: any) => {
      let standardizedAnswer = q.correctAnswer;
      try {
        if (q.type === QuestionType.SINGLE) {
          standardizedAnswer = parseInt(String(q.correctAnswer), 10);
        } else if (q.type === QuestionType.MULTIPLE || q.type === QuestionType.COMPLEX_CATEGORY) {
          if (typeof q.correctAnswer === 'string') {
            const cleaned = q.correctAnswer.replace(/'/g, '"');
            standardizedAnswer = JSON.parse(cleaned);
          }
        }
      } catch (e) {
        console.warn("Kesalahan parsing jawaban, menggunakan data mentah.");
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
    console.error("Gemini Generation Error:", e);
    throw e;
  }
};
