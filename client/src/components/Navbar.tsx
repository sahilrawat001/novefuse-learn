import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Clock, Plus, LogOut, Radio } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/70 border-b border-white/[0.08] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-md shadow-indigo-500/20 group-hover:scale-105 transition duration-300">
            <Radio className="w-4 h-4 text-white animate-pulse" />
            <div className="absolute -inset-0.5 rounded-xl bg-indigo-500/30 blur-xs -z-10 group-hover:opacity-100 opacity-60 transition" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white group-hover:text-indigo-200 transition">
                NovaFuse
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">
                Voice Studio
              </span>
            </div>
          </div>
        </Link>

        {/* Live Engine Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/60 border border-white/[0.06] text-xs text-slate-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-[11px] text-slate-300">Neural Engine v2.4 Active</span>
        </div>

        {user ? (
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link
              to="/dashboard"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive('/dashboard')
                  ? 'text-white bg-white/[0.08] shadow-xs border border-white/[0.08]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Studio</span>
            </Link>

            <Link
              to="/study-material/new"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive('/study-material/new')
                  ? 'text-white bg-white/[0.08] shadow-xs border border-white/[0.08]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Material</span>
            </Link>

            <Link
              to="/history"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isActive('/history')
                  ? 'text-white bg-white/[0.08] shadow-xs border border-white/[0.08]'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Analytics</span>
            </Link>

            <div className="h-4 w-px bg-white/[0.08] mx-1.5" />

            <div className="flex items-center gap-2.5">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {(user.name || user.email || 'U')[0]}
                </div>
                <span className="text-xs text-slate-300 font-medium max-w-[120px] truncate">
                  {user.name || user.email}
                </span>
              </div>

              <button
                onClick={handleLogout}
                title="Sign out"
                className="p-2 text-slate-400 hover:text-rose-400 rounded-xl hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </nav>
        ) : (
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-xs font-semibold text-slate-300 hover:text-white px-3.5 py-2 rounded-xl hover:bg-white/[0.06] transition"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-xl shadow-md shadow-indigo-600/30 transition"
            >
              Get Started
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
