import { useState } from 'react';

interface RegisterProps {
  setCurrentView: (view: string) => void;
}

export function Register({ setCurrentView }: RegisterProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [repassword, setRepassword] = useState<string>('');
  const [regStatus, setRegStatus] = useState<string>('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegStatus('');

    // Password validation rules
    if (password.length < 6) {
      setRegStatus('Error: Password must be at least 6 characters long');
      return;
    }
    if (!/[A-Z]/.test(password)) {
      setRegStatus('Error: Password must contain at least 1 uppercase letter');
      return;
    }
    if (!/[0-9]/.test(password)) {
      setRegStatus('Error: Password must contain at least 1 number');
      return;
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      setRegStatus('Error: Password must contain at least 1 special symbol');
      return;
    }
    if (password !== repassword) {
      setRegStatus("Error: Passwords don't match");
      return;
    }

    setRegStatus('Registering...');

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setRegStatus(`Success! User created with ID: ${data.userId}`);
        setUsername('');
        setPassword('');
        setRepassword('');
        alert('Account created successfully.');
        
        setCurrentView("login");
      } else {
        setRegStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setRegStatus('Error connecting to server ' + err);
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
      <h2>Register New User</h2>
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
        <input
          type="password"
          placeholder="Repeat Password"
          value={repassword}
          onChange={(e) => setRepassword(e.target.value)}
          style={inputStyle}
          required
        />
        <button
          type="submit"
          style={{
            padding: '10px',
            background: '#007BFF',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: '4px',
            fontWeight: 'bold',
          }}
        >
          Register User
        </button>
      </form>
      {regStatus && (
        <p
          style={{
            marginTop: '12px',
            fontSize: '0.95rem',
            color: regStatus.includes('Error') ? '#ff6b6b' : '#57ab5a',
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {regStatus}
        </p>
      )}
    </div>
  );
}