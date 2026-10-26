import { useState } from 'react';

interface LoginProps {
  setCurrentView: (view: string) => void;
}

export function Login({setCurrentView }: LoginProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loginStatus, setLoginStatus] = useState<string>('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginStatus('Logging in...');

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();
      console.log(data)

      if (response.ok) {
        setLoginStatus('Login successful!');
        console.log(data.token)
        localStorage.setItem('username', data.username);
        localStorage.setItem('token', data.token);
        if(data.admin === true)
        {
            localStorage.setItem('admin', data.username);
        }
        window.dispatchEvent(new Event('auth-change'));
        setCurrentView("home")
      } else {
        setLoginStatus(`Error: ${data.error || 'Invalid credentials'}`);
      }
    } catch (err) {
      setLoginStatus('Error connecting to server');
    }
  };

  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ padding: '8px', fontSize: '1rem' }}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '8px', fontSize: '1rem' }}
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
          }}
        >
          Login
        </button>
      </form>
      {loginStatus && <p style={{ marginTop: '10px' }}>{loginStatus}</p>}
    </div>
  );
}