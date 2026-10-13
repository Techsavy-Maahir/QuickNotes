import { useState, useEffect } from 'react';
import AuthPage from './pages/AuthPage';
import NotesPage from './pages/NotesPage';
import SharedNoteView from './components/SharedNoteView';
import './index.css';

function App() {
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shareToken, setShareToken] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('share') || params.get('shareToken') || null;
  });

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode((prev) => !prev);
  };

  const handleLogin = () => {
    const savedToken = localStorage.getItem('token');
    setToken(savedToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  const handleBackToApp = () => {
    // Clear URL share query parameter
    window.history.replaceState({}, document.title, window.location.pathname);
    setShareToken(null);
  };

  if (loading) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div className="min-h-screen bg-slate-50 dark:bg-gray-900 flex flex-col justify-center items-center">
          <div className="text-sm font-medium text-slate-500 dark:text-gray-400">
            Loading Secure Notes...
          </div>
        </div>
      </div>
    );
  }

  // If visiting via a share link, show the Shared Note View
  if (shareToken) {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <SharedNoteView
          token={shareToken}
          onBackToApp={handleBackToApp}
          darkMode={darkMode}
          toggleDarkMode={toggleDarkMode}
        />
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-white dark:bg-gray-900 text-slate-900 dark:text-gray-100 transition-colors duration-300">
        {token ? (
          <NotesPage
            token={token}
            onLogout={handleLogout}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
          />
        ) : (
          <AuthPage
            onLogin={handleLogin}
            darkMode={darkMode}
            toggleDarkMode={toggleDarkMode}
          />
        )}
      </div>
    </div>
  );
}

export default App;
