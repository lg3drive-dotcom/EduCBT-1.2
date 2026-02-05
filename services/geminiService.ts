
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
        parts: [{ text: `Ilustrasi pendidikan sekolah dasar untuk soal: "${prompt}". Gaya desain vektor flat modern, warna cerah ceria, bersih, tanpa teks di dalam gambar.` }],
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
  specificLevel: string | 'RANDOM',
  fileData?: { data: string, mimeType: string },
  customPrompt?: string
) => {
  if (!process.env.API_KEY) {
    throw new Error("API Key sistem tidak ditemukan. Hubungi administrator.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Tentukan apakah menggunakan sistem Bloom atau Puspendik berdasarkan level input
  const isPuspendikInput = specificLevel.startsWith("Level");
  const levelContext = isPuspendikInput 
    ? "Sistem Kognitif: Puspendik Indonesia (Level 1-3)." 
    : "Sistem Kognitif: Taksonomi Bloom (C1-C6).";

  const levelInstruction = specificLevel !== 'RANDOM' 
    ? `Semua soal HARUS memiliki level kognitif: ${specificLevel}.`
    : `Tentukan level kognitif yang paling sesuai (Bloom C1-C6 atau Puspendik Level 1-3). Prioritaskan soal HOTS.`;

  let cleanBase64 = "";
  if (fileData) {
    cleanBase64 = fileData.data.includes("base64,") 
      ? fileData.data.split("base64,")[1] 
      : fileData.data;
  }

  const promptText = `Anda adalah pakar pembuat soal ujian (CBT) di Indonesia.
             Buatkan ${count} butir soal untuk mata pelajaran "${subject}".
             
             ${levelContext}

             KONTEKS MATERI:
             ${material ? `- Ringkasan Materi: "${material}"` : '- Gunakan lampiran file sebagai sumber utama.'}
             ${customPrompt ? `INSTRUKSI TAMBAHAN (SANGAT PENTING): "${customPrompt}"` : ''}

             KRITERIA:
             - Tipe Soal: ${specificType !== 'RANDOM' ? specificType : 'Variasikan antara Pilihan Ganda, Jamak, dan Kompleks'} (Dilarang membuat soal Isian/Uraian).
             - Level: ${levelInstruction}
             
             PANDUAN JAWABAN (correctAnswer):
             - Pilihan Ganda: Integer indeks (0-3).
             - Pilihan Jamak (MCMA): Array integer (contoh: [0, 2]).
             - Pilihan Ganda Kompleks: Array boolean sesuai jumlah pernyataan (contoh: [true, false, true]).`;

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
        thinkingConfig: { thinkingBudget: 6000 },
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              type: { type: Type.STRING, enum: Object.values(QuestionType) },
              level: { type: Type.STRING },
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
          // Fix: Property 'COMPLEX_CATEGORY' does not exist on type 'typeof QuestionType'. Use MATCH or TRUE_FALSE instead.
        } else if (q.type === QuestionType.MULTIPLE || q.type === QuestionType.MATCH || q.type === QuestionType.TRUE_FALSE) {
          if (typeof q.correctAnswer === 'string') {
            const cleaned = q.correctAnswer.replace(/'/g, '"');
            standardizedAnswer = JSON.parse(cleaned);
          }
        }
      } catch (e) {
        console.warn("Kesalahan parsing jawaban.");
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
