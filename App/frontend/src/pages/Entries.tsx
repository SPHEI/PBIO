import { useState, useEffect, useCallback, useMemo } from 'react';

interface Entry {
  id: string;
  name: string;
  amount: number;
  date: string;
  income: boolean;
}

interface EntriesProps {
  selectedUserId: string;
}

export function Entries({ selectedUserId }: EntriesProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [income, setIncome] = useState<boolean>(false);
  const [date, setDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Sorting and filtering states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<
    'all' | 'income' | 'expense'
  >('all');

  const [sortBy, setSortBy] = useState<
    'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'name-asc'
  >('date-desc');

  // Fetch entries
  const fetchEntries = useCallback(async () => {
    try {
      let userId = '';

      if (localStorage.getItem('admin') !== null) {
        userId = '?userId=' + encodeURIComponent(selectedUserId);
      }

      const response = await fetch('/api/entries' + userId, {
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setEntries(data);
      } else {
        setStatus(`Error: ${data.error || 'Failed to load entries'}`);
      }
    } catch (err) {
      setStatus('Error connecting to server ' + err);
    }
  }, [selectedUserId]);

  // Fetch entries on load and when selected user changes
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // Handle adding an entry
  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Adding entry...');

    try {
      let userId = null;

      if (localStorage.getItem('admin') !== null) {
        userId = selectedUserId;
      }

      const response = await fetch('/api/entries', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name || 'Transfer',
          amount: parseFloat(amount),
          income,
          date: date ? new Date(date).toISOString() : undefined,
          targetUserId: userId,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setName('');
        setAmount('');
        setIncome(false);
        setDate(new Date().toISOString().split('T')[0]);
        setStatus('');
        setIsModalOpen(false);

        fetchEntries();
      } else {
        setStatus(`Error: ${data.error || 'Failed to add entry'}`);
      }
    } catch (err) {
      setStatus('Error connecting to server ' + err);
    }
  };

  // Handle deleting an entry with confirmation
  const handleDeleteEntry = async (id: string) => {
    const confirmed = window.confirm(
      'Are you sure you want to delete this entry?'
    );

    if (!confirmed) return;

    try {
      const response = await fetch(`/api/entries/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        fetchEntries();
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to delete entry'}`);
      }
    } catch (err) {
      alert(`Error connecting to server\n${err}`);
    }
  };

  // Calculate totals using ALL entries, regardless of filters
  const totalIncome = entries
    .filter((e) => e.income)
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpense = entries
    .filter((e) => !e.income)
    .reduce((sum, e) => sum + e.amount, 0);

  const balance = totalIncome - totalExpense;

  // Filter and sort entries
  const filteredEntries = useMemo(() => {
    let result = [...entries];

    // Search by entry name
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();

      result = result.filter((entry) =>
        entry.name.toLowerCase().includes(search)
      );
    }

    // Filter by income or expense
    if (typeFilter === 'income') {
      result = result.filter((entry) => entry.income);
    } else if (typeFilter === 'expense') {
      result = result.filter((entry) => !entry.income);
    }

    // Sort entries
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );

        case 'date-asc':
          return (
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );

        case 'amount-desc':
          return b.amount - a.amount;

        case 'amount-asc':
          return a.amount - b.amount;

        case 'name-asc':
          return a.name.localeCompare(b.name);

        default:
          return 0;
      }
    });

    return result;
  }, [entries, searchTerm, typeFilter, sortBy]);

  // Dark mode input style
  const inputStyle: React.CSSProperties = {
    padding: '8px',
    fontSize: '1rem',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#2a2a2a',
    color: '#f1f1f1',
    boxSizing: 'border-box',
  };

  // Shared select style
  const selectStyle: React.CSSProperties = {
    flex: 1,
    minWidth: '140px',
    padding: '10px',
    fontSize: '0.95rem',
    borderRadius: '4px',
    border: '1px solid #444',
    backgroundColor: '#2a2a2a',
    color: '#f1f1f1',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '800px',
        margin: '0 auto',
        color: '#f1f1f1',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h2>My Entries</h2>

        <button
          onClick={() => {
            setIsModalOpen(true);
            setStatus('');
          }}
          style={{
            padding: '10px 15px',
            background: '#007BFF',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            borderRadius: '4px',
          }}
        >
          + Add New Entry
        </button>
      </div>

      {/* Balance Summary Cards */}
      <div
        style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        {/* Total Balance */}
        <div
          style={{
            flex: 1,
            minWidth: '150px',
            background: '#1e1e1e',
            border: '1px solid #333',
            padding: '15px',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#aaa' }}>
            Total Balance
          </span>

          <h3
            style={{
              margin: '5px 0 0 0',
              color: balance >= 0 ? '#28a745' : '#ff6b6b',
            }}
          >
            ${balance.toFixed(2)}
          </h3>
        </div>

        {/* Total Income */}
        <div
          style={{
            flex: 1,
            minWidth: '150px',
            background: '#162219',
            border: '1px solid #234229',
            padding: '15px',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#57ab5a' }}>
            Total Income
          </span>

          <h3 style={{ margin: '5px 0 0 0', color: '#57ab5a' }}>
            +${totalIncome.toFixed(2)}
          </h3>
        </div>

        {/* Total Expense */}
        <div
          style={{
            flex: 1,
            minWidth: '150px',
            background: '#251616',
            border: '1px solid #5c2b2b',
            padding: '15px',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <span style={{ fontSize: '0.85rem', color: '#ff6b6b' }}>
            Total Expense
          </span>

          <h3 style={{ margin: '5px 0 0 0', color: '#ff6b6b' }}>
            -${totalExpense.toFixed(2)}
          </h3>
        </div>
      </div>

      {/* Add Entry Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            padding: '15px',
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#1e1e1e',
              color: '#f1f1f1',
              padding: '24px',
              borderRadius: '8px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
              border: '1px solid #333',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            <h3 style={{ marginTop: 0 }}>Add New Entry</h3>

            <form
              onSubmit={handleAddEntry}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                marginTop: '15px',
              }}
            >
              <input
                type="text"
                placeholder="Entry Name (e.g. Salary, Rent)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />

              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={inputStyle}
                required
              />

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '5px',
                }}
              >
                <label style={{ fontSize: '0.9rem', color: '#bbb' }}>
                  Date
                </label>

                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={inputStyle}
                  required
                />
              </div>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '1rem',
                  color: '#ccc',
                }}
              >
                <input
                  type="checkbox"
                  checked={income}
                  onChange={(e) => setIncome(e.target.checked)}
                />

                Is this Income? (Unchecked = Expense)
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  marginTop: '10px',
                }}
              >
                <button
                  type="submit"
                  style={{
                    flex: 1,
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
                  Save Entry
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    background: '#495057',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    borderRadius: '4px',
                  }}
                >
                  Cancel
                </button>
              </div>

              {status && (
                <p
                  style={{
                    margin: '5px 0',
                    fontSize: '0.9rem',
                    color: '#ff6b6b',
                  }}
                >
                  {status}
                </p>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Stored Entries Section */}
      <div
        style={{
          width: '100%',
          maxWidth: '600px',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h3>Stored Entries</h3>

        {/* Search and Filter Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            marginBottom: '20px',
            textAlign: 'left',
          }}
        >
          {/* Search */}
          <input
            type="text"
            placeholder="Search entries by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...inputStyle,
              padding: '10px',
              width: '100%',
            }}
          />

          {/* Filter and Sort */}
          <div
            style={{
              display: 'flex',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <select
              value={typeFilter}
              onChange={(e) =>
                setTypeFilter(
                  e.target.value as 'all' | 'income' | 'expense'
                )
              }
              style={selectStyle}
            >
              <option value="all">All Entries</option>
              <option value="income">Income Only</option>
              <option value="expense">Expenses Only</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as typeof sortBy)
              }
              style={selectStyle}
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
              <option value="name-asc">Name (A–Z)</option>
            </select>
          </div>

          {/* Results Count and Reset Filters */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#aaa',
              fontSize: '0.85rem',
              gap: '10px',
            }}
          >
            <span>
              Showing {filteredEntries.length} of {entries.length} entries
            </span>

            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setTypeFilter('all');
                setSortBy('date-desc');
              }}
              style={{
                padding: '6px 10px',
                background: '#495057',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              Reset Filters
            </button>
          </div>
        </div>

        {/* Entries List */}
        {filteredEntries.length === 0 ? (
          <p style={{ color: '#aaa' }}>
            {entries.length === 0
              ? 'No entries found.'
              : 'No entries match your search or filters.'}
          </p>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              padding: 0,
              textAlign: 'left',
            }}
          >
            {filteredEntries.map((entry) => (
              <li
                key={entry.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  background: '#1e1e1e',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  gap: '10px',
                }}
              >
                <div>
                  <strong style={{ color: '#fff' }}>
                    {entry.name}
                  </strong>

                  {' — '}

                  <span
                    style={{
                      color: entry.income ? '#57ab5a' : '#ff6b6b',
                      fontWeight: 'bold',
                    }}
                  >
                    {entry.income ? '+' : '-'}$
                    {entry.amount.toFixed(2)}
                  </span>

                  <br />

                  <span
                    style={{
                      fontSize: '0.8rem',
                      color: '#aaa',
                    }}
                  >
                    {new Date(entry.date).toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => handleDeleteEntry(entry.id)}
                  style={{
                    padding: '6px 12px',
                    background: '#dc3545',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    borderRadius: '4px',
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}