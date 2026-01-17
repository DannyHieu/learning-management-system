import React, { useState, useEffect } from 'react';
import './../App.css';

interface QueryTab {
  id: number;
  name: string;
  sql: string;
}

const defaultQueries: QueryTab[] = [
  { id: 1, name: 'GIAOVIEN', sql: 'SELECT * FROM GIAOVIEN' },
  { id: 2, name: 'Query 2', sql: 'SELECT * FROM Products;' },
  { id: 3, name: 'Query 3', sql: 'SELECT count(*) FROM Orders;' },
];

const SqlPlayground: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(1);
  const [queries, setQueries] = useState<QueryTab[]>(defaultQueries);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQuery = queries.find(q => q.id === activeTab) || queries[0];

  const handleSqlChange = (newSql: string) => {
    setQueries(queries.map(q => q.id === activeTab ? { ...q, sql: newSql } : q));
  };

  // Fetch GIAOVIEN data on mount
  useEffect(() => {
    const fetchGiaoVien = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/giaovien');
        if (!response.ok) {
          throw new Error('Failed to fetch GIAOVIEN data');
        }
        const data = await response.json();
        setResults(data);
      } catch (err: any) {
        console.error("Error fetching GIAOVIEN:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGiaoVien();
  }, []);

  const handleRunSql = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8080/api/sql/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: activeQuery.sql,
      });

      const data = await response.json();

      if (!response.ok) {
         throw new Error(data.error || `Server error: ${response.statusText}`);
      }
      
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        setResults([]); 
      }
      
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sql-container">
      <div className="header-section">
        <h1>SQL Statement:</h1>
      </div>

      <div className="tab-navigator">
        {queries.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="editor-container">
        <textarea
          className="sql-editor"
          value={activeQuery.sql}
          onChange={(e) => handleSqlChange(e.target.value)}
          spellCheck={false}
        />
      </div>

      <p className="instruction-text">
        Edit the SQL Statement, and click "Run SQL" to see the result.
      </p>

      <button className="run-btn" onClick={handleRunSql} disabled={loading}>
        {loading ? 'Running...' : 'Run SQL »'}
      </button>

      <h2>Result:</h2>
      
      <div className="result-section">
        <div className="record-count">Number of Records: {results.length}</div>
        
        {error ? (
          <div className="error-message">{error}</div>
        ) : (
            <div className="table-responsive">
            <table className="w3-table">
              <thead>
                <tr>
                    {results.length > 0 && Object.keys(results[0]).map(key => (
                    <th key={key}>{key}</th>
                    ))}
                </tr>
              </thead>
              <tbody>
                  {results.map((row, index) => (
                  <tr key={index}>
                      {Object.values(row).map((val: any, i) => (
                      <td key={i}>{val}</td>
                      ))}
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SqlPlayground;
