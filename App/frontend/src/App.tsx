import { useState, useEffect } from 'react';

function App() {
  const [message, setMessage] = useState<string>('Loading...');
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [regStatus, setRegStatus] = useState<string>('');
  const [users, setUsers] = useState<any[]>([]);

  // Check backend health/connection on load
  useEffect(() => {
    fetch('/api')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Error connecting to backend'));
  }, []);

  // Handle User Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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
      } else {
        setRegStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setRegStatus('Error connecting to server');
    }
  };

  // Handle Fetching Users
  const handleGetUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      if (response.ok) {
        setUsers(data);
      } else {
        console.error('Failed to fetch users');
      }
    } catch (err) {
      console.error('Error connecting to server');
    }
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', maxWidth: '500px', margin: 'auto' }}>
      <h1>My Notes App</h1>
      <p>Backend Status: <strong>{message}</strong></p>

      <hr style={{ margin: '20px 0' }} />

      {/* Registration Section */}
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
        <button type="submit" style={{ padding: '10px', background: '#007BFF', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
          Register User
        </button>
      </form>
      {regStatus && <p style={{ marginTop: '10px' }}>{regStatus}</p>}

      <hr style={{ margin: '20px 0' }} />

      {/* Users List Section */}
      <h2>Stored Users</h2>
      <button onClick={handleGetUsers} style={{ padding: '10px', background: '#28A745', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>
        Fetch Users List
      </button>
      <ul style={{ marginTop: '15px', paddingLeft: '20px' }}>
        {users.map((user) => (
          <li key={user.id} style={{ marginBottom: '5px' }}>
            <strong>{user.username}</strong> <span style={{ color: '#666', fontSize: '0.85rem' }}>(ID: {user.id})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;