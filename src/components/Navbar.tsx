import { LogOut, GraduationCap, User, BookOpen, Shield } from 'lucide-react';
import { UserProfile } from '../types';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface NavbarProps {
  profile: UserProfile | null;
  onSignOut: () => void;
}

export default function Navbar({ profile, onSignOut }: NavbarProps) {
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      onSignOut();
    } catch (err) {
      console.error('Gagal keluar:', err);
    }
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-md shadow-blue-100 flex items-center justify-center font-bold text-xl w-10 h-10">
                S
              </div>
              <span className="font-bold text-xl text-slate-800 tracking-tight">
                ETugas 
              </span>
            </div>
          </div>

          {profile && (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-slate-700 leading-none">
                  {profile.nama}
                </span>
                <span className="text-xs text-slate-500 mt-1">
                  {profile.peran === 'mahasiswa' 
                    ? `NIM: ${profile.nim_nip}` 
                    : profile.peran === 'dosen' 
                    ? `NIP: ${profile.nim_nip}` 
                    : `Sistem Admin`}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {profile.peran === 'mahasiswa' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.0 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                    <GraduationCap className="h-3 w-3" />
                    MAHASISWA
                  </span>
                ) : profile.peran === 'dosen' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.0 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
                    <BookOpen className="h-3 w-3" />
                    DOSEN
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1.0 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                    <Shield className="h-3 w-3" />
                    ADMIN
                  </span>
                )}

                <button
                  onClick={handleSignOut}
                  className="inline-flex items-center gap-1.5 ml-2 p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                  title="Keluar"
                >
                  <LogOut className="h-5 w-5" />
                  <span className="hidden md:inline text-sm font-semibold">Keluar</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
