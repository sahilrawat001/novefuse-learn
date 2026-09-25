import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { StudyMaterialNew } from './pages/StudyMaterialNew';
import { VoiceSession } from './pages/VoiceSession';
import { SessionSummary } from './pages/SessionSummary';
import { History } from './pages/History';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-slate-400 text-sm">
        Loading...
      </div>
    );
  }

  // If user is not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-transparent text-slate-100 selection:bg-indigo-500/30 selection:text-indigo-200">
          <Navbar />
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />

              {/* Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/study-material/new"
                element={
                  <ProtectedRoute>
                    <StudyMaterialNew />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:id"
                element={
                  <ProtectedRoute>
                    <VoiceSession />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/session/:id/summary"
                element={
                  <ProtectedRoute>
                    <SessionSummary />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />

              {/* Default Redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
};
