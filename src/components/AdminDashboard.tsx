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
  Download
} from 'lucide-react';
import { UserProfile, Course, Assignment, Submission } from '../types';

interface AdminDashboardProps {
  profile: UserProfile;
}

type TabType = 'users' | 'courses' | 'assignments' | 'submissions';

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

  // Assignment Modal & Form States (Admin CRUD)
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignCourseId, setAssignCourseId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');

  // Load Firestore data using live snapshots for real-time responsiveness
  useEffect(() => {
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
    setShowCourseModal(true);
  };

  const handleEditCourseClick = (course: Course) => {
    setEditingCourse(course);
    setCourseName(course.nama);
    setCourseDesc(course.deskripsi || '');
    setCourseSemester(course.semester);
    setCourseDosenId(course.dosenId);
    setCourseKode(course.kode);
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
          kode: courseKode
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
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'courses'), courseData);
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
    return c.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.kode.toLowerCase().includes(searchQuery.toLowerCase()) ||
           c.dosenNama.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredAssignments = allAssignments.filter(a => {
    const matchesSearch = 
      a.judul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.courseNama.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCourse = courseFilter === 'all' || a.courseId === courseFilter;
    return matchesSearch && matchesCourse;
  });

  const filteredSubmissions = allSubmissions.filter(s => {
    const matchesSearch = 
      s.studentNama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentNim.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.assignmentJudul.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.courseNama.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCourse = courseFilter === 'all' || s.courseId === courseFilter;
    return matchesSearch && matchesCourse;
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
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[11px] bg-blue-50 text-blue-700 font-mono font-bold px-2 py-0.5 rounded border border-blue-100 tracking-wider">
                            KODE: {course.kode}
                          </span>
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
                        <div className="font-semibold text-xs text-slate-700 max-w-[150px] truncate">{sub.fileNama}</div>
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
                  className="block w-full rounded-xl border border-slate-300 py-2.5 px-3 text-slate-800 focus:border-blue-500 bg-white"
                >
                  <option value="mahasiswa">Mahasiswa</option>
                  <option value="dosen">Dosen</option>
                  <option value="admin">Admin (Akses Seluruh Sistem)</option>
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
