
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

export interface DeviceStudent {
  name: string;
  className?: string;
  schoolOrigin?: string;
  birthDate?: string;
  lastUsed: number;
}

const STORAGE_KEY_DEVICE_STUDENTS = 'epro_cbt_device_students';

export const getDeviceStudents = (): DeviceStudent[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_DEVICE_STUDENTS);
    if (!data) return [];
    const list: DeviceStudent[] = JSON.parse(data);
    if (Array.isArray(list)) {
      return list.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));
    }
    return [];
  } catch (err) {
    console.error('Error reading device students:', err);
    return [];
  }
};

export const saveDeviceStudent = (student: {
  name: string;
  className?: string;
  schoolOrigin?: string;
  birthDate?: string;
}): void => {
  try {
    const trimmed = student.name.trim();
    if (!trimmed || trimmed.length < 2) return;

    const list = getDeviceStudents();
    const filtered = list.filter(s => s.name.toLowerCase() !== trimmed.toLowerCase());

    const newRecord: DeviceStudent = {
      name: trimmed,
      className: student.className?.trim() || '',
      schoolOrigin: student.schoolOrigin?.trim() || '',
      birthDate: student.birthDate || '',
      lastUsed: Date.now()
    };

    const updated = [newRecord, ...filtered].slice(0, 30);
    localStorage.setItem(STORAGE_KEY_DEVICE_STUDENTS, JSON.stringify(updated));
  } catch (err) {
    console.error('Error saving device student:', err);
  }
};

export const removeDeviceStudent = (nameToRemove: string): DeviceStudent[] => {
  try {
    const list = getDeviceStudents();
    const filtered = list.filter(s => s.name.toLowerCase() !== nameToRemove.trim().toLowerCase());
    localStorage.setItem(STORAGE_KEY_DEVICE_STUDENTS, JSON.stringify(filtered));
    return filtered;
  } catch (err) {
    console.error('Error deleting device student:', err);
    return [];
  }
};

export const clearDeviceStudents = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY_DEVICE_STUDENTS);
  } catch (err) {
    console.error('Error clearing device students:', err);
  }
};

// Deprecated empty array for backward compatibility
export const STUDENT_LIST: string[] = [];

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    // fallback below
  }
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    return false;
  }
};
