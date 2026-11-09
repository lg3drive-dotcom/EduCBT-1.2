export const GEMINI_QUESTION_PROMPT_TEMPLATE = `Bertindaklah sebagai pembuat soal ujian profesional untuk aplikasi E-Pro CBT. Buatkan paket soal ujian dalam format JSON ARRAY murni yang valid dan siap diimpor ke sistem tanpa kesalahan sintaks.

IKUTI ATURAN STRUKTUR JSON BERIKUT DENGAN KETAT:
1. Output WAJIB berupa JSON Array murni: [ { ... }, { ... } ]. Jangan ada teks pembuka atau penutup di luar JSON.
2. Setiap objek soal WAJIB memiliki properti berikut:
   - "id": string unik (contoh: "soal-1", "soal-2", dst).
   - "quizToken": string kode token ujian (HURUF KAPITAL, contoh: "PAS-IPA26").
   - "type": jenis soal, HANYA boleh salah satu dari 4 teks persis ini:
       a. "Pilihan Ganda"
       b. "Pilihan Jamak (MCMA)"
       c. "(Benar/Salah)"
       d. "(Sesuai/Tidak Sesuai)"
   - "subject": nama mata pelajaran (contoh: "IPAS", "Matematika", "Bahasa Indonesia", dll).
   - "material": topik / materi pokok bahasan.
   - "level": level kognitif (pilih salah satu: "C1 Mengingat", "C2 Memahami", "C3 Menerapkan", "C4 Menganalisis", "C5 Mengevaluasi", "Level 1", "Level 2", atau "Level 3").
   - "phase": fase kurikulum merdeka (contoh: "Fase A", "Fase B", "Fase C", "Fase D").
   - "order": nomor urut soal (angka integer: 1, 2, 3, dst).
   - "text": teks stimulus atau pertanyaan soal. Bila ada rumus matematika, gunakan sintaks LaTeX seperti $\\frac{1}{2}$ atau $x^2$.
   - "explanation": pembahasan / alasan jawaban benar.
   - "questionImage": isi string URL gambar stimulus 1 di ATAS teks soal atau string kosong "" (jika tidak ada gambar).
   - "bottomImage": isi string URL gambar stimulus 2 di BAWAH teks soal / sebelum opsi jawaban atau string kosong "" (jika tidak ada gambar).
   - "bottomText": isi string teks soal lanjutan / pertanyaan di bawah gambar kedua sebelum opsi jawaban (opsional, atau string kosong "").
   - "optionImages": Array URL gambar untuk masing-masing opsi/pernyataan jika butir opsi menggunakan gambar (opsional, contoh: ["https://link1.png", "https://link2.png"]).
   - "isDeleted": nilai boolean false.
   - "createdAt": angka timestamp milidetik (contoh: 1714500000000).

3. ATURAN "options" DAN "correctAnswer" SESUAI JENIS SOAL:
   A. Untuk "Pilihan Ganda":
      - "options": Array berisi 4 atau 5 pilihan teks: ["Opsi A", "Opsi B", "Opsi C", "Opsi D"].
      - "correctAnswer": Angka indeks jawaban yang benar (0 untuk A, 1 untuk B, 2 untuk C, 3 untuk D).
   
   B. Untuk "Pilihan Jamak (MCMA)":
      - "options": Array pilihan teks: ["Pilihan 1", "Pilihan 2", "Pilihan 3", "Pilihan 4"].
      - "correctAnswer": Array angka indeks semua pilihan yang benar, contoh: [0, 2] jika jawabannya pilihan ke-1 dan ke-3.

   C. Untuk "(Benar/Salah)":
      - "options": Array berisi daftar kalimat/pernyataan analisis, contoh: ["Pernyataan 1", "Pernyataan 2", "Pernyataan 3", "Pernyataan 4"].
      - "correctAnswer": Array boolean [true/false] yang urutannya sesuai dengan urutan pernyataan pada options, contoh: [true, false, false, true].
      - "tfLabels": { "true": "Benar", "false": "Salah" }.

   D. Untuk "(Sesuai/Tidak Sesuai)":
      - "options": Array berisi daftar kalimat pernyataan analisis.
      - "correctAnswer": Array boolean [true/false] sesuai urutan pernyataan, contoh: [true, false, true].
      - "tfLabels": { "true": "Sesuai", "false": "Tidak Sesuai" }.

CONTOH FORMAT OBJEK SOAL:
[
  {
    "id": "soal-1",
    "quizToken": "TOKEN-CONTOH",
    "type": "Pilihan Ganda",
    "subject": "IPAS",
    "material": "Tata Surya",
    "level": "C1 Mengingat",
    "phase": "Fase C",
    "order": 1,
    "text": "Planet terbesar dalam tata surya kita adalah ....",
    "options": ["Bumi", "Mars", "Yupiter", "Saturnus"],
    "correctAnswer": 2,
    "explanation": "Yupiter adalah planet terbesar di tata surya.",
    "questionImage": "",
    "bottomImage": "",
    "isDeleted": false,
    "createdAt": 1714500000000
  },
  {
    "id": "soal-2",
    "quizToken": "TOKEN-CONTOH",
    "type": "(Benar/Salah)",
    "subject": "IPAS",
    "material": "Tata Surya",
    "level": "C4 Menganalisis",
    "phase": "Fase C",
    "order": 2,
    "text": "Tentukan apakah setiap pernyataan mengenai benda langit berikut Benar atau Salah!",
    "options": [
      "Komet Halley muncul setiap 75-76 tahun sekali.",
      "Inti komet terdiri atas bebatuan beku yang sangat panas.",
      "Ceres adalah salah satu contoh planet kerdil."
    ],
    "correctAnswer": [true, false, true],
    "tfLabels": { "true": "Benar", "false": "Salah" },
    "explanation": "Inti komet bersuhu sangat dingin dan terbuat dari es serta debu.",
    "questionImage": "",
    "bottomImage": "",
    "isDeleted": false,
    "createdAt": 1714500000001
  }
]

============================================================
SILAKAN BUATKAN SOAL SESUAI PERMINTAAN SAYA BERIKUT:
- Mata Pelajaran: [Tulis Mata Pelajaran di sini, misal: IPAS]
- Topik / Materi: [Tulis Materi di sini, misal: Tata Surya dan Bumi]
- Fase / Kelas: [Misal: Fase C / Kelas 6]
- Kode Token Ujian: [Tulis Token di sini, misal: PAS-IPA26]
- Jumlah & Jenis Soal yang diinginkan: [Misal: 5 Pilihan Ganda, 3 Benar/Salah, 2 Pilihan Jamak]
============================================================`;
