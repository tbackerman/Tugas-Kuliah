import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  query,
  orderBy,
  addDoc
} from 'firebase/firestore';
import { 
  Users, 
  GraduationCap, 
  BookOpen, 
  Shield, 
  FileText, 
  Trash2, 
  Edit, 
  Search, 
  Filter, 
  Calendar, 
  Award, 
  AlertCircle, 
  Eye, 
  ArrowLeft,
  Settings,
  Check,
  X,
  Plus,
  Download,
  Cloud,
  RefreshCw,
  ExternalLink,
  Lock,
  CheckCircle
} from 'lucide-react';
import { UserProfile, Course, Assignment, Submission } from '../types';

interface AdminDashboardProps {
  profile: UserProfile;
}

type TabType = 'users' | 'courses' | 'assignments' | 'submissions' | 'google-drive';

export default function AdminDashboard({ profile }: AdminDashboardProps) {
  // States for main entities
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('users');

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'mahasiswa' | 'dosen' | 'admin'>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [prodiFilter, setProdiFilter] = useState<string>('all');
  const [angkatanFilter, setAngkatanFilter] = useState<string>('all');

  // Edit/View Dialog States
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserNimNip, setEditUserNimNip] = useState('');
  const [editUserPeran, setEditUserPeran] = useState<'mahasiswa' | 'dosen' | 'admin'>('mahasiswa');

  // Course Modal & Form States (Admin CRUD)
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseName, setCourseName] = useState('');
  const [courseDesc, setCourseDesc] = useState('');
  const [courseSemester, setCourseSemester] = useState('Ganjil 2026/2027');
  const [courseDosenId, setCourseDosenId] = useState('');
  const [courseKode, setCourseKode] = useState('');
  const [courseProdi, setCourseProdi] = useState('S1 PGSD');
  const [courseAngkatan, setCourseAngkatan] = useState('2024');

  // Assignment Modal & Form States (Admin CRUD)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');

  // Google Drive Integration States
  const [driveConfig, setDriveConfig] = useState<{
    connected: boolean;
    email?: string;
    clientId?: string;
    mainFolderId?: string;
    connectedAt?: string;
  } | null>(null);

  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [isDriveConnecting, setIsDriveConnecting] = useState(false);
  const [driveMessage, setDriveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Load Google Drive Config
  const fetchDriveConfig = async () => {
    try {
      const res = await fetch('/api/drive/config');
      const responseText = await res.text();
      if (res.ok) {
        const data = JSON.parse(responseText);
        setDriveConfig(data);
        if (data.connected && data.clientId) {
          setClientIdInput(data.clientId);
        } else if (!data.connected && data.suggestedClientId) {
          setClientIdInput(data.suggestedClientId);
        }
      } else {
        console.error("Gagal mengambil konfigurasi Google Drive. Status:", res.status, responseText);
      }
    } catch (e) {
      console.error("Gagal mengambil konfigurasi Google Drive:", e);
    }
  };

  const handleCompleteDriveAuth = async (code: string) => {
    setIsDriveConnecting(true);
    setDriveMessage(null);
    try {
      const res = await fetch('/api/drive/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          redirectUri: window.location.origin
        })
      });

      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Gagal mengurai respons JSON:", responseText, parseError);
        throw new Error(`Respons server bukan JSON (Status: ${res.status} ${res.statusText}). Isi respons: ${responseText.slice(0, 150)}`);
      }

      if (res.ok && data.success) {
        setDriveMessage({
          type: 'success',
          text: `Google Drive berhasil dihubungkan! Akun terhubung: ${data.email}`
        });
        // Clear query parameters from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        fetchDriveConfig();
      } else {
        setDriveMessage({
          type: 'error',
          text: data.error || 'Gagal menghubungkan Google Drive.'
        });
      }
    } catch (e: any) {
      console.error("Kesalahan koneksi Drive:", e);
      setDriveMessage({
        type: 'error',
        text: `Kesalahan saat menghubungkan Google Drive: ${e?.message || e || 'Koneksi gagal'}. Silakan periksa kredensial Anda dan coba lagi.`
      });
    } finally {
      setIsDriveConnecting(false);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingCredentials(true);
    setDriveMessage(null);

    try {
      const res = await fetch('/api/drive/save-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          clientId: clientIdInput,
          clientSecret: clientSecretInput
        })
      });

      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Gagal mengurai respons JSON:", responseText, parseError);
        throw new Error(`Respons server bukan JSON (Status: ${res.status} ${res.statusText}).`);
      }

      if (res.ok && data.success) {
        setDriveMessage({
          type: 'success',
          text: 'Kredensial berhasil disimpan! Sekarang silakan klik "Hubungkan Akun Google Drive" di bawah.'
        });
        fetchDriveConfig();
      } else {
        setDriveMessage({
          type: 'error',
          text: data.error || 'Gagal menyimpan kredensial.'
        });
      }
    } catch (e: any) {
      console.error("Kesalahan menyimpan kredensial:", e);
      setDriveMessage({
        type: 'error',
        text: `Terjadi kesalahan saat menyimpan kredensial: ${e?.message || e || 'Koneksi gagal'}`
      });
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const handleInitiateOAuth = () => {
    if (!clientIdInput) {
      alert('Simpan Client ID terlebih dahulu!');
      return;
    }

    const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
      `client_id=${encodeURIComponent(clientIdInput)}&` +
      `redirect_uri=${encodeURIComponent(window.location.origin)}&` +
      `response_type=code&` +
      `scope=${encodeURIComponent(scope)}&` +
      `access_type=offline&` +
      `prompt=consent`;

    window.location.href = authUrl;
  };

  const handleDisconnectDrive = async () => {
    if (confirm('Apakah Anda yakin ingin memutuskan hubungan Google Drive? Kredensial akan dihapus, tetapi folder yang sudah ada di Google Drive Anda tetap aman.')) {
      try {
        const res = await fetch('/api/drive/disconnect', { method: 'POST' });
        if (res.ok) {
          setClientIdInput('');
          setClientSecretInput('');
          setDriveConfig({ connected: false });
          setDriveMessage({
            type: 'success',
            text: 'Google Drive berhasil diputuskan!'
          });
        }
      } catch (e) {
        alert('Gagal memutuskan Google Drive.');
      }
    }
  };

  // Load Firestore data using live snapshots for real-time responsiveness
  useEffect(() => {
    fetchDriveConfig();

    // Check if there is an authorization code in the URL
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      handleCompleteDriveAuth(code);
    }

    setLoading(true);

    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snapshot) => {
      const usersData: UserProfile[] = [];
      snapshot.forEach((doc) => {
        usersData.push(doc.data() as UserProfile);
      });
      setAllUsers(usersData);
    }, (err) => console.error("Error loading users:", err));

    const coursesQuery = query(collection(db, 'courses'), orderBy('createdAt', 'desc'));
    const unsubscribeCourses = onSnapshot(coursesQuery, (snapshot) => {
      const coursesData: Course[] = [];
      snapshot.forEach((doc) => {
        coursesData.push({ id: doc.id, ...doc.data() } as Course);
      });
      setAllCourses(coursesData);
    }, (err) => console.error("Error loading courses:", err));

    const assignmentsQuery = query(collection(db, 'assignments'), orderBy('createdAt', 'desc'));
    const unsubscribeAssignments = onSnapshot(assignmentsQuery, (snapshot) => {
      const assignmentsData: Assignment[] = [];
      snapshot.forEach((doc) => {
        assignmentsData.push({ id: doc.id, ...doc.data() } as Assignment);
      });
      setAllAssignments(assignmentsData);
    }, (err) => console.error("Error loading assignments:", err));

    const submissionsQuery = query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'));
    const unsubscribeSubmissions = onSnapshot(submissionsQuery, (snapshot) => {
      const submissionsData: Submission[] = [];
      snapshot.forEach((doc) => {
        submissionsData.push({ id: doc.id, ...doc.data() } as Submission);
      });
      setAllSubmissions(submissionsData);
      setLoading(false);
    }, (err) => console.error("Error loading submissions:", err));

    return () => {
      unsubscribeUsers();
      unsubscribeCourses();
      unsubscribeAssignments();
      unsubscribeSubmissions();
    };
  }, []);

  // Compute Platform Stats
  const stats = {
    totalStudents: allUsers.filter(u => u.peran === 'mahasiswa').length,
    totalLecturers: allUsers.filter(u => u.peran === 'dosen').length,
    totalAdmins: allUsers.filter(u => u.peran === 'admin').length,
    totalCourses: allCourses.length,
    totalAssignments: allAssignments.length,
    totalSubmissions: allSubmissions.length,
    uncompletedSubmissions: allSubmissions.filter(s => s.status === 'dikumpul').length
  };

  // Helper code generator
  const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // 1. User Handlers
  const handleEditUserClick = (u: UserProfile) => {
    setEditingUser(u);
    setEditUserName(u.nama);
    setEditUserNimNip(u.nim_nip);
    setEditUserPeran(u.peran);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const userRef = doc(db, 'users', editingUser.uid);
      await updateDoc(userRef, {
        nama: editUserName,
        nim_nip: editUserNimNip,
        peran: editUserPeran
      });
      setEditingUser(null);
      alert('Profil pengguna berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      alert('Gagal memperbarui pengguna: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (uid === profile.uid) {
      alert('Anda tidak bisa menghapus akun Anda sendiri!');
      return;
    }
    if (confirm(`Apakah Anda yakin ingin menghapus akun pengguna "${name}"? Semua data profil akan dihapus di Firestore.`)) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        alert('Pengguna berhasil dihapus.');
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus pengguna.');
      }
    }
  };

  // 2. Class (Course) Handlers
  const handleAddCourseClick = () => {
    setEditingCourse(null);
    setCourseName('');
    setCourseDesc('');
    setCourseSemester('Ganjil 2026/2027');
    const lecturers = allUsers.filter(u => u.peran === 'dosen');
    setCourseDosenId(lecturers[0]?.uid || '');
    setCourseKode(generateJoinCode());
    setCourseProdi('S1 PGSD');
    setCourseAngkatan('2024');
    setShowCourseModal(true);
  };

  const handleEditCourseClick = (course: Course) => {
    setEditingCourse(course);
    setCourseName(course.nama);
    setCourseDesc(course.deskripsi || '');
    setCourseSemester(course.semester);
    setCourseDosenId(course.dosenId);
    setCourseKode(course.kode);
    setCourseProdi(course.prodi || 'S1 PGSD');
    setCourseAngkatan(course.angkatan || '2024');
    setShowCourseModal(true);
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseName.trim() || !courseDosenId) {
      alert('Nama kelas dan dosen pengampu wajib diisi!');
      return;
    }

    const selectedDosen = allUsers.find(u => u.uid === courseDosenId);
    if (!selectedDosen) {
      alert('Dosen pengampu tidak ditemukan di database!');
      return;
    }

    try {
      if (editingCourse) {
        // Edit Mode
        const courseRef = doc(db, 'courses', editingCourse.id);
        await updateDoc(courseRef, {
          nama: courseName,
          deskripsi: courseDesc,
          semester: courseSemester,
          dosenId: selectedDosen.uid,
          dosenNama: selectedDosen.nama,
          kode: courseKode,
          prodi: courseProdi,
          angkatan: courseAngkatan
        });
        
        // Also update courseNama in related assignments
        const relatedAssignments = allAssignments.filter(a => a.courseId === editingCourse.id);
        for (const assign of relatedAssignments) {
          await updateDoc(doc(db, 'assignments', assign.id), {
            courseNama: courseName,
            dosenId: selectedDosen.uid
          });
        }

        // Also update courseNama in related submissions
        const relatedSubmissions = allSubmissions.filter(s => s.courseId === editingCourse.id);
        for (const sub of relatedSubmissions) {
          await updateDoc(doc(db, 'submissions', sub.id), {
            courseNama: courseName
          });
        }

        alert('Kelas berhasil diperbarui!');
      } else {
        // Create Mode
        const courseData = {
          nama: courseName,
          deskripsi: courseDesc,
          semester: courseSemester,
          dosenId: selectedDosen.uid,
          dosenNama: selectedDosen.nama,
          kode: courseKode || generateJoinCode(),
          createdAt: new Date().toISOString(),
          prodi: courseProdi,
          angkatan: courseAngkatan
        };
        const docRef = await addDoc(collection(db, 'courses'), courseData);
        
        // Auto-create Google Drive folder if integrated
        if (driveConfig?.connected) {
          try {
            await fetch('/api/drive/create-course-folder', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseId: docRef.id, courseNama: courseName })
            });
          } catch (driveErr) {
            console.error("Gagal membuat folder Google Drive secara otomatis:", driveErr);
          }
        }
        
        alert('Kelas baru berhasil ditambahkan!');
      }
      setShowCourseModal(false);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan kelas: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteCourse = async (courseId: string, courseName: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus kelas "${courseName}"?\nTindakan ini permanen dan akan menghapus semua tugas & pengumpulan di dalam kelas ini!`)) {
      try {
        // Hapus kelas
        await deleteDoc(doc(db, 'courses', courseId));

        // Bersihkan tugas dan pengumpulan terkait kelas ini secara manual di Firestore
        const relatedAssignments = allAssignments.filter(a => a.courseId === courseId);
        for (const assign of relatedAssignments) {
          await deleteDoc(doc(db, 'assignments', assign.id));
        }

        const relatedSubmissions = allSubmissions.filter(s => s.courseId === courseId);
        for (const sub of relatedSubmissions) {
          await deleteDoc(doc(db, 'submissions', sub.id));
        }

        alert('Kelas dan seluruh data terkait berhasil dihapus!');
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus kelas.');
      }
    }
  };

  // 3. Assignment Handlers
  const handleAddAssignmentClick = () => {
    setEditingAssignment(null);
    setAssignTitle('');
    setAssignDesc('');
    setAssignCourseId(allCourses[0]?.id || '');
    
    // Default due date to tomorrow at 23:59
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 0, 0);
    const offset = tomorrow.getTimezoneOffset();
    const localTomorrow = new Date(tomorrow.getTime() - offset * 60 * 1000);
    setAssignDueDate(localTomorrow.toISOString().slice(0, 16));
    setShowAssignmentModal(true);
  };

  const handleEditAssignmentClick = (assign: Assignment) => {
    setEditingAssignment(assign);
    setAssignTitle(assign.judul);
    setAssignDesc(assign.deskripsi);
    setAssignCourseId(assign.courseId);
    
    try {
      const date = new Date(assign.tenggatWaktu);
      const offset = date.getTimezoneOffset();
      const localDate = new Date(date.getTime() - offset * 60 * 1000);
      setAssignDueDate(localDate.toISOString().slice(0, 16));
    } catch (e) {
      setAssignDueDate('');
    }
    setShowAssignmentModal(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTitle.trim() || !assignCourseId || !assignDueDate) {
      alert('Judul tugas, kelas, dan tenggat waktu wajib diisi!');
      return;
    }

    const selectedCourse = allCourses.find(c => c.id === assignCourseId);
    if (!selectedCourse) {
      alert('Kelas tidak ditemukan!');
      return;
    }

    try {
      const formattedDueDate = new Date(assignDueDate).toISOString();
      if (editingAssignment) {
        // Edit Mode
        const assignRef = doc(db, 'assignments', editingAssignment.id);
        await updateDoc(assignRef, {
          judul: assignTitle,
          deskripsi: assignDesc,
          courseId: selectedCourse.id,
          courseNama: selectedCourse.nama,
          tenggatWaktu: formattedDueDate,
          dosenId: selectedCourse.dosenId
        });

        // Also update assignmentJudul & courseNama in related submissions
        const relatedSubmissions = allSubmissions.filter(s => s.assignmentId === editingAssignment.id);
        for (const sub of relatedSubmissions) {
          await updateDoc(doc(db, 'submissions', sub.id), {
            assignmentJudul: assignTitle,
            courseId: selectedCourse.id,
            courseNama: selectedCourse.nama
          });
        }

        alert('Tugas berhasil diperbarui!');
      } else {
        // Create Mode
        const assignmentData = {
          courseId: selectedCourse.id,
          courseNama: selectedCourse.nama,
          judul: assignTitle,
          deskripsi: assignDesc,
          tenggatWaktu: formattedDueDate,
          dosenId: selectedCourse.dosenId,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'assignments'), assignmentData);
        alert('Tugas baru berhasil ditambahkan!');
      }
      setShowAssignmentModal(false);
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan tugas: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  const handleDeleteAssignment = async (assignId: string, title: string) => {
    if (confirm(`Apakah Anda yakin ingin menghapus tugas "${title}"?\nSemua file pengumpulan mahasiswa untuk tugas ini juga akan terhapus.`)) {
      try {
        await deleteDoc(doc(db, 'assignments', assignId));
        
        const relatedSubmissions = allSubmissions.filter(s => s.assignmentId === assignId);
        for (const sub of relatedSubmissions) {
          await deleteDoc(doc(db, 'submissions', sub.id));
        }

        alert('Tugas berhasil dihapus!');
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus tugas.');
      }
    }
  };

  // 4. Submission Handlers & Download Functionality
  const handleDownloadSubmission = (sub: Submission) => {
    if (!sub.fileData) {
      alert("Tidak ada isi berkas yang dapat diunduh.");
      return;
    }

    try {
      let blob: Blob;
      if (sub.fileData.startsWith('data:') || sub.fileType?.includes('image/')) {
        // Base64 URI data fallback handling
        const parts = sub.fileData.split(';base64,');
        const contentType = parts[0].split(':')[1] || sub.fileType || 'application/octet-stream';
        const raw = window.atob(parts[1] || parts[0]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
          uInt8Array[i] = raw.charCodeAt(i);
        }
        blob = new Blob([uInt8Array], { type: contentType });
      } else {
        // Plain text / standard code string
        blob = new Blob([sub.fileData], { type: sub.fileType || 'text/plain' });
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sub.fileNama;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      // Plain text backup
      const blob = new Blob([sub.fileData], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = sub.fileNama;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    }
  };

  const handleDeleteSubmission = async (subId: string, studentName: string) => {
    if (confirm(`Hapus pengumpulan tugas milik "${studentName}"?`)) {
      try {
        await deleteDoc(doc(db, 'submissions', subId));
        alert('Pengumpulan tugas berhasil dihapus.');
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus pengumpulan.');
      }
    }
  };

  // Filter lists based on Search & Filter options
  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = 
      u.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nim_nip.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || u.peran === roleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredCourses = allCourses.filter(c => {
    const matchesSearch = c.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.dosenNama.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesProdi = prodiFilter === 'all' || c.prodi === prodiFilter;
    const matchesAngkatan = angkatanFilter === 'all' || c.angkatan === angkatanFilter;
    return matchesSearch && matchesProdi && matchesAngkatan;
  });

  const filteredAssignments = allAssignments.filter(a => {
    const matchesSearch = 
      a.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.courseNama.toLowerCase().includes(searchQuery.toLowerCase());
    
    const relatedCourse = allCourses.find(c => c.id === a.courseId);
    const matchesProdi = prodiFilter === 'all' || (relatedCourse && relatedCourse.prodi === prodiFilter);
    const matchesAngkatan = angkatanFilter === 'all' || (relatedCourse && relatedCourse.angkatan === angkatanFilter);
    const matchesCourse = courseFilter === 'all' || a.courseId === courseFilter;
    return matchesSearch && matchesProdi && matchesAngkatan && matchesCourse;
  });

  const filteredSubmissions = allSubmissions.filter(s => {
    const matchesSearch = 
      s.studentNama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentNim.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assignmentJudul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.courseNama.toLowerCase().includes(searchQuery.toLowerCase());

    const relatedCourse = allCourses.find(c => c.id === s.courseId);
    const matchesProdi = prodiFilter === 'all' || (relatedCourse && relatedCourse.prodi === prodiFilter);
    const matchesAngkatan = angkatanFilter === 'all' || (relatedCourse && relatedCourse.angkatan === angkatanFilter);
    const matchesCourse = courseFilter === 'all' || s.courseId === courseFilter;
    return matchesSearch && matchesProdi && matchesAngkatan && matchesCourse;
  });

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-slate-500">
        Memuat data panel admin secara real-time...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-amber-600 mb-1.5 font-bold text-xs tracking-wider uppercase">
            <Shield className="h-4 w-4" />
            Super Administrator Portal
          </div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Dashboard Utama Admin
          </h1>
          <p className="text-slate-500 mt-1">
            Selamat datang, <span className="font-semibold text-slate-800">{profile.nama}</span>. Kelola seluruh database pengguna, mata kuliah, tugas, dan pengumpulan di sini.
          </p>
        </div>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Mahasiswa</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">{stats.totalStudents}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Dosen</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">{stats.totalLecturers}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
            <Calendar className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Kelas & Tugas</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">{stats.totalCourses} / {stats.totalAssignments}</h3>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Submissions</p>
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-800 mt-0.5">
              {stats.totalSubmissions}{' '}
              {stats.uncompletedSubmissions > 0 && (
                <span className="text-xs text-amber-600 font-bold">({stats.uncompletedSubmissions} baru)</span>
              )}
            </h3>
          </div>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => { setActiveTab('users'); setSearchQuery(''); }}
            className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="h-4 w-4" />
            Manajemen Akun ({allUsers.length})
          </button>
          <button
            onClick={() => { setActiveTab('courses'); setSearchQuery(''); }}
            className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'courses'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="h-4 w-4" />
            Daftar Kelas ({allCourses.length})
          </button>
          <button
            onClick={() => { setActiveTab('assignments'); setSearchQuery(''); }}
            className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'assignments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Calendar className="h-4 w-4" />
            Tugas Kuliah ({allAssignments.length})
          </button>
          <button
            onClick={() => { setActiveTab('submissions'); setSearchQuery(''); }}
            className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'submissions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="h-4 w-4" />
            Audit Pengumpulan ({allSubmissions.length})
          </button>
          <button
            onClick={() => { setActiveTab('google-drive'); setSearchQuery(''); }}
            className={`pb-4 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'google-drive'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cloud className="h-4 w-4" />
            Google Drive
          </button>
        </nav>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 font-sans">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'users' 
                ? 'Cari nama, email, atau NIM/NIP...' 
                : activeTab === 'courses' 
                ? 'Cari nama kelas, kode kelas, atau nama dosen...' 
                : activeTab === 'assignments'
                ? 'Cari judul tugas atau kelas...'
                : 'Cari nama mahasiswa, NIM, atau tugas...'
            }
            className="block w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
          />
        </div>

        {/* Action Controls Side */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Tab-Specific Filters */}
          {activeTab === 'users' && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="block rounded-xl border border-slate-300 py-2 px-3 text-xs font-semibold text-slate-700 bg-white focus:border-blue-500"
              >
                <option value="all">Semua Peran</option>
                <option value="mahasiswa">Peran: Mahasiswa</option>
                <option value="dosen">Peran: Dosen</option>
                <option value="admin">Peran: Admin</option>
              </select>
            </div>
          )}

          {(activeTab === 'assignments' || activeTab === 'submissions') && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="block rounded-xl border border-slate-300 py-2 px-3 text-xs font-semibold text-slate-700 bg-white focus:border-blue-500"
              >
                <option value="all">Semua Mata Kuliah</option>
                {allCourses.map(c => (
                  <option key={c.id} value={c.id}>{c.nama}</option>
                ))}
              </select>
            </div>
          )}

          {(activeTab === 'courses' || activeTab === 'assignments' || activeTab === 'submissions') && (
            <>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <select
                  value={prodiFilter}
                  onChange={(e) => setProdiFilter(e.target.value)}
                  className="block rounded-xl border border-slate-300 py-2 px-3 text-xs font-semibold text-slate-700 bg-white focus:border-blue-500"
                >
                  <option value="all">Semua Prodi</option>
                  <option value="S1 PGSD">S1 PGSD</option>
                  <option value="S1PMAT">S1PMAT</option>
                  <option value="S1PIPA">S1PIPA</option>
                  <option value="S1PBING">S1PBING</option>
                  <option value="S1PBSI">S1PBSI</option>
                  <option value="S2PBI">S2PBI</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <select
                  value={angkatanFilter}
                  onChange={(e) => setAngkatanFilter(e.target.value)}
                  className="block rounded-xl border border-slate-300 py-2 px-3 text-xs font-semibold text-slate-700 bg-white focus:border-blue-500"
                >
                  <option value="all">Semua Angkatan</option>
                  <option value="2021">Angkatan 2021</option>
                  <option value="2022">Angkatan 2022</option>
                  <option value="2023">Angkatan 2023</option>
                  <option value="2024">Angkatan 2024</option>
                  <option value="2025">Angkatan 2025</option>
                  <option value="2026">Angkatan 2026</option>
                  <option value="2027">Angkatan 2027</option>
                </select>
              </div>
            </>
          )}

          {/* Quick Creator Shortcuts */}
          {activeTab === 'courses' && (
            <button
              onClick={handleAddCourseClick}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-100"
            >
              <Plus className="h-4 w-4" />
              Tambah Kelas
            </button>
          )}

          {activeTab === 'assignments' && (
            <button
              onClick={handleAddAssignmentClick}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-100"
            >
              <Plus className="h-4 w-4" />
              Tambah Tugas
            </button>
          )}
        </div>
      </div>

      {/* ACTIVE TAB DISPLAY CONTENT */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* TAB 1: USERS */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">Tidak ada pengguna yang cocok dengan kriteria pencarian.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Identitas Pengguna</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Peran</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">NIM / NIP</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Daftar</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredUsers.map((userObj) => (
                    <tr key={userObj.uid} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{userObj.nama}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{userObj.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {userObj.peran === 'mahasiswa' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Mahasiswa
                          </span>
                        ) : userObj.peran === 'dosen' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                            Dosen
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Admin
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs text-slate-600 font-bold">
                        {userObj.nim_nip || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {userObj.createdAt ? new Date(userObj.createdAt).toLocaleString('id-ID', { dateStyle: 'medium' }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditUserClick(userObj)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Akun"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(userObj.uid, userObj.nama)}
                            disabled={userObj.uid === profile.uid}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition disabled:text-slate-300"
                            title="Hapus Akun"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 2: COURSES */}
        {activeTab === 'courses' && (
          <div className="overflow-x-auto">
            {filteredCourses.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">Tidak ada kelas kuliah aktif di sistem.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mata Kuliah & Kode</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Semester</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dosen Pengampu</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dibuat Pada</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredCourses.map((course) => (
                    <tr key={course.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{course.nama}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="text-[11px] bg-blue-50 text-blue-700 font-mono font-bold px-2 py-0.5 rounded border border-blue-100 tracking-wider">
                            KODE: {course.kode}
                          </span>
                          {course.prodi && (
                            <span className="text-[11px] bg-purple-50 text-purple-700 font-semibold px-2 py-0.5 rounded border border-purple-100">
                              {course.prodi}
                            </span>
                          )}
                          {course.angkatan && (
                            <span className="text-[11px] bg-amber-50 text-amber-700 font-semibold px-2 py-0.5 rounded border border-amber-100">
                              Angkatan {course.angkatan}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                          {course.semester}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-700">{course.dosenNama}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">ID: {course.dosenId}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {course.createdAt ? new Date(course.createdAt).toLocaleString('id-ID', { dateStyle: 'medium' }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditCourseClick(course)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Ubah Kelas"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCourse(course.id, course.nama)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus Kelas"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 3: ASSIGNMENTS */}
        {activeTab === 'assignments' && (
          <div className="overflow-x-auto">
            {filteredAssignments.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">Tidak ada tugas kuliah yang terdaftar di kelas.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Judul & Instruksi Tugas</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mata Kuliah</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tenggat Waktu</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Dibuat Pada</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredAssignments.map((assign) => (
                    <tr key={assign.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4 max-w-sm">
                        <div className="font-bold text-slate-800 line-clamp-1">{assign.judul}</div>
                        <div className="text-xs text-slate-400 line-clamp-2 mt-1">{assign.deskripsi}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-700">{assign.courseNama}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-semibold text-xs text-amber-700">
                        {assign.tenggatWaktu ? new Date(assign.tenggatWaktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-400">
                        {assign.createdAt ? new Date(assign.createdAt).toLocaleString('id-ID', { dateStyle: 'medium' }) : '-'}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditAssignmentClick(assign)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Ubah Tugas"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assign.id, assign.judul)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus Tugas"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 4: SUBMISSIONS */}
        {activeTab === 'submissions' && (
          <div className="overflow-x-auto">
            {filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-slate-400 font-medium">Tidak ada pengumpulan tugas mahasiswa di sistem.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mahasiswa</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Tugas & Kelas</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">File Pengumpulan</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Nilai / Status</th>
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredSubmissions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-slate-50/50 transition">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800">{sub.studentNama}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">NIM: {sub.studentNim}</div>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="font-semibold text-slate-700 truncate">{sub.assignmentJudul}</div>
                        <div className="text-xs text-slate-400 truncate">{sub.courseNama}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <div className="font-semibold text-xs text-slate-700 max-w-[150px] truncate">{sub.fileNama}</div>
                          {sub.driveFileUrl && (
                            <a 
                              href={sub.driveFileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              title="Tersimpan di Google Drive"
                              className="text-emerald-600 hover:text-emerald-700 flex-shrink-0"
                            >
                              <Cloud className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{(sub.fileSize / 1024).toFixed(1)} KB</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {sub.status === 'dinilai' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                            Nilai: {sub.nilai}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                            Belum Dinilai
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setViewingSubmission(sub)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Lihat Berkas"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadSubmission(sub)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Unduh Berkas"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSubmission(sub.id, sub.studentNama)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition"
                            title="Hapus Pengumpulan"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB 5: GOOGLE DRIVE CONFIG */}
        {activeTab === 'google-drive' && (
          <div className="p-6 sm:p-8 space-y-8 font-sans">
            <div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Cloud className="h-6 w-6 text-blue-600" />
                Integrasi Penyimpanan Google Drive
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                Gunakan Google Drive dari akun pilihan Anda untuk menampung file pengumpulan mahasiswa. Setiap kelas baru yang dibuat akan otomatis memiliki folder kelas tersendiri di Drive Anda.
              </p>
            </div>

            {driveMessage && (
              <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${
                driveMessage.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                  : 'bg-red-50 text-red-800 border-red-100'
              }`}>
                {driveMessage.type === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                )}
                <div>{driveMessage.text}</div>
              </div>
            )}

            {/* STATUS CONTAINER */}
            {driveConfig?.connected ? (
              <div className="bg-emerald-50/40 rounded-2xl border border-emerald-100 p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-500 text-white p-3 rounded-full">
                      <Check className="h-6 w-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest block">Status Integrasi</span>
                      <h3 className="text-base font-bold text-slate-800">Google Drive Berhasil Terhubung!</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Menggunakan akun: <span className="font-bold text-slate-800">{driveConfig.email}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    <a
                      href={`https://drive.google.com/drive/folders/${driveConfig.mainFolderId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 shadow-sm transition"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Buka Folder Utama di Drive
                    </a>
                    <button
                      onClick={handleDisconnectDrive}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs shadow-md shadow-red-100 transition cursor-pointer"
                    >
                      Putuskan Hubungan
                    </button>
                  </div>
                </div>

                <div className="border-t border-emerald-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600">
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wider text-[10px]">Folder Master</span>
                    <span className="font-semibold text-slate-700">Pengumpulan Tugas FIP</span> (ID: <span className="font-mono">{driveConfig.mainFolderId}</span>)
                  </div>
                  <div>
                    <span className="font-bold text-slate-400 block uppercase tracking-wider text-[10px]">Terhubung Sejak</span>
                    <span className="font-semibold text-slate-700">
                      {driveConfig.connectedAt ? new Date(driveConfig.connectedAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '-'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50/40 rounded-2xl border border-amber-100 p-6 flex items-start gap-4">
                <div className="bg-amber-500 text-white p-3 rounded-xl mt-0.5">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-800">Belum Terhubung dengan Google Drive</h3>
                  <p className="text-xs text-slate-500 leading-relaxed font-sans">
                    Saat ini semua berkas yang dikumpulkan mahasiswa disimpan di database Firestore lokal dengan kapasitas terbatas (maks 5MB/berkas). Hubungkan dengan akun Google Drive Anda (atau akun Google sekunder/lainnya milik fakultas/prodi) untuk mendapatkan kapasitas penyimpanan yang besar dan pengorganisasian otomatis.
                  </p>
                </div>
              </div>
            )}

            {/* CREDENTIALS FORM & INSTRUCTIONS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Form Side */}
              <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
                <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Settings className="h-5 w-5 text-slate-500" />
                  Konfigurasi Kredensial OAuth 2.0
                </h3>

                <form onSubmit={handleSaveCredentials} className="space-y-4 text-sm text-slate-700">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      1. Redirect URI Aplikasi (Salin ke Google Console)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={window.location.origin}
                        className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-xs text-slate-600 font-mono focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          alert('Redirect URI berhasil disalin ke papan klip!');
                        }}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs border border-slate-200 transition flex-shrink-0 cursor-pointer"
                      >
                        Salin
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      2. Google Client ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 123456-abcde.apps.googleusercontent.com"
                      value={clientIdInput}
                      onChange={(e) => setClientIdInput(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 font-mono text-xs text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      3. Google Client Secret
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Masukkan Client Secret Google Cloud"
                      value={clientSecretInput}
                      onChange={(e) => setClientSecretInput(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400 font-mono text-xs"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100">
                    <button
                      type="submit"
                      disabled={isSavingCredentials}
                      className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-100 transition cursor-pointer"
                    >
                      {isSavingCredentials ? 'Menyimpan...' : 'Simpan Kredensial'}
                    </button>

                    {clientIdInput && (
                      <button
                        type="button"
                        onClick={handleInitiateOAuth}
                        disabled={isDriveConnecting}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-100 transition cursor-pointer"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${isDriveConnecting ? 'animate-spin' : ''}`} />
                        {isDriveConnecting ? 'Menghubungkan...' : 'Hubungkan Akun Google Drive'}
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Instructions Side */}
              <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-200 p-6 space-y-4 text-xs text-slate-600 leading-relaxed font-sans">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-2">
                  <Lock className="h-4 w-4 text-slate-500" />
                  Cara Mendapatkan Kredensial (2 Menit)
                </h3>
                <ol className="list-decimal list-inside space-y-3">
                  <li>
                    Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-bold hover:underline inline-flex items-center gap-0.5">Google Cloud Console <ExternalLink className="h-2.5 w-2.5" /></a> dan masuk dengan akun Google Drive target Anda.
                  </li>
                  <li>
                    Buat proyek baru, lalu buka menu <strong>APIs & Services &gt; Library</strong>, cari <strong>"Google Drive API"</strong> dan klik <strong>Enable</strong>.
                  </li>
                  <li>
                    Masuk ke tab <strong>OAuth consent screen</strong>. Pilih <strong>External</strong>, isi nama aplikasi (misal: "Portal Tugas FIP"), dan simpan.
                  </li>
                  <li>
                    Masuk ke tab <strong>Credentials</strong>, klik <strong>+ Create Credentials &gt; OAuth client ID</strong>.
                  </li>
                  <li>
                    Pilih Application type: <strong>Web application</strong>.
                  </li>
                  <li>
                    Di bagian <strong>Authorized redirect URIs</strong>, tambahkan URL Redirect URI aplikasi di sebelah kiri (pastikan sama persis!).
                  </li>
                  <li>
                    Klik <strong>Create</strong>, lalu salin <strong>Client ID</strong> dan <strong>Client Secret</strong> ke formulir di sebelah kiri.
                  </li>
                </ol>
                <div className="rounded-xl bg-blue-50/50 p-3 border border-blue-100 text-[11px] text-slate-500 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <span>
                    <strong>Tips:</strong> Karena menggunakan client ID Anda sendiri, Anda dapat menghubungkan Google Drive milik prodi, fakultas, atau akun Google mana pun tanpa batasan!
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* EDIT USER DIALOG MODAL */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-600" />
                Ubah Data & Peran Akun
              </h3>
              <button 
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Email Pengguna (Immutable)</label>
                <input
                  type="text"
                  disabled
                  value={editingUser.email}
                  className="block w-full rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-slate-450 focus:outline-none cursor-not-allowed font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                  {editUserPeran === 'mahasiswa' ? 'NIM' : editUserPeran === 'dosen' ? 'NIP' : 'Kode Identitas'}
                </label>
                <input
                  type="text"
                  required
                  value={editUserNimNip}
                  onChange={(e) => setEditUserNimNip(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hak Akses & Peran</label>
                <select
                  value={editUserPeran}
                  onChange={(e) => setEditUserPeran(e.target.value as any)}
                  disabled={editingUser.email === 'dokumentasifip@gmail.com'}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="mahasiswa">Mahasiswa</option>
                  <option value="dosen">Dosen</option>
                  {editingUser.email === 'dokumentasifip@gmail.com' && (
                    <option value="admin">Admin (Akses Seluruh Sistem)</option>
                  )}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-100"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW SUBMISSION FILE CONTENT MODAL */}
      {viewingSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Detail Jawaban Mahasiswa</h3>
                <p className="text-xs text-slate-400 mt-0.5">Dikumpul oleh {viewingSubmission.studentNama} (NIM: {viewingSubmission.studentNim})</p>
              </div>
              <button 
                onClick={() => setViewingSubmission(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto flex-1 pr-1">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Mata Kuliah & Tugas</span>
                <p className="text-sm text-slate-800 font-semibold">{viewingSubmission.courseNama} &bull; {viewingSubmission.assignmentJudul}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Nama File & Ukuran</span>
                <p className="text-sm text-slate-800 font-mono text-xs">{viewingSubmission.fileNama} ({ (viewingSubmission.fileSize / 1024).toFixed(1) } KB)</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Isi Berkas / Jawaban Tugas</span>
                <pre className="bg-slate-50 text-slate-800 p-4 rounded-2xl font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-60 border border-slate-100">
                  {viewingSubmission.fileData || "Tidak ada data teks berkas yang tersimpan."}
                </pre>
              </div>

              {viewingSubmission.catatanMahasiswa && (
                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Catatan Tambahan Mahasiswa</span>
                  <p className="text-xs bg-amber-50/50 border border-amber-100 p-3 rounded-xl text-amber-900">
                    {viewingSubmission.catatanMahasiswa}
                  </p>
                </div>
              )}

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Status Penilaian</span>
                <div className="flex items-center gap-2 mt-1">
                  {viewingSubmission.status === 'dinilai' ? (
                    <div className="space-y-1.5 w-full">
                      <div className="text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-xl w-fit">
                        Sudah Dinilai: {viewingSubmission.nilai} / 100
                      </div>
                      {viewingSubmission.catatanDosen && (
                        <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <strong>Komentar Dosen:</strong> {viewingSubmission.catatanDosen}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-3 py-1 rounded-xl">
                      Belum Dinilai oleh Dosen Pengampu
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => handleDownloadSubmission(viewingSubmission)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm transition flex items-center gap-1.5 shadow-md shadow-emerald-50"
              >
                <Download className="h-4 w-4" />
                Unduh Berkas
              </button>
              <button
                type="button"
                onClick={() => setViewingSubmission(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT COURSE DIALOG MODAL */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                {editingCourse ? 'Ubah Kelas Kuliah' : 'Tambah Kelas Kuliah Baru'}
              </h3>
              <button 
                onClick={() => setShowCourseModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Kelas / Mata Kuliah</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pemrograman Web Lanjut"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Deskripsi / Silabus Ringkas</label>
                <textarea
                  placeholder="Tuliskan ringkasan materi atau silabus perkuliahan..."
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  rows={3}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Semester</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ganjil 2026/2027"
                    value={courseSemester}
                    onChange={(e) => setCourseSemester(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Kode Join Kelas</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="6 digit"
                      maxLength={6}
                      value={courseKode}
                      onChange={(e) => setCourseKode(e.target.value.toUpperCase())}
                      className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400 font-mono text-center font-bold tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={() => setCourseKode(generateJoinCode())}
                      className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 transition"
                      title="Acak Kode"
                    >
                      Acak
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Program Studi</label>
                  <select
                    value={courseProdi}
                    onChange={(e) => setCourseProdi(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 bg-white"
                  >
                    <option value="S1 PGSD">S1 PGSD</option>
                    <option value="S1PMAT">S1PMAT</option>
                    <option value="S1PIPA">S1PIPA</option>
                    <option value="S1PBING">S1PBING</option>
                    <option value="S1PBSI">S1PBSI</option>
                    <option value="S2PBI">S2PBI</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Angkatan</label>
                  <select
                    value={courseAngkatan}
                    onChange={(e) => setCourseAngkatan(e.target.value)}
                    className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 bg-white"
                  >
                    <option value="2021">2021</option>
                    <option value="2022">2022</option>
                    <option value="2023">2023</option>
                    <option value="2024">2024</option>
                    <option value="2025">2025</option>
                    <option value="2026">2026</option>
                    <option value="2027">2027</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Dosen Pengampu</label>
                <select
                  value={courseDosenId}
                  onChange={(e) => setCourseDosenId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 bg-white"
                >
                  <option value="" disabled>-- Pilih Dosen Pengampu --</option>
                  {allUsers.filter(u => u.peran === 'dosen').map(dosen => (
                    <option key={dosen.uid} value={dosen.uid}>{dosen.nama} ({dosen.nim_nip})</option>
                  ))}
                </select>
                {allUsers.filter(u => u.peran === 'dosen').length === 0 && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Belum ada akun Dosen terdaftar di sistem.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-100"
                >
                  {editingCourse ? 'Simpan Perubahan' : 'Buat Kelas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD/EDIT ASSIGNMENT DIALOG MODAL */}
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                {editingAssignment ? 'Ubah Tugas Kuliah' : 'Tambah Tugas Kuliah Baru'}
              </h3>
              <button 
                onClick={() => setShowAssignmentModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAssignment} className="space-y-4 text-sm text-slate-700">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pilih Kelas / Mata Kuliah</label>
                <select
                  value={assignCourseId}
                  onChange={(e) => setAssignCourseId(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 bg-white"
                >
                  <option value="" disabled>-- Pilih Kelas Kuliah --</option>
                  {allCourses.map(course => (
                    <option key={course.id} value={course.id}>{course.nama} ({course.semester})</option>
                  ))}
                </select>
                {allCourses.length === 0 && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Belum ada Kelas Kuliah aktif di sistem. Silakan buat kelas terlebih dahulu.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Judul Tugas</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Tugas Mandiri 1 - Analisis Jaringan"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Instruksi Tugas</label>
                <textarea
                  placeholder="Tuliskan petunjuk lengkap pengerjaan tugas, format pengumpulan berkas, dll..."
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  rows={4}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500 placeholder-slate-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tenggat Waktu Pengumpulan (Deadline)</label>
                <input
                  type="datetime-local"
                  required
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAssignmentModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-100"
                >
                  {editingAssignment ? 'Simpan Perubahan' : 'Buat Tugas'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
