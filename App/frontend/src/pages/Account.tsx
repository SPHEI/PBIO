import { useState } from 'react';

interface AccountProps {
  setCurrentView: (view: string) => void;
}

export function Account({setCurrentView }: AccountProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword !== confirmNewPassword) {
      setPasswordStatus({ type: 'error', msg: 'New passwords do not match' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', msg: 'New password must be at least 6 characters long' });
      return;
    }

    const confirmed = window.confirm('Are you sure you want to change your password?');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/password', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Password updated successfully! \nPlease log in again.');
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');

        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('admin');
        window.dispatchEvent(new Event('auth-change'));
        setCurrentView('home');
      } else {
        setPasswordStatus({ type: 'error', msg: data.error || 'Failed to update password' });
      }
    } catch (err) {
      setPasswordStatus({ type: 'error', msg: 'Error connecting to server' });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: deletePassword }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Your account and all associated entries have been deleted.');

        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('admin');
        window.dispatchEvent(new Event('auth-change'));
        setCurrentView('home');
      } else {
        setDeleteStatus({ type: 'error', msg: data.error || 'Failed to delete account' });
        setShowDeleteConfirmModal(false);
      }
    } catch (err) {
      setDeleteStatus({ type: 'error', msg: 'Error connecting to server' });
      setShowDeleteConfirmModal(false);
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: '0 auto', padding: '10px' }}>
      <h2>Account Settings</h2>

      {/* Change Password Card */}
      <section style={{ background: '#f8f9fa', padding: '20px', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #e9ecef' }}>
        <h3>Change Password</h3>
        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Current Password</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Confirm New Password</label>
            <input
              type="password"
              value={confirmNewPassword}
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            style={{ padding: '10px', background: '#007BFF', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem', marginTop: '5px' }}
          >
            Update Password
          </button>

          {passwordStatus && (
            <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: passwordStatus.type === 'success' ? '#28a745' : '#dc3545' }}>
              {passwordStatus.msg}
            </p>
          )}
        </form>
      </section>

      {/* Delete Account Card */}
      <section style={{ background: '#fff5f5', padding: '20px', borderRadius: '8px', border: '1px solid #feb2b2' }}>
        <h3 style={{ color: '#c53030' }}>Danger Zone: Delete Account</h3>
        <p style={{ fontSize: '0.9rem', color: '#742a2a', marginTop: '5px' }}>
          Deleting your account is permanent. All stored financial entries will be deleted immediately and cannot be recovered.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!deletePassword) return;
            setShowDeleteConfirmModal(true);
          }}
          style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '15px' }}
        >
          <div>
            <label style={{ display: 'block', marginBottom: '4px', fontSize: '0.9rem', color: '#742a2a' }}>
              Enter Password to Confirm
            </label>
            <input
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              style={{ width: '100%', padding: '8px', fontSize: '1rem', borderRadius: '4px', border: '1px solid #feb2b2', boxSizing: 'border-box' }}
            />
          </div>

          <button
            type="submit"
            style={{ padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' }}
          >
            Delete Account Permanently
          </button>

          {deleteStatus && (
            <p style={{ margin: '5px 0 0 0', fontSize: '0.9rem', color: '#dc3545' }}>
              {deleteStatus.msg}
            </p>
          )}
        </form>
      </section>

      {/* Confirmation Modal for Deletion */}
      {showDeleteConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>
            <h3 style={{ marginTop: 0, color: '#dc3545' }}>⚠️ Final Confirmation</h3>
            <p style={{ fontSize: '0.95rem', color: '#333' }}>
              Are you absolutely sure? This action <strong>cannot be undone</strong> and will permanently wipe all your data.
            </p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={handleDeleteAccount}
                style={{ flex: 1, padding: '10px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Yes, Delete My Account
              </button>
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                style={{ flex: 1, padding: '10px', background: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}