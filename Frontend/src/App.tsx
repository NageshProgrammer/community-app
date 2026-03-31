// src/App.tsx
import { useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

// Context
import { PostProvider } from './context/PostContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SocialProvider } from './context/SocialContext';

// Layout Components
import { Sidebar } from './components/layout/Sidebar';
import { BottomNav } from './components/layout/BottomNav';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { RightSidebar } from './components/layout/RightSidebar';
import { PostModal } from './components/shared/PostModal'; // <-- Import the new modal

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

// Protected Route Component
import { useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

function AppContent() {
  const location = useLocation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const { user } = useAuth();

  const getHeaderTitle = () => {
    switch (location.pathname) {
      case '/community':
        return '';
      case '/messages':
        return 'Messages';
      case '/notifications':
        return 'Notifications';
      case '/profile':
        return 'Profile';
      case '/settings':
        return 'Settings';
      default:
        return 'Community';
    }
  };

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

  return (
    <>
      <div className="min-h-screen bg-dark w-full lg:grid lg:grid-cols-[auto_1fr_20rem] gap-4">
        {/* Pass the function to open the modal to the Sidebar */}
        <Sidebar onOpenPostModal={() => setIsPostModalOpen(true)} />

        <BottomNav />
        <MobileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />

        {/* Render the Global Post Modal */}
        <PostModal isOpen={isPostModalOpen} onClose={() => setIsPostModalOpen(false)} />

        <main className="flex-1 border-r border-gray-800 min-h-screen pb-20 sm:pb-0 overflow-x-hidden">
          <header className="sticky top-0 bg-dark/80 backdrop-blur-md border-b border-gray-800 p-4 z-40 flex items-center gap-4">
            <button className="sm:hidden flex-shrink-0" onClick={() => setIsDrawerOpen(true)}>
              <img
                src="https://api.dicebear.com/7.x/avataaars/svg?seed=Narayan"
                alt="Menu"
                className="w-8 h-8 rounded-full bg-gray-800"
              />
            </button>
            <h1 className="text-xl font-bold">{getHeaderTitle()}</h1>
          </header>

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

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SocialProvider>
          <PostProvider>
            <AppContent />
          </PostProvider>
        </SocialProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;