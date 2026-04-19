// src/App.tsx
import { useState } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Context
import { PostProvider } from './context/PostContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocialProvider } from './context/SocialContext';
import { NotificationProvider } from './context/NotificationContext';

// Layout Components
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { RightSidebar } from './components/layout/RightSidebar';
import { PostModal } from './components/shared/PostModal';

// Pages
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import Notifications from './pages/Notifications';
import { Placeholder } from './pages/PlaceHolder';
import Messages from './pages/Messages';
import HelpCenter from './pages/HelpCenter';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Signup from './pages/Signup';

function AppContent() {
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);

  // Destructure loading from useAuth to prevent the race condition
  const { user, loading } = useAuth();

  // 1. THE FIX: Wait for Supabase to finish checking the URL token before routing
  if (loading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-dark">
        <div className="w-8 h-8 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 2. Route guards can now safely run because loading is complete
  if (location.pathname === '/') {
    return <Navigate to="/community" replace />;
  }

  if (location.pathname === '/login') {
    if (user) {
      return <Navigate to="/community" replace />;
    }
    return <Login />;
  }

  if (location.pathname === '/signup') {
    if (user) {
      return <Navigate to="/community" replace />;
    }
    return <Signup />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 3. Render the main application for authenticated users
  return (
    <>
      <div className="min-h-screen bg-transparent w-full lg:grid lg:grid-cols-[auto_1fr_20rem] gap-4">
        <Sidebar onOpenPostModal={() => setIsPostModalOpen(true)} />
        <BottomNav />
        <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
        <PostModal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} />

        <main className="flex-1 border-r border-gray-800 min-h-screen pb-20 sm:pb-0 overflow-x-hidden">


          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/community" element={<Home />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/profile/:id" element={<Profile />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Placeholder title="Page not found" />} />
            </Routes>
          </AnimatePresence>
        </main>

        <RightSidebar />
      </div>
    </>
  );
}

import { DataProvider } from './context/DataContext';

function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <NotificationProvider>
          <ThemeProvider>
            <SocialProvider>
              <PostProvider>
                <AppContent />
              </PostProvider>
            </SocialProvider>
          </ThemeProvider>
        </NotificationProvider>
      </DataProvider>
    </AuthProvider>
  );
}

export default App;