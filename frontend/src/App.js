import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [file, setFile] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [logs, setLogs] = useState([]);
  const [reports, setReports] = useState([]);
  const [expandedReport, setExpandedReport] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('rg-theme');
    return saved ? saved === 'dark' : true; // default dark
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('rg-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/logs');
        setLogs(res.data);
      } catch (e) { /* silent */ }
    };
    fetchLogs();
    const id = setInterval(fetchLogs, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await axios.get('http://localhost:5000/api/reports');
        setReports(res.data);
      } catch (e) { /* silent */ }
    };
    fetchReports();
    const id = setInterval(fetchReports, 5000);
    return () => clearInterval(id);
  }, []);

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const scanFile = async () => {
    if (!file) return;
    setScanning(true);
    setError(null);
    setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post('http://localhost:5000/api/scan', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Backend unreachable. Is app.py running?');
    } finally {
      setScanning(false);
    }
  };

  const resetScan = () => { setFile(null); setResult(null); setError(null); };

  return (
    <div className="app">
      <main className="main">

        {/* ─── Top Bar ─── */}
        <div className="topbar">
          <div className="topbar-brand">
            <div className="brand-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h1>RansomGuard<span>EDR</span></h1>
          </div>
          <div className="topbar-actions">
            <div className="status-badge">
              <div className="status-dot"></div>
              Monitoring
            </div>
            <button
              className="theme-toggle"
              onClick={() => setIsDark(!isDark)}
              title={isDark ? 'Light mode' : 'Dark mode'}
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* ─── Upload Panel ─── */}
        {!result && (
          <div className="panel">
            <div className="panel-head">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              File Analysis
            </div>
            <div className="panel-body">
              <div
                className={`upload-zone ${file ? 'has-file' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                <div className="upload-icon">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                {file ? (
                  <div className="file-info">
                    <span className="fname">{file.name}</span>
                    <span className="fsize">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                ) : (
                  <p className="upload-hint">Drop a file to analyse, or browse</p>
                )}
                <label className="pick-btn">
                  <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                  {file ? 'Change' : 'Browse files'}
                </label>
              </div>
              <button className="analyse-btn" onClick={scanFile} disabled={!file || scanning}>
                {scanning ? (<><span className="spinner"></span>Analysing…</>) : 'Run Analysis'}
              </button>
            </div>
          </div>
        )}

        {/* ─── Error ─── */}
        {error && (
          <div className="error-bar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
        )}

        {/* ─── Results ─── */}
        {result && (
          <div className="results">
            <div className={`verdict-banner ${result.is_ransomware ? 'danger' : 'safe'}`}>
              <div className="v-icon">
                {result.is_ransomware ? (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                )}
              </div>
              <h2>{result.prediction}</h2>
              <span className="v-conf">Confidence: {result.confidence.toFixed(1)}%</span>
            </div>

            <div className="metrics">
              <div className="m-row">
                <span className="m-label">File</span>
                <span className="m-val">{result.filename}</span>
              </div>
              <div className="m-row">
                <span className="m-label">Threat</span>
                <div className="m-bar">
                  <div className="m-bar-fill red" style={{ width: `${result.ransomware_probability}%` }}></div>
                </div>
                <span className="m-val">{result.ransomware_probability.toFixed(1)}%</span>
              </div>
              <div className="m-row">
                <span className="m-label">Benign</span>
                <div className="m-bar">
                  <div className="m-bar-fill green" style={{ width: `${result.benign_probability}%` }}></div>
                </div>
                <span className="m-val">{result.benign_probability.toFixed(1)}%</span>
              </div>
              <div className="m-row">
                <span className="m-label">Entropy</span>
                <span className="m-val">{result.entropy.toFixed(4)}</span>
              </div>
              <div className="m-row">
                <span className="m-label">Size</span>
                <span className="m-val">{(result.file_size / 1024).toFixed(2)} KB</span>
              </div>
            </div>

            <button className="reset-btn" onClick={resetScan}>← Analyse another file</button>
          </div>
        )}

        {/* ─── Live Feed ─── */}
        <div className="panel">
          <div className="panel-head">
            <div className="pulse-ring"></div>
            Live Security Feed
          </div>
          <div className="terminal">
            {logs.length > 0 ? (
              <div>
                {logs.map((log, i) => {
                  let cls = 't-line';
                  if (log.includes('[+]')) cls += ' t-ok';
                  else if (log.includes('[!]') || log.includes('[!!!]')) cls += ' t-warn';
                  else if (log.includes('[*]')) cls += ' t-info';
                  return <div key={i} className={cls}>{log}</div>;
                })}
              </div>
            ) : (
              <div className="t-empty">Waiting for events…</div>
            )}
          </div>
        </div>

        {/* ─── Forensic Reports ─── */}
        <div className="panel">
          <div className="panel-head">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Incident Reports
          </div>
          <div className="panel-body" style={{padding: reports.length > 0 ? '12px 16px' : '0'}}>
            {reports.length > 0 ? (
              reports.map((report, i) => (
                <div key={i} className="report-card">
                  <div className="rpt-head" onClick={() => setExpandedReport(expandedReport === i ? null : i)}>
                    <div className="rpt-title">
                      <svg className="rpt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span>{report.filename}</span>
                    </div>
                    <span className="rpt-chevron">{expandedReport === i ? '▲' : '▼'}</span>
                  </div>
                  {expandedReport === i && (
                    <pre className="rpt-body">{report.content}</pre>
                  )}
                </div>
              ))
            ) : (
              <div className="rpt-empty">No incidents recorded yet.</div>
            )}
          </div>
        </div>

        {/* ─── Footer ─── */}
        <footer className="foot">
          RansomGuard v2.0 · XGBoost ML Engine · Real-time EDR
        </footer>

      </main>
    </div>
  );
}

export default App;