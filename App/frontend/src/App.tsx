import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UsersDashboard } from './pages/UsersDashboard';
import { Entries } from './pages/Entries';
import { Account } from './pages/Account';

function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [message, setMessage] = useState<string>('Loading...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setMessage(data.status))
      .catch(() => setMessage('Error connecting to backend'));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '600px', margin: 'auto' }}>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {currentView === 'home' && <Home message={message} />}
      {currentView === 'login' && <Login setCurrentView={setCurrentView} />}
      {currentView === 'register' && <Register setCurrentView={setCurrentView} />}
      {currentView === 'dashboard' && <UsersDashboard />}
      {currentView === 'entries' && <Entries />}
      {currentView === 'account' && <Account setCurrentView={setCurrentView} />}
    </div>
  );
}

export default App;