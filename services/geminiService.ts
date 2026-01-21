
import { GoogleGenAI, Type } from "@google/genai";
import { Subject, QuestionType, CognitiveLevel } from "../types.ts";

// Polyfill sederhana untuk memastikan process.env aman diakses di browser
if (typeof (window as any).process === 'undefined') {
  (window as any).process = { env: {} };
}

/**
 * Menghasilkan gambar ilustrasi soal menggunakan Gemini Image
 */
export const generateAIImage = async (prompt: string): Promise<string | null> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("API_KEY is missing");
    return null;
  }

  const ai = new GoogleGenAI({ apiKey });
  try {
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
  } catch (error) {
    console.error("AI Image Generation Error:", error);
    return null;
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
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key tidak ditemukan di environment.");
  }

  const ai = new GoogleGenAI({ apiKey });
  
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
             - Jika "Pilihan Ganda": correctAnswer harus angka index (0, 1, 2, atau 3).
             - Jika "Pilihan Jamak (MCMA)": correctAnswer harus array index, misal [0, 2].
             - Jika "Pilihan Ganda Kompleks": correctAnswer harus array boolean [true, false, true, true] (sesuaikan jumlah options).
             - Jika "Isian Singkat": correctAnswer harus string teks jawaban.

             Pastikan bahasa yang digunakan formal, mudah dimengerti siswa, dan edukatif.`;

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
    // Menggunakan gemini-3-pro-preview untuk penalaran pembuatan soal yang lebih baik
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING, description: "Teks butir pertanyaan" },
              type: { type: Type.STRING, enum: Object.values(QuestionType) },
              level: { type: Type.STRING, enum: Object.values(CognitiveLevel) },
              material: { type: Type.STRING, description: "Indikator atau cakupan materi spesifik" },
              explanation: { type: Type.STRING, description: "Penjelasan mengapa jawaban tersebut benar" },
              options: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING },
                description: "Daftar pilihan jawaban atau pernyataan untuk dianalisis"
              },
              correctAnswer: { 
                type: Type.STRING, 
                description: "Kunci jawaban dalam format string (akan diparse secara manual)" 
              }
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
      
      // Standarisasi tipe data correctAnswer karena dikirim sebagai STRING oleh AI agar aman
      try {
        if (q.type === QuestionType.SINGLE) {
          standardizedAnswer = parseInt(String(q.correctAnswer), 10);
          if (isNaN(standardizedAnswer)) standardizedAnswer = 0;
        } 
        else if (q.type === QuestionType.MULTIPLE || q.type === QuestionType.COMPLEX_CATEGORY) {
          if (typeof q.correctAnswer === 'string') {
            // Coba parse jika AI mengirimkan stringified array seperti "[0,1]" atau "[true,false]"
            const parsed = JSON.parse(q.correctAnswer.replace(/'/g, '"'));
            standardizedAnswer = parsed;
          }
        }
      } catch (e) {
        console.warn("Gagal standarisasi jawaban AI, menggunakan nilai default.", e);
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
    console.error("Fatal AI Generation Error:", e);
    // Lempar error agar ditangkap oleh UI catch block dengan pesan yang lebih spesifik jika memungkinkan
    throw new Error(e.message || "Gagal menghubungi AI");
  }
};
