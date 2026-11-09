import { useState } from 'react';

interface LoginProps {
  setCurrentView: (view: string) => void;
}

export function Login({ setCurrentView }: LoginProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginStatus, setLoginStatus] = useState<string>('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatus('Logging in...');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setLoginStatus('Login successful!');
        localStorage.setItem('username', data.username);
        if (data.admin === true) {
          localStorage.setItem('admin', data.username);
        }
        window.dispatchEvent(new Event('auth-change'));
        if (data.admin === true) 
        {
          setCurrentView("dashboard");
        }
        else
        {
          setCurrentView("entries");
        }
      } else {
        setLoginStatus(`Error: ${data.error || 'Invalid credentials'}`);
      }
    } catch (err) {
      setLoginStatus('Error connecting to server ' + err);
    }
  };

  const inputStyle = {
    padding: '8px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#2a2a2a',
    color: '#f1f1f1',
    boxSizing: 'border-box' as const,
    width: '100%',
  };

  return (
    <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto', color: '#f1f1f1' }}>
      <h2>Login</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={inputStyle}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
          required
        />
        <button
          type="submit"
          style={{
            padding: '10px',
            background: '#28A745',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          Login
        </button>
      </form>
      {loginStatus && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '0.95rem',
            color: loginStatus.includes('Error') ? '#ff6b6b' : '#f1f1f1',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {loginStatus}
        </p>
      )}
    </div>
  );
}