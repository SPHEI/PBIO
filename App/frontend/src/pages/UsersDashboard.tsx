import { useState } from 'react';

export function UsersDashboard() {
  const [users, setUsers] = useState<any[]>([]);

  const handleGetUsers = async () => {
    try {
      const token = localStorage.getItem('token')
      if(token === null)
      {
        alert("No token")
      }
      else
      {
        const response = await fetch('/api/users', {
            method: 'GET',
            headers: {
            'Authorization': `Bearer ${token}`
            }
        });
        const data = await response.json();
        if (response.ok) {
            setUsers(data);
        } else {
            alert(data.error || 'An error occurred');
        }
      }
    } catch (err) {
      console.error('Error connecting to server');
    }
  };

  return (
    <div>
      <h2>Stored Users Dashboard</h2>
      <button
        onClick={handleGetUsers}
        style={{
          padding: '10px',
          background: '#17A2B8',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          borderRadius: '4px',
        }}
      >
        Fetch Users List
      </button>
      <ul style={{ marginTop: '15px', paddingLeft: '20px' }}>
        {users.map((user) => (
          <li key={user.id} style={{ marginBottom: '8px' }}>
            <strong>{user.username}</strong>{' '}
            <span style={{ color: '#666', fontSize: '0.85rem' }}>
              (ID: {user.id} | {user.admin ? 'Admin' : 'User'} | Created: {user.createdAt})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}