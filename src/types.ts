export interface UserProfile {
  uid: string;
  email: string;
  nama: string;
  peran: 'dosen' | 'mahasiswa' | 'admin';
  nim_nip: string; // NIM untuk mahasiswa, NIP/NIDN untuk dosen
  createdAt: string;
}

export interface Course {
  id: string;
  kode: string; // Kode kelas unik untuk join
  nama: string;
  deskripsi: string;
  semester: string;
  dosenId: string;
  dosenNama: string;
  createdAt: string;
}

export interface Assignment {
  id: string;
  courseId: string;
  courseNama: string;
  judul: string;
  deskripsi: string;
  tenggatWaktu: string; // ISO string
  dosenId: string;
  createdAt: string;
}

export interface Submission {
  id: string; // `${assignmentId}_${studentId}`
  assignmentId: string;
  assignmentJudul: string;
  courseId: string;
  courseNama: string;
  studentId: string;
  studentNama: string;
  studentNim: string;
  fileNama: string;
  fileSize: number;
  fileType: string;
  fileData?: string; // Menyimpan data file (base64 atau text) untuk demonstrasi
  catatanMahasiswa?: string;
  nilai: number | null;
  catatanDosen?: string;
  status: 'dikumpul' | 'dinilai';
  submittedAt: string;
  gradedAt?: string;
}
