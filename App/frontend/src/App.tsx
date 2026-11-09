import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { UsersDashboard } from './pages/UsersDashboard';
import { Entries } from './pages/Entries';
import { Account } from './pages/Account';


const originalFetch = window.fetch;

window.fetch = async function (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  init.credentials = 'include';
  let response = await originalFetch(input, init);

  if (response.status === 401) {
      alert("Invalid token, please log in again.");
      localStorage.removeItem('username');
      localStorage.removeItem('admin');
      window.dispatchEvent(new Event('auth-change'));
      window.location.reload();
  }
  return response;
};

function App() {
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedUserId, setSelectedUserId] = useState<string>('home');
  const [message, setMessage] = useState<string>('Loading...');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setMessage(data.status))
      .catch(() => setMessage('Error connecting to backend'));
  }, []);

  return (
    <div style={{ fontFamily: 'sans-serif', width: '100%', minHeight: '100vh', display: 'flex', flexDirection: 'column', margin: 'auto', alignItems: 'center' }}>
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {currentView === 'home' && <Home message={message} />}
      {currentView === 'login' && <Login setCurrentView={setCurrentView} />}
      {currentView === 'register' && <Register setCurrentView={setCurrentView} />}
      {currentView === 'dashboard' && <UsersDashboard setCurrentView={setCurrentView} setSelectedUserId={setSelectedUserId}/>}
      {currentView === 'entries' && <Entries selectedUserId={selectedUserId} />}
      {currentView === 'account' && <Account setCurrentView={setCurrentView} />}
    </div>
  );
}

export default App;