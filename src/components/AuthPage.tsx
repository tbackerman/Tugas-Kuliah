import React, { useState, FormEvent } from 'react';
import { auth, db } from '../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { GraduationCap, BookOpen, Loader2, Mail, Lock, User, Shield } from 'lucide-react';

interface AuthPageProps {
  onAuthSuccess: (user: any, profile: any) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nama, setNama] = useState('');
  const [peran, setPeran] = useState<'mahasiswa' | 'dosen' | 'admin'>('mahasiswa');
  const [nimNip, setNimNip] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        // Sign In
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Ambil profil dari Firestore
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);

        const isBootstrappedAdmin = email.trim().toLowerCase() === 'dokumentasifip@gmail.com';

        if (docSnap.exists()) {
          const profile = docSnap.data();
          if (isBootstrappedAdmin && profile.peran !== 'admin') {
            // Automatically upgrade bootstrapped email to admin role
            const updatedProfile = { ...profile, peran: 'admin' as const };
            await updateDoc(docRef, { peran: 'admin' });
            onAuthSuccess(user, updatedProfile);
          } else {
            onAuthSuccess(user, profile);
          }
        } else {
          // Jika tidak ada di Firestore (misal registrasi eksternal), buat default
          const defaultProfile = {
            uid: user.uid,
            email: user.email || '',
            nama: user.displayName || 'Pengguna',
            peran: (isBootstrappedAdmin ? 'admin' : 'mahasiswa') as 'mahasiswa' | 'dosen' | 'admin',
            nim_nip: '-',
            createdAt: new Date().toISOString()
          };
          await setDoc(docRef, defaultProfile);
          onAuthSuccess(user, defaultProfile);
        }
      } else {
        // Sign Up
        if (!nama || !nimNip) {
          throw new Error('Semua kolom pendaftaran harus diisi!');
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const isBootstrappedAdmin = email.trim().toLowerCase() === 'dokumentasifip@gmail.com';
        const finalPeran = isBootstrappedAdmin ? 'admin' as const : peran;

        const profileData = {
          uid: user.uid,
          email,
          nama,
          peran: finalPeran,
          nim_nip: nimNip,
          createdAt: new Date().toISOString()
        };

        // Simpan profil di Firestore
        await setDoc(doc(db, 'users', user.uid), profileData);

        onAuthSuccess(user, profileData);
      }
    } catch (err: any) {
      console.error(err);
      let msg = err.message;
      if (err.code === 'auth/invalid-email') msg = 'Format email tidak valid.';
      if (err.code === 'auth/weak-password') msg = 'Kata sandi minimal 6 karakter.';
      if (err.code === 'auth/email-already-in-use') msg = 'Email sudah digunakan oleh akun lain.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        msg = 'Email atau kata sandi salah.';
      }
      if (err.code === 'auth/invalid-credential') {
        msg = 'Email atau kata sandi salah.';
      }
      setError(msg || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-3xl bg-white p-8 shadow-sm border border-slate-200">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-sm shadow-blue-100">
            <GraduationCap className="h-8 w-8" id="auth-logo" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-slate-800 tracking-tight">
            TugasKuliah
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Portal Pengumpulan Tugas Mata Kuliah yang Praktis & Teratur
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <User className="h-5 w-5" />
                    </span>
                    <input
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder="Contoh: Ahmad Fauzi"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Pilih Peran Anda
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPeran('mahasiswa')}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-semibold border transition-all ${
                        peran === 'mahasiswa'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <GraduationCap className="h-4 w-4 text-emerald-600" />
                      <span>Mahasiswa</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeran('dosen')}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-semibold border transition-all ${
                        peran === 'dosen'
                          ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <BookOpen className="h-4 w-4 text-blue-600" />
                      <span>Dosen</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPeran('admin')}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-semibold border transition-all ${
                        peran === 'admin'
                          ? 'border-amber-600 bg-amber-50 text-amber-700 shadow-sm font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Shield className="h-4 w-4 text-amber-500" />
                      <span>Admin</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    {peran === 'mahasiswa' ? 'NIM (Nomor Induk Mahasiswa)' : peran === 'dosen' ? 'NIP / NIDN (Nomor Induk Dosen)' : 'Kode Identitas Admin'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <BookOpen className="h-5 w-5" />
                    </span>
                    <input
                      type="text"
                      required
                      value={nimNip}
                      onChange={(e) => setNimNip(e.target.value)}
                      className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      placeholder={peran === 'mahasiswa' ? 'Contoh: 120220123' : peran === 'dosen' ? 'Contoh: 198001012010121001' : 'Contoh: ADM-999'}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Alamat Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-5 w-5" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Contoh: nama@kampus.ac.id"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-5 w-5" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  placeholder="Minimal 6 karakter"
                />
              </div>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="flex w-full justify-center rounded-xl bg-blue-600 py-2.5 px-4 text-sm font-bold text-white shadow-md shadow-blue-100 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-blue-400 transition"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isLogin ? (
                'Masuk Ke Portal'
              ) : (
                'Daftar Akun Baru'
              )}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-sm font-semibold text-blue-600 hover:text-blue-500"
          >
            {isLogin ? 'Belum punya akun? Daftar di sini' : 'Sudah punya akun? Masuk di sini'}
          </button>
        </div>
      </div>
    </div>
  );
}
