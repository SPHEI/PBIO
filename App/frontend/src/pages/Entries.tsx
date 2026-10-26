import { useState, useEffect } from 'react';

interface Entry {
  id: string;
  name: string;
  amount: number;
  date: string;
  income: boolean;
}

export function Entries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [income, setIncome] = useState<boolean>(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today (YYYY-MM-DD)
  const [status, setStatus] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Fetch entries on load
  const fetchEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/entries', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setEntries(data);
      } else {
        setStatus(`Error: ${data.error || 'Failed to load entries'}`);
      }
    } catch (err) {
      setStatus('Error connecting to server');
    }
  };

  useEffect(() => {
    fetchEntries();
  }, []);

  // Handle adding an entry
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Adding entry...');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name || 'Transfer',
          amount: parseFloat(amount),
          income,
          date: date ? new Date(date).toISOString() : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setName('');
        setAmount('');
        setIncome(false);
        setDate(new Date().toISOString().split('T')[0]);
        setStatus('');
        setIsModalOpen(false); // Close popup on success
        fetchEntries(); // Refresh list
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus('Error connecting to server');
    }
  };

  // Handle deleting an entry with confirmation
  const handleDeleteEntry = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this entry?');
    if (!confirmed) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/entries/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchEntries(); // Refresh list
      } else {
        const data = await response.json();
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert('Error connecting to server');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2>My Entries</h2>
        <button
          onClick={() => { setIsModalOpen(true); setStatus(''); }}
          style={{ padding: '10px 15px', background: '#007BFF', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', borderRadius: '4px' }}
        >
          + Add New Entry
        </button>
      </div>

      {/* Modal Popup Overlay */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'white',
            padding: '20px',
            borderRadius: '8px',
            width: '100%',
            maxWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            position: 'relative'
          }}>
            <h3>Add New Entry</h3>
            <form onSubmit={handleAddEntry} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
              <input
                type="text"
                placeholder="Entry Name (e.g. Salary, Rent)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: '8px', fontSize: '1rem' }}
              />
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ padding: '8px', fontSize: '1rem' }}
                required
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '0.9rem', color: '#555' }}>Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ padding: '8px', fontSize: '1rem' }}
                  required
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem' }}>
                <input
                  type="checkbox"
                  checked={income}
                  onChange={(e) => setIncome(e.target.checked)}
                />
                Is this Income? (Unchecked = Expense)
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button type="submit" style={{ flex: 1, padding: '10px', background: '#28A745', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', borderRadius: '4px' }}>
                  Save Entry
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{ flex: 1, padding: '10px', background: '#6C757D', color: 'white', border: 'none', cursor: 'pointer', fontSize: '1rem', borderRadius: '4px' }}
                >
                  Cancel
                </button>
              </div>
              {status && <p style={{ margin: '5px 0', fontSize: '0.9rem', color: 'red' }}>{status}</p>}
            </form>
          </div>
        </div>
      )}

      {/* Entries List */}
      <h3>Stored Entries</h3>
      {entries.length === 0 ? (
        <p style={{ color: '#666' }}>No entries found.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {entries.map((entry) => (
            <li key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', borderBottom: '1px solid #eee', marginBottom: '8px' }}>
              <div>
                <strong>{entry.name}</strong> —{' '}
                <span style={{ color: entry.income ? 'green' : 'red', fontWeight: 'bold' }}>
                  {entry.income ? '+' : '-'}${entry.amount.toFixed(2)}
                </span>
                <br />
                <span style={{ fontSize: '0.8rem', color: '#666' }}>
                  {new Date(entry.date).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => handleDeleteEntry(entry.id)}
                style={{ padding: '5px 10px', background: '#DC3545', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}