import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import AuthPage from './components/AuthPage';
import Navbar from './components/Navbar';
import DosenDashboard from './components/DosenDashboard';
import MahasiswaDashboard from './components/MahasiswaDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Loader2, GraduationCap } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to Firebase Auth state changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          // Ambil profil kustom pengguna dari Firestore
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            console.warn("Profil pengguna tidak ditemukan di Firestore.");
            setProfile(null);
          }
        } catch (error) {
          console.error("Gagal mengambil profil kustom:", error);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (authUser: User, userProfile: UserProfile) => {
    setUser(authUser);
    setProfile(userProfile);
  };

  const handleSignOut = () => {
    setUser(null);
    setProfile(null);
  };

  // Tampilan Loading Awal
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 flex-col gap-4">
        <div className="flex items-center gap-2 text-blue-600 animate-pulse">
          <GraduationCap className="h-10 w-10" />
          <span className="font-extrabold text-2xl tracking-tight">TugasKuliah</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          <span>Memverifikasi sesi masuk...</span>
        </div>
      </div>
    );
  }

  // Jika belum masuk log, tampilkan halaman Auth
  if (!user || !profile) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Jika sudah masuk log, tampilkan Navbar + Dashboard yang relevan
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      <Navbar profile={profile} onSignOut={handleSignOut} />
      
      <main className="flex-1 pb-16">
        {profile.peran === 'admin' ? (
          <AdminDashboard profile={profile} />
        ) : profile.peran === 'dosen' ? (
          <DosenDashboard profile={profile} />
        ) : (
          <MahasiswaDashboard profile={profile} />
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} TugasKuliah. Dibuat dengan penuh dedikasi untuk akademisi Indonesia.</p>
      </footer>
    </div>
  );
}
