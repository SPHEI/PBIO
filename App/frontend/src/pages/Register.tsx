import { useState } from 'react';

interface RegisterProps {
  setCurrentView: (view: string) => void;
}

export function Register({setCurrentView }: RegisterProps) {
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [repassword, setRepassword] = useState<string>('');
  const [regStatus, setRegStatus] = useState<string>('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegStatus('Registering...');

    if (password !== repassword) {
      setRegStatus("Error: Passwords don't match");
    } else {
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
          alert('Account created succesfully.')
          
          setCurrentView("login")
        } else {
          setRegStatus(`Error: ${data.error}`);
        }
      } catch (err) {
        setRegStatus('Error connecting to server');
      }
    }
  };

  return (
    <div>
      <h2>Register New User</h2>
      <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
        <input
          type="password"
          placeholder="Repeat Password"
          value={repassword}
          onChange={(e) => setRepassword(e.target.value)}
          style={{ padding: '8px', fontSize: '1rem' }}
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
          }}
        >
          Register User
        </button>
      </form>
      {regStatus && <p style={{ marginTop: '10px' }}>{regStatus}</p>}
    </div>
  );
}