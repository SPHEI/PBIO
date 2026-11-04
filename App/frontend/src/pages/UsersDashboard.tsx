import { useState, useEffect } from 'react';

interface UsersDashboardProps {
  setCurrentView: (view: string) => void;
  setSelectedUserId: (id: string) => void;
}

export function UsersDashboard({ setCurrentView, setSelectedUserId }: UsersDashboardProps) {
  const [users, setUsers] = useState<any[]>([]);
  const currentUsername = localStorage.getItem('username');

  const handleGetUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      if (token === null) {
        alert('No token');
      } else {
        const response = await fetch('/api/users', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        const data = await response.json();
        if (response.ok) {
          setUsers(data);
        } else {
          alert(data.error || 'An error occurred');
        }
      }
    } catch (err) {
      console.error('Error connecting to server', err);
    }
  };

  useEffect(() => {
    handleGetUsers();
  }, []);

  // Handle deleting a user
  const handleDeleteUser = async (userId: string, username: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete user "${username}" and all their data?`);
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();

      if (response.ok) {
        alert('User deleted successfully');
        handleGetUsers(); 
      } else {
        alert(data.error || 'Failed to delete user');
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  // Handle viewing a user's entries
  const handleViewUserEntries = (userId: string) => {
    setSelectedUserId(userId);
    setCurrentView('entries');
  };

  return (
    <div>
      <h2>Stored Users Dashboard</h2>
      <button
        onClick={handleGetUsers}
        style={{
          padding: '10px 15px',
          background: '#17A2B8',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '1rem',
          borderRadius: '4px',
          marginBottom: '15px',
        }}
      >
        Refresh
      </button>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {users.map((user) => {
          const isSelf = user.username === currentUsername;

          return (
            <li
              key={user.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px',
                borderBottom: '1px solid #eee',
                marginBottom: '8px',
                background: '#f9f9f9',
                borderRadius: '4px',
              }}
            >
              <div>
                <strong>{user.username}</strong>{' '}
                <span style={{ color: '#666', fontSize: '0.85rem' }}>
                  ({user.admin ? 'Admin' : 'User'} | Created: {new Date(user.createdAt).toLocaleDateString()})
                  {isSelf && <strong style={{ color: '#007BFF', marginLeft: '6px' }}>(You)</strong>}
                </span>
              </div>

              {/* Only show view/delete action buttons if it's NOT the currently logged-in user */}
              {!isSelf && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleViewUserEntries(user.id)}
                    style={{ padding: '6px 12px', background: '#007BFF', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem' }}
                  >
                    View User
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    style={{ padding: '6px 12px', background: '#DC3545', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px', fontSize: '0.85rem' }}
                  >
                    Delete User
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}