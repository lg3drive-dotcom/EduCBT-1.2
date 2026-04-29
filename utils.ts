
export const levenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, (_, i) => i)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[a.length][b.length];
};

export const getSimilarity = (s1: string, s2: string): number => {
  if (s1.length === 0 || s2.length === 0) return 0;
  const distance = levenshteinDistance(s1.toLowerCase(), s2.toLowerCase());
  const maxLength = Math.max(s1.length, s2.length);
  return 1 - distance / maxLength;
};

export const STUDENT_LIST = [
  "Aditya Naufal Syarif",
  "Ahmad Shidiq Badruzzaman",
  "Aila Fathiyyaturahma",
  "Arsyil Amirullah Akbar",
  "Az Zahra Rahayu",
  "Dennis Satya Albinov",
  "Fahmi Arsyl Alfiansyah",
  "Farrel Rais Nur Muhammad",
  "Hauzan Irhab Nabil",
  "Iqbhal Fiqih Anggara",
  "Ismi Fadhilatul Ayyami",
  "Muhamad Ardiansyah",
  "Muhamad Rayhan Andrianto",
  "Muhammad Fadlan Giyan Ramadhan",
  "Muhammad Faizi Lathiif",
  "Muhammad Hamzah Ramadhan",
  "Muhammad Rasyid Alfaqih",
  "Muhammad Reyva Pramodza",
  "Nada Fajria Salsabila",
  "Qisya Izz Zara Suhendar",
  "Raisa Agustina Zahra",
  "Rega Micka Alfarizky",
  "Satria Putra Ardian",
  "Shakira Alisha Raihanda",
  "Soekarno Fariz Nugroho",
  "Sopia Wardani",
  "Sri Puji Wulandari"
];
