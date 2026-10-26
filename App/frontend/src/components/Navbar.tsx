import { useState, useEffect } from 'react';

interface NavbarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Navbar({ currentView, setCurrentView }: NavbarProps) {
  const navBtnStyle = (isActive: boolean) => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: isActive ? 'bold' : 'normal',
    color: isActive ? '#007BFF' : '#333',
    padding: '5px 10px',
  });

  const [loggedIn, setLoggedIn] = useState<boolean>(false);
  const [admin, setAdmin] = useState<boolean>(false);

  const refresh = () => {
    setLoggedIn(localStorage.getItem('token') !== null);
    setAdmin(localStorage.getItem('admin') !== null);
  };

  useEffect(() => {
    refresh(); // Check on mount

    // Listen for custom auth-change events
    const handleAuthChange = () => refresh();
    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    localStorage.removeItem('admin');
    
    // Notify the app that auth state changed
    window.dispatchEvent(new Event('auth-change'));
    setCurrentView('home');
  };

  return (
    <nav style={{ display: 'flex', gap: '15px', padding: '1rem 0', borderBottom: '1px solid #ccc', marginBottom: '2rem' }}>
      <button onClick={() => setCurrentView('home')} style={navBtnStyle(currentView === 'home')}>Home</button>
      {!loggedIn && <button onClick={() => setCurrentView('login')} style={navBtnStyle(currentView === 'login')}>Login</button>}
      {!loggedIn && <button onClick={() => setCurrentView('register')} style={navBtnStyle(currentView === 'register')}>Register</button>}
      {admin && <button onClick={() => setCurrentView('dashboard')} style={navBtnStyle(currentView === 'dashboard')}>Users Dashboard</button>}
      {loggedIn && <button onClick={() => setCurrentView('entries')} style={navBtnStyle(currentView === 'entries')}>Entries</button>}
      {loggedIn && <button onClick={logout} style={navBtnStyle(false)}>Logout</button>}
    </nav>
  );
}