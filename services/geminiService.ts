
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, QuestionType, CognitiveLevel } from "../types.ts";

/**
 * Menghasilkan gambar ilustrasi soal menggunakan Gemini 3 Pro Image
 */
export const generateAIImage = async (prompt: string): Promise<string | null> => {
  try {
    // Inisialisasi baru setiap kali untuk menangani pembaruan kunci di browser
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });
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
    // Jika error karena kunci tidak ditemukan, biarkan pemanggil menangani alur pemilihan kunci
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
  // Inisialisasi baru untuk memastikan menggunakan kunci terbaru dari environment/bridge
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

  const promptText = `Anda adalah pakar pembuat soal ujian nasional Indonesia.
             Buatkan ${count} butir soal untuk mata pelajaran "${subject}".
             
             KONTEKS MATERI:
             ${material ? `- Ringkasan Materi: "${material}"` : '- Gunakan lampiran file sebagai sumber utama.'}
             ${customPrompt ? `INSTRUKSI TAMBAHAN: "${customPrompt}"` : ''}

             KRITERIA:
             - Tipe: ${specificType !== 'RANDOM' ? specificType : 'Variasikan Tipe Soal'}
             - Level: ${levelInstruction}
             
             FORMAT JAWABAN (correctAnswer):
             - Pilihan Ganda: angka (0-3).
             - Pilihan Jamak: array index [0, 2].
             - Kompleks: array boolean [true, false].
             - Isian: string.`;

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
        // Menggunakan thinking budget untuk kualitas logika soal yang lebih baik (HOTS)
        thinkingConfig: { thinkingBudget: 2000 },
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
    if (!responseText) throw new Error("AI response empty");

    const raw = JSON.parse(responseText);
    
    return raw.map((q: any) => {
      let standardizedAnswer = q.correctAnswer;
      try {
        if (q.type === QuestionType.SINGLE) {
          standardizedAnswer = parseInt(String(q.correctAnswer), 10);
        } else if (q.type === QuestionType.MULTIPLE || q.type === QuestionType.COMPLEX_CATEGORY) {
          if (typeof q.correctAnswer === 'string') {
            standardizedAnswer = JSON.parse(q.correctAnswer.replace(/'/g, '"'));
          }
        }
      } catch (e) {
        console.warn("Parsing answer error, keeping raw");
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
