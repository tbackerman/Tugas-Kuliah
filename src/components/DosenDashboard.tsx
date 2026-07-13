import React, { useState, useEffect, FormEvent } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  doc, 
  updateDoc, 
  orderBy, 
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { Course, Assignment, Submission, UserProfile } from '../types';
import { 
  Plus, 
  BookOpen, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Award, 
  FileText, 
  Users, 
  ChevronRight, 
  ArrowLeft, 
  Copy, 
  Check, 
  MessageSquare,
  Search,
  Filter
} from 'lucide-react';

interface DosenDashboardProps {
  profile: UserProfile;
}

export default function DosenDashboard({ profile }: DosenDashboardProps) {
  // States
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals / Forms States
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDesc, setNewCourseDesc] = useState('');
  const [newCourseSemester, setNewCourseSemester] = useState('Ganjil 2026/2027');

  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [newAssignTitle, setNewAssignTitle] = useState('');
  const [newAssignDesc, setNewAssignDesc] = useState('');
  const [newAssignDueDate, setNewAssignDueDate] = useState('');

  // Grading State
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [score, setScore] = useState('');
  const [lecturerNotes, setLecturerNotes] = useState('');

  // Search/Filter State
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>('all');
  const [submissionFilter, setSubmissionFilter] = useState<'all' | 'dikumpul' | 'dinilai'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Load Courses
  useEffect(() => {
    const q = query(
      collection(db, 'courses'), 
      where('dosenId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Course[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Course);
      });
      setCourses(list);
      setLoading(false);
    }, (error) => {
      console.error("Gagal memuat kelas:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  // Load Assignments for Selected Course
  useEffect(() => {
    if (!selectedCourse) {
      setAssignments([]);
      return;
    }

    const q = query(
      collection(db, 'assignments'),
      where('courseId', '==', selectedCourse.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Assignment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Assignment);
      });
      setAssignments(list);
    });

    return () => unsubscribe();
  }, [selectedCourse]);

  // Load Submissions for Selected Course
  useEffect(() => {
    if (!selectedCourse) {
      setSubmissions([]);
      return;
    }

    const q = query(
      collection(db, 'submissions'),
      where('courseId', '==', selectedCourse.id),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Submission[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Submission);
      });
      setSubmissions(list);
    });

    return () => unsubscribe();
  }, [selectedCourse]);

  // Global Statistics (from all lecturer's courses)
  const [globalStats, setGlobalStats] = useState({
    totalCourses: 0,
    totalAssignments: 0,
    totalPendingGrading: 0
  });

  useEffect(() => {
    // We can compute stats based on loaded courses and fetching all submissions for these courses
    if (courses.length === 0) return;

    const courseIds = courses.map(c => c.id);
    
    // Fetch count of assignments and pending submissions
    const assignQuery = query(collection(db, 'assignments'), where('dosenId', '==', profile.uid));
    const subQuery = query(collection(db, 'submissions'), where('courseId', 'in', courseIds.slice(0, 10))); // query limited to first 10 for safety in IN query

    let unsubAssign = () => {};
    let unsubSub = () => {};

    try {
      unsubAssign = onSnapshot(assignQuery, (snap) => {
        const assignCount = snap.size;
        
        unsubSub = onSnapshot(subQuery, (subSnap) => {
          let pending = 0;
          subSnap.forEach((doc) => {
            const data = doc.data() as Submission;
            if (data.status === 'dikumpul') {
              pending++;
            }
          });
          setGlobalStats({
            totalCourses: courses.length,
            totalAssignments: assignCount,
            totalPendingGrading: pending
          });
        });
      });
    } catch (e) {
      console.error(e);
    }

    return () => {
      unsubAssign();
      unsubSub();
    };
  }, [courses, profile.uid]);

  // Generate 6 Char Class Join Code
  const generateJoinCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Copy Code to Clipboard
  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Create Course handler
  const handleCreateCourse = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    try {
      const joinCode = generateJoinCode();
      const courseData = {
        kode: joinCode,
        nama: newCourseName,
        deskripsi: newCourseDesc,
        semester: newCourseSemester,
        dosenId: profile.uid,
        dosenNama: profile.nama,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'courses'), courseData);
      
      // Reset form
      setNewCourseName('');
      setNewCourseDesc('');
      setShowCreateCourse(false);
    } catch (err) {
      console.error('Gagal membuat kelas:', err);
    }
  };

  // Create Assignment handler
  const handleCreateAssignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newAssignTitle.trim() || !newAssignDueDate) return;

    try {
      const assignmentData = {
        courseId: selectedCourse.id,
        courseNama: selectedCourse.nama,
        judul: newAssignTitle,
        deskripsi: newAssignDesc,
        tenggatWaktu: new Date(newAssignDueDate).toISOString(),
        dosenId: profile.uid,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'assignments'), assignmentData);

      // Reset
      setNewAssignTitle('');
      setNewAssignDesc('');
      setNewAssignDueDate('');
      setShowCreateAssignment(false);
    } catch (err) {
      console.error('Gagal membuat tugas:', err);
    }
  };

  // Grading handler
  const handleGradeSubmission = async (e: FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission || !score) return;

    try {
      const subRef = doc(db, 'submissions', gradingSubmission.id);
      await updateDoc(subRef, {
        nilai: Number(score),
        catatanDosen: lecturerNotes,
        status: 'dinilai',
        gradedAt: new Date().toISOString()
      });

      // Reset
      setGradingSubmission(null);
      setScore('');
      setLecturerNotes('');
    } catch (err) {
      console.error('Gagal menilai tugas:', err);
    }
  };

  // Filter & Search Submissions
  const filteredSubmissions = submissions.filter((sub) => {
    const matchAssign = selectedAssignmentId === 'all' || sub.assignmentId === selectedAssignmentId;
    const matchStatus = submissionFilter === 'all' || sub.status === submissionFilter;
    const matchSearch = 
      sub.studentNama.toLowerCase().includes(searchTerm.toLowerCase()) || 
      sub.studentNim.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sub.fileNama.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchAssign && matchStatus && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Dashboard Dosen
          </h1>
          <p className="text-slate-500 mt-1">
            Selamat datang, <span className="font-semibold text-slate-800">{profile.nama}</span>. Kelola kelas dan nilai tugas mahasiswa Anda di sini.
          </p>
        </div>
        {!selectedCourse && (
          <button
            onClick={() => setShowCreateCourse(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition shadow-md shadow-blue-100"
          >
            <Plus className="h-4 w-4" />
            Buat Kelas Baru
          </button>
        )}
      </div>

      {/* DASHBOARD HOMEPAGE (No Course Selected) */}
      {!selectedCourse ? (
        <div className="space-y-8">
          {/* STATS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Kelas</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{globalStats.totalCourses}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                <FileText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total Tugas</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{globalStats.totalAssignments}</h3>
              </div>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Perlu Dinilai</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-0.5">{globalStats.totalPendingGrading}</h3>
              </div>
            </div>
          </div>

          {/* COURSE LIST */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight mb-4">
              Daftar Kelas Anda
            </h2>

            {loading ? (
              <div className="text-center py-12 text-slate-500">Memuat daftar kelas...</div>
            ) : courses.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                <BookOpen className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                <h3 className="font-bold text-slate-800 text-lg">Belum Ada Kelas</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm mx-auto">
                  Anda belum membuat kelas kuliah apa pun. Buat kelas pertama Anda sekarang agar mahasiswa dapat bergabung.
                </p>
                <button
                  onClick={() => setShowCreateCourse(true)}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-md shadow-blue-100"
                >
                  <Plus className="h-4 w-4" />
                  Buat Kelas
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {courses.map((course) => (
                  <div 
                    key={course.id}
                    onClick={() => setSelectedCourse(course)}
                    className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {course.semester}
                        </span>
                        <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-100 hover:bg-slate-100 transition" onClick={(e) => { e.stopPropagation(); handleCopyCode(course.kode); }}>
                          <span className="font-mono text-xs text-slate-600 font-bold tracking-wider">{course.kode}</span>
                          {copiedCode === course.kode ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
                          )}
                        </div>
                      </div>
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition text-lg leading-snug">
                        {course.nama}
                      </h3>
                      <p className="text-sm text-slate-500 mt-2 line-clamp-2">
                        {course.deskripsi || 'Tidak ada deskripsi kelas.'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-5 text-xs text-slate-400 font-semibold">
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        Detail & Kelola
                      </span>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* COURSE DETAIL VIEW (A Course is Selected) */
        <div className="space-y-8">
          {/* Back button and breadcrumb */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setSelectedCourse(null);
                setSelectedAssignmentId('all');
              }}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Semua Kelas
            </button>

            <button
              onClick={() => setShowCreateAssignment(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition shadow-md shadow-blue-100"
            >
              <Plus className="h-4 w-4" />
              Buat Tugas Baru
            </button>
          </div>

          {/* COURSE JUMBOTRON */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                  {selectedCourse.semester}
                </span>
                <span className="text-xs text-slate-400">Dibuat pada {new Date(selectedCourse.createdAt).toLocaleDateString('id-ID')}</span>
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mt-2 tracking-tight">
                {selectedCourse.nama}
              </h2>
              <p className="text-slate-500 mt-1 max-w-2xl text-sm">
                {selectedCourse.deskripsi || 'Tidak ada deskripsi kelas.'}
              </p>
            </div>

            {/* CLASS CODE CARD */}
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 w-full md:w-auto min-w-[200px] flex flex-col items-center md:items-start">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Kode Join Kelas</span>
              <div className="flex items-center gap-2 w-full justify-between">
                <span className="font-mono text-xl font-extrabold tracking-widest text-blue-900">{selectedCourse.kode}</span>
                <button
                  onClick={() => handleCopyCode(selectedCourse.kode)}
                  className="p-1.5 rounded-xl bg-white border border-blue-100 text-blue-600 hover:bg-blue-100 transition shadow-sm"
                  title="Salin Kode"
                >
                  {copiedCode === selectedCourse.kode ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <span className="text-[10px] text-blue-600 mt-2 text-center md:text-left leading-normal">
                Bagikan kode ini kepada mahasiswa Anda agar mereka bisa bergabung ke kelas ini.
              </span>
            </div>
          </div>

          {/* TWO PANEL SECTIONS (TUGAS & PENGUMPULAN) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT COLUMN: TUGAS (4/12 width) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800">Daftar Tugas</h3>
                <span className="text-xs bg-slate-150 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">
                  {assignments.length}
                </span>
              </div>

              {assignments.length === 0 ? (
                <div className="bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                  <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-700">Belum Ada Tugas</p>
                  <p className="text-xs text-slate-500 mt-0.5">Buat tugas pertama untuk menugaskan mahasiswa.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={() => setSelectedAssignmentId('all')}
                    className={`w-full text-left p-3.5 rounded-xl border text-sm font-bold transition ${
                      selectedAssignmentId === 'all'
                        ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    Semua Tugas
                  </button>

                  {assignments.map((assign) => (
                    <div
                      key={assign.id}
                      onClick={() => setSelectedAssignmentId(assign.id)}
                      className={`w-full text-left p-4 rounded-xl border cursor-pointer transition ${
                        selectedAssignmentId === assign.id
                          ? 'border-blue-600 bg-blue-50/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{assign.judul}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1.5">{assign.deskripsi}</p>
                      
                      <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-bold mt-3">
                        <Clock className="h-3.5 w-3.5" />
                        Tenggat: {new Date(assign.tenggatWaktu).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: SUBMISSIONS LIST (8/12 width) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-2">
                <h3 className="font-bold text-slate-800">
                  {selectedAssignmentId === 'all' 
                    ? 'Semua Pengumpulan Tugas' 
                    : `Pengumpulan: ${assignments.find(a => a.id === selectedAssignmentId)?.judul || ''}`}
                </h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full font-bold">
                  {filteredSubmissions.length} Dikumpul
                </span>
              </div>

              {/* FILTER CONTROLS */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search */}
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="h-4 w-4" />
                  </span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Cari mahasiswa / NIM..."
                    className="block w-full rounded-xl border border-slate-300 py-1.5 pl-9 pr-3 text-xs text-slate-900 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                {/* Filter status */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400 flex-shrink-0" />
                  <select
                    value={submissionFilter}
                    onChange={(e) => setSubmissionFilter(e.target.value as any)}
                    className="block w-full rounded-xl border border-slate-300 py-1.5 px-3 text-xs text-slate-900 focus:border-blue-500"
                  >
                    <option value="all">Semua Status</option>
                    <option value="dikumpul">Belum Dinilai</option>
                    <option value="dinilai">Sudah Dinilai</option>
                  </select>
                </div>
              </div>

              {/* SUBMISSIONS LIST */}
              {filteredSubmissions.length === 0 ? (
                <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="font-bold text-slate-700">Tidak Ada Pengumpulan</p>
                  <p className="text-xs text-slate-500 mt-1">Belum ada mahasiswa yang mengumpulkan atau cocok dengan filter pencarian.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredSubmissions.map((sub) => {
                    const isOverdue = new Date(sub.submittedAt) > new Date(assignments.find(a => a.id === sub.assignmentId)?.tenggatWaktu || '');
                    
                    return (
                      <div 
                        key={sub.id} 
                        className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                          <div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-bold block w-fit mb-1">
                              {sub.assignmentJudul}
                            </span>
                            <h4 className="font-bold text-slate-800 text-sm">{sub.studentNama}</h4>
                            <p className="text-xs text-slate-500 font-mono">NIM: {sub.studentNim}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            {isOverdue && (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-100">
                                Terlambat
                              </span>
                            )}
                            {sub.status === 'dinilai' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <Award className="h-3 w-3" />
                                Nilai: {sub.nilai}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                Belum Dinilai
                              </span>
                            )}
                          </div>
                        </div>

                        {/* SUBMISSION ATTACHMENT */}
                        <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-xl text-blue-600">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-800 line-clamp-1">{sub.fileNama}</p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {(sub.fileSize / 1024).toFixed(1)} KB • Dikumpul {new Date(sub.submittedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </p>
                            </div>
                          </div>

                          {/* Trigger file download simulation or view */}
                          {sub.fileData && (
                            <button
                              onClick={() => {
                                // Simulate reading the file contents / data
                                alert(`Isi Jawaban Mahasiswa:\n\n${sub.fileData}`);
                              }}
                              className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                            >
                              Lihat Isi Jawaban
                            </button>
                          )}
                        </div>

                        {sub.catatanMahasiswa && (
                          <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs text-slate-700">
                            <span className="font-bold block mb-1 text-amber-800">Catatan Mahasiswa:</span>
                            {sub.catatanMahasiswa}
                          </div>
                        )}

                        {sub.catatanDosen && (
                          <div className="bg-blue-50/30 border border-blue-100 rounded-xl p-3 text-xs text-slate-700">
                            <span className="font-bold block mb-1 text-blue-800">Catatan Nilai Dosen:</span>
                            {sub.catatanDosen}
                          </div>
                        )}

                        {/* Grading Action */}
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => {
                              setGradingSubmission(sub);
                              setScore(sub.nilai !== null ? String(sub.nilai) : '');
                              setLecturerNotes(sub.catatanDosen || '');
                            }}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition py-1.5 px-3 bg-blue-50 hover:bg-blue-100 rounded-xl"
                          >
                            <Award className="h-3.5 w-3.5" />
                            {sub.status === 'dinilai' ? 'Ubah Nilai' : 'Beri Nilai & Masukan'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CREATE COURSE MODAL */}
      {showCreateCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Buat Kelas Kuliah Baru</h3>
              <button 
                onClick={() => setShowCreateCourse(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nama Mata Kuliah</label>
                <input
                  type="text"
                  required
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Contoh: Pemrograman Web Lanjut"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Semester / Tahun Ajaran</label>
                <select
                  value={newCourseSemester}
                  onChange={(e) => setNewCourseSemester(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500"
                >
                  <option value="Ganjil 2026/2027">Ganjil 2026/2027</option>
                  <option value="Genap 2025/2026">Genap 2025/2026</option>
                  <option value="Pendek 2026">Pendek 2026</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi Kelas</label>
                <textarea
                  value={newCourseDesc}
                  onChange={(e) => setNewCourseDesc(e.target.value)}
                  rows={3}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Deskripsikan silabus ringkas atau info kelas..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCourse(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md shadow-blue-100"
                >
                  Buat Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE ASSIGNMENT MODAL */}
      {showCreateAssignment && selectedCourse && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Buat Tugas Baru</h3>
              <button 
                onClick={() => setShowCreateAssignment(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Judul Tugas</label>
                <input
                  type="text"
                  required
                  value={newAssignTitle}
                  onChange={(e) => setNewAssignTitle(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Contoh: Tugas 1: Implementasi API Express"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tenggat Waktu (Due Date)</label>
                <input
                  type="datetime-local"
                  required
                  value={newAssignDueDate}
                  onChange={(e) => setNewAssignDueDate(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Deskripsi Tugas & Instruksi</label>
                <textarea
                  required
                  value={newAssignDesc}
                  onChange={(e) => setNewAssignDesc(e.target.value)}
                  rows={4}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Berikan instruksi penulisan, format file pengumpulan, dan detail tugas..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAssignment(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md shadow-blue-100"
                >
                  Tugaskan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GRADING MODAL */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Beri Nilai Tugas</h3>
              <button 
                onClick={() => setGradingSubmission(null)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-xs text-slate-400">Mahasiswa</p>
              <h4 className="font-bold text-slate-800 text-sm">{gradingSubmission.studentNama}</h4>
              <p className="text-xs text-slate-500 font-mono">NIM: {gradingSubmission.studentNim}</p>
            </div>

            <form onSubmit={handleGradeSubmission} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nilai Tugas (0 - 100)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(e.target.value)}
                  className="block w-28 rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Misal: 95"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catatan Umpan Balik / Catatan Dosen</label>
                <textarea
                  value={lecturerNotes}
                  onChange={(e) => setLecturerNotes(e.target.value)}
                  rows={3}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Bagus! Implementasinya rapi. Lanjutkan..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition shadow-md shadow-blue-100"
                >
                  Simpan Nilai
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
