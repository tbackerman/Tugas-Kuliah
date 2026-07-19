import React, { useState, useEffect, FormEvent, DragEvent, ChangeEvent } from 'react';
import { db } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDocs,
  orderBy
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
  ChevronRight, 
  ArrowLeft, 
  Upload, 
  File,
  X,
  Send,
  Loader2,
  Check,
  Search,
  Cloud
} from 'lucide-react';

interface MahasiswaDashboardProps {
  profile: UserProfile;
}

export default function MahasiswaDashboard({ profile }: MahasiswaDashboardProps) {
  // States
  const [joinedCourses, setJoinedCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, Submission>>({}); // Map assignmentId -> Submission
  const [loading, setLoading] = useState(true);
  const [prodiFilter, setProdiFilter] = useState('all');
  const [angkatanFilter, setAngkatanFilter] = useState('all');

  // Class Join Code State
  const [classCode, setClassCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');
  const [joining, setJoining] = useState(false);

  // File Upload State
  const [showSubmitModal, setShowSubmitModal] = useState<Assignment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string>(''); // Stores content / base64
  const [fileType, setFileType] = useState('');
  const [studentComment, setStudentComment] = useState('');
  const [dragActive, setDragActive] = useState(false);

  // Load Enrolled Courses
  useEffect(() => {
    const enrollQuery = query(
      collection(db, 'enrollments'),
      where('studentId', '==', profile.uid)
    );

    const unsubscribe = onSnapshot(enrollQuery, async (snapshot) => {
      const courseIds: string[] = [];
      snapshot.forEach((doc) => {
        courseIds.push(doc.data().courseId);
      });

      if (courseIds.length === 0) {
        setJoinedCourses([]);
        setLoading(false);
        return;
      }

      try {
        const coursesList: Course[] = [];
        // Firestore 'in' query has a limit of 30 values
        const coursesQuery = query(
          collection(db, 'courses'),
          where('__name__', 'in', courseIds.slice(0, 30))
        );

        const coursesSnap = await getDocs(coursesQuery);
        coursesSnap.forEach((doc) => {
          coursesList.push({ id: doc.id, ...doc.data() } as Course);
        });
        setJoinedCourses(coursesList);
      } catch (err) {
        console.error("Gagal memuat detail kelas joined:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [profile.uid]);

  // Load Assignments & Submissions for Selected Course
  useEffect(() => {
    if (!selectedCourse) {
      setAssignments([]);
      return;
    }

    // Subscribe to Assignments
    const assignQuery = query(
      collection(db, 'assignments'),
      where('courseId', '==', selectedCourse.id),
      orderBy('createdAt', 'desc')
    );

    const unsubAssign = onSnapshot(assignQuery, (snapshot) => {
      const list: Assignment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Assignment);
      });
      setAssignments(list);
    });

    // Subscribe to Submissions
    const subQuery = query(
      collection(db, 'submissions'),
      where('courseId', '==', selectedCourse.id),
      where('studentId', '==', profile.uid)
    );

    const unsubSub = onSnapshot(subQuery, (snapshot) => {
      const map: Record<string, Submission> = {};
      snapshot.forEach((doc) => {
        const data = doc.data() as Submission;
        map[data.assignmentId] = { id: doc.id, ...data };
      });
      setSubmissions(map);
    });

    return () => {
      unsubAssign();
      unsubSub();
    };
  }, [selectedCourse, profile.uid]);

  // Join Class Handler
  const handleJoinClass = async (e: FormEvent) => {
    e.preventDefault();
    setJoinError('');
    setJoinSuccess('');
    
    const codeUpper = classCode.trim().toUpperCase();
    if (!codeUpper) return;

    setJoining(true);

    try {
      // 1. Cari kelas dengan kode ini
      const q = query(collection(db, 'courses'), where('kode', '==', codeUpper));
      const querySnap = await getDocs(q);

      if (querySnap.empty) {
        throw new Error('Kode kelas tidak ditemukan. Silakan periksa kembali!');
      }

      const courseDoc = querySnap.docs[0];
      const courseId = courseDoc.id;
      const courseData = courseDoc.data();

      // 2. Cek apakah sudah bergabung
      const enrollId = `${courseId}_${profile.uid}`;
      const enrollCheckQuery = query(collection(db, 'enrollments'), where('studentId', '==', profile.uid), where('courseId', '==', courseId));
      const enrollCheckSnap = await getDocs(enrollCheckQuery);

      if (!enrollCheckSnap.empty) {
        throw new Error(`Anda sudah terdaftar di kelas "${courseData.nama}"!`);
      }

      // 3. Gabung ke kelas
      await setDoc(doc(db, 'enrollments', enrollId), {
        courseId,
        studentId: profile.uid,
        createdAt: new Date().toISOString()
      });

      setJoinSuccess(`Berhasil bergabung dengan kelas "${courseData.nama}"!`);
      setClassCode('');
    } catch (err: any) {
      setJoinError(err.message || 'Gagal bergabung dengan kelas.');
    } finally {
      setJoining(false);
    }
  };

  // Drag and Drop files handling
  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    // Validasi ukuran max 5MB agar aman masuk Firestore
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("Ukuran file maksimal adalah 5MB untuk simulasi ini!");
      return;
    }

    setFile(selectedFile);
    setFileType(selectedFile.type);

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
    };

    // Jika file text/code, baca sebagai text, jika tidak baca sebagai base64 DataURL
    if (
      selectedFile.type.startsWith('text/') || 
      selectedFile.name.endsWith('.txt') || 
      selectedFile.name.endsWith('.js') || 
      selectedFile.name.endsWith('.ts') || 
      selectedFile.name.endsWith('.tsx') || 
      selectedFile.name.endsWith('.json') ||
      selectedFile.name.endsWith('.css')
    ) {
      reader.readAsText(selectedFile);
    } else {
      reader.readAsDataURL(selectedFile);
    }
  };

  // Submit Assignment Handler
  const handleSubmitAssignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!showSubmitModal || !file) return;

    setUploading(true);

    try {
      const assignmentId = showSubmitModal.id;
      const submissionId = `${assignmentId}_${profile.uid}`;

      const submissionData = {
        assignmentId,
        assignmentJudul: showSubmitModal.judul,
        courseId: selectedCourse!.id,
        courseNama: selectedCourse!.nama,
        studentId: profile.uid,
        studentNama: profile.nama,
        studentNim: profile.nim_nip,
        fileNama: file.name,
        fileSize: file.size,
        fileType: fileType,
        fileData: fileData, // Base64 atau text code
        catatanMahasiswa: studentComment,
        nilai: null,
        status: 'dikumpul',
        submittedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'submissions', submissionId), submissionData);

      // Auto-upload submission file to Google Drive if connected
      try {
        const driveCheck = await fetch('/api/drive/config');
        if (driveCheck.ok) {
          const driveData = await driveCheck.json();
          if (driveData.connected) {
            await fetch('/api/drive/upload-submission', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                submissionId,
                fileNama: file.name,
                fileType: fileType,
                fileData: fileData,
                courseId: selectedCourse!.id,
                courseNama: selectedCourse!.nama,
                assignmentJudul: showSubmitModal.judul,
                studentNim: profile.nim_nip,
                studentNama: profile.nama
              })
            });
          }
        }
      } catch (driveErr) {
        console.error("Gagal mengunggah file ke Google Drive secara otomatis:", driveErr);
      }

      // Close and Reset
      setShowSubmitModal(null);
      setFile(null);
      setFileData('');
      setFileType('');
      setStudentComment('');
    } catch (err) {
      console.error('Gagal mengumpulkan tugas:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
            Portal Mahasiswa
          </h1>
          <p className="text-slate-500 mt-1">
            Selamat datang, <span className="font-semibold text-slate-800">{profile.nama}</span>. Kumpulkan tugas kuliah Anda dengan tepat waktu.
          </p>
        </div>
      </div>

      {/* JOIN CLASS PANEL & MY COURSES (No Course Selected) */}
      {!selectedCourse ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* JOIN CLASS CARD */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                <Plus className="h-5 w-5 text-blue-600" />
                Gabung Kelas Baru
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Mintalah Kode Kelas 6 digit dari dosen pengampu Anda untuk bergabung ke dalam kelas kuliah.
              </p>

              {joinError && (
                <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-150 flex items-start gap-1.5">
                  <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <span>{joinError}</span>
                </div>
              )}

              {joinSuccess && (
                <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 border border-emerald-150 flex items-start gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  <span>{joinSuccess}</span>
                </div>
              )}

              <form onSubmit={handleJoinClass} className="space-y-3">
                <div>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    placeholder="Contoh: A9B2C8"
                    className="block w-full font-mono font-bold tracking-widest text-center rounded-xl border border-slate-300 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 uppercase"
                  />
                </div>
                <button
                  type="submit"
                  disabled={joining || !classCode.trim()}
                  className="w-full flex justify-center items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 text-sm shadow-md shadow-blue-100 transition disabled:bg-blue-400"
                >
                  {joining ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Masuk Kelas'
                  )}
                </button>
              </form>
            </div>
          </div>

          {/* MY CLASSES GRID */}
          <div className="lg:col-span-2 space-y-4">
            {(() => {
              const filteredCourses = joinedCourses.filter(c => {
                const matchesProdi = prodiFilter === 'all' || c.prodi === prodiFilter;
                const matchesAngkatan = angkatanFilter === 'all' || c.angkatan === angkatanFilter;
                return matchesProdi && matchesAngkatan;
              });

              return (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h2 className="text-lg font-bold text-slate-800 tracking-tight">
                      Mata Kuliah Anda
                    </h2>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={prodiFilter}
                        onChange={(e) => setProdiFilter(e.target.value)}
                        className="block rounded-xl border border-slate-300 py-1 px-2.5 text-xs font-semibold text-slate-700 bg-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="all">Semua Prodi</option>
                        <option value="S1 PGSD">S1 PGSD</option>
                        <option value="S1PMAT">S1PMAT</option>
                        <option value="S1PIPA">S1PIPA</option>
                        <option value="S1PBING">S1PBING</option>
                        <option value="S1PBSI">S1PBSI</option>
                        <option value="S2PBI">S2PBI</option>
                      </select>

                      <select
                        value={angkatanFilter}
                        onChange={(e) => setAngkatanFilter(e.target.value)}
                        className="block rounded-xl border border-slate-300 py-1 px-2.5 text-xs font-semibold text-slate-700 bg-white focus:border-blue-500 focus:outline-none"
                      >
                        <option value="all">Semua Angkatan</option>
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

                  {loading ? (
                    <div className="text-center py-12 text-slate-500 text-sm">Memuat daftar mata kuliah...</div>
                  ) : joinedCourses.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                      <BookOpen className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                      <h3 className="font-bold text-slate-800 text-base">Belum Bergabung Kelas</h3>
                      <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                        Anda belum terdaftar di kelas kuliah mana pun. Masukkan kode kelas yang diberikan dosen Anda di panel sebelah kiri.
                      </p>
                    </div>
                  ) : filteredCourses.length === 0 ? (
                    <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
                      <BookOpen className="h-12 w-12 mx-auto text-slate-400 mb-3" />
                      <h3 className="font-bold text-slate-800 text-base">Tidak Ada Kelas yang Cocok</h3>
                      <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                        Tidak ada mata kuliah Anda yang cocok dengan Program Studi atau Angkatan yang dipilih.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {filteredCourses.map((course) => (
                        <div
                          key={course.id}
                          onClick={() => setSelectedCourse(course)}
                          className="group bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition cursor-pointer flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex justify-between items-center mb-3">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                {course.semester}
                              </span>
                            </div>
                            <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition text-base leading-snug">
                              {course.nama}
                            </h3>
                            <div className="flex flex-wrap gap-1 mt-1.5 mb-2">
                              {course.prodi && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                                  {course.prodi}
                                </span>
                              )}
                              {course.angkatan && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
                                  Angkatan {course.angkatan}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">
                              Dosen: <span className="font-medium">{course.dosenNama}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 pt-3.5 mt-4 text-xs text-slate-400 font-semibold">
                            <span>Buka Tugas & Status</span>
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-1 transition" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        /* COURSE DETAIL VIEW (A Joined Course is Selected) */
        <div className="space-y-6">
          {/* Back Button */}
          <div>
            <button
              onClick={() => {
                setSelectedCourse(null);
                setJoinSuccess('');
                setJoinError('');
              }}
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-blue-600 transition"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Daftar Kelas
            </button>
          </div>

          {/* COURSE JUMBOTRON */}
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">
                {selectedCourse.semester}
              </span>
              <span className="text-xs text-slate-400">Pengampu: {selectedCourse.dosenNama}</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mt-2 tracking-tight">
              {selectedCourse.nama}
            </h2>
            <p className="text-slate-500 mt-1 max-w-2xl text-sm">
              {selectedCourse.deskripsi || 'Tidak ada deskripsi kelas.'}
            </p>
          </div>

          {/* ASSIGNMENTS LIST FOR COURSE */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-800 tracking-tight">Daftar Tugas Kuliah</h3>

            {assignments.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-12 text-center">
                <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <p className="font-bold text-slate-700">Belum Ada Tugas Aktif</p>
                <p className="text-xs text-slate-500 mt-0.5">Dosen Anda belum memposting tugas apa pun untuk mata kuliah ini.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {assignments.map((assign) => {
                  const sub = submissions[assign.id];
                  const hasSubmitted = !!sub;
                  const isGraded = hasSubmitted && sub.status === 'dinilai';

                  // Calculate due date status
                  const isOverdue = !hasSubmitted && new Date() > new Date(assign.tenggatWaktu);

                  return (
                    <div 
                      key={assign.id}
                      className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-blue-100 transition flex flex-col md:flex-row justify-between gap-6"
                    >
                      <div className="space-y-3 max-w-3xl flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* STATUS BADGE */}
                          {isGraded ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <Award className="h-3.5 w-3.5" />
                              Selesai & Dinilai: {sub.nilai} / 100
                            </span>
                          ) : hasSubmitted ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Sudah Dikumpul
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-100">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Terlewat (Belum Dikumpul)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100">
                              <Clock className="h-3.5 w-3.5" />
                              Belum Dikumpul
                            </span>
                          )}
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-800 text-lg">{assign.judul}</h4>
                          <p className="text-sm text-slate-600 mt-2 whitespace-pre-line">{assign.deskripsi}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-xs text-slate-500 pt-2">
                          <span className="flex items-center gap-1 font-medium">
                            <Clock className="h-4 w-4 text-slate-400" />
                            Tenggat: {new Date(assign.tenggatWaktu).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                          </span>
                        </div>

                        {/* DISPLAY USER'S SUBMISSION IF SUBMITTED */}
                        {hasSubmitted && (
                          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-150 space-y-2 mt-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-700">Lampiran Tugas Anda:</span>
                              <span className="text-[10px] text-slate-400">
                                Dikumpul {new Date(sub.submittedAt).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-100">
                              <FileText className="h-4 w-4 text-blue-500" />
                              <span className="text-xs font-semibold text-slate-700 truncate">{sub.fileNama}</span>
                              <span className="text-[10px] text-slate-400">({(sub.fileSize / 1024).toFixed(1)} KB)</span>
                              {sub.driveFileUrl && (
                                <a
                                  href={sub.driveFileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Tersimpan di Google Drive"
                                  className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 rounded-lg px-2 py-0.5 transition"
                                >
                                  <Cloud className="h-3 w-3" />
                                  Drive
                                </a>
                              )}
                            </div>

                            {sub.catatanMahasiswa && (
                              <div className="text-xs text-slate-500 italic mt-1">
                                &ldquo;{sub.catatanMahasiswa}&rdquo;
                              </div>
                            )}

                            {/* FEEDBACK FROM LECTURER */}
                            {isGraded && sub.catatanDosen && (
                              <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 text-xs text-slate-700 mt-3">
                                <span className="font-bold block mb-1 text-blue-800">Masukan & Catatan Dosen:</span>
                                {sub.catatanDosen}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* ACTION PANEL */}
                      <div className="flex flex-col justify-center items-stretch md:items-end md:min-w-[180px]">
                        {!hasSubmitted ? (
                          <button
                            onClick={() => setShowSubmitModal(assign)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-100 transition"
                          >
                            <Upload className="h-4 w-4" />
                            Kumpulkan Tugas
                          </button>
                        ) : !isGraded ? (
                          <button
                            onClick={() => setShowSubmitModal(assign)}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-blue-200 text-blue-600 hover:bg-blue-50 font-bold text-sm transition bg-white"
                          >
                            <Upload className="h-4 w-4" />
                            Kirim Ulang Tugas
                          </button>
                        ) : (
                          <div className="text-center md:text-right">
                            <span className="text-xs font-semibold text-emerald-600">Nilai Akhir Tugas</span>
                            <div className="text-4xl font-extrabold text-emerald-700 mt-1">{sub.nilai}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* FILE SUBMISSION MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-800">Kumpulkan Tugas</h3>
                <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{showSubmitModal.judul}</p>
              </div>
              <button 
                onClick={() => {
                  setShowSubmitModal(null);
                  setFile(null);
                  setFileData('');
                  setFileType('');
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitAssignment} className="space-y-4">
              {/* DRAG DROP ZONE */}
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition ${
                  dragActive ? 'border-blue-600 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="space-y-2">
                    <FileText className="h-10 w-10 text-blue-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-800 truncate px-4">{file.name}</p>
                    <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFileData('');
                        setFileType('');
                      }}
                      className="text-xs text-red-600 hover:text-red-800 font-bold transition"
                    >
                      Hapus File & Ganti
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block space-y-2">
                    <Upload className="h-10 w-10 text-slate-400 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">Tarik & Lepas file Anda di sini</p>
                    <p className="text-xs text-slate-400">atau klik untuk memilih file dari komputer</p>
                    <input
                      type="file"
                      required
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* COMMENTS TEXTAREA */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catatan Tambahan untuk Dosen (Opsional)</label>
                <textarea
                  value={studentComment}
                  onChange={(e) => setStudentComment(e.target.value)}
                  rows={2}
                  className="block w-full rounded-xl border border-slate-300 py-2 px-3 text-sm text-slate-900 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Misal: Mohon maaf jika ada kekurangan, terima kasih pak/bu..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubmitModal(null);
                    setFile(null);
                    setFileData('');
                    setFileType('');
                    setStudentComment('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={uploading || !file}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-md shadow-blue-100 transition flex items-center gap-1.5 disabled:bg-blue-400"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Kirim Tugas
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
