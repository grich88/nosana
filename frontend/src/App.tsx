import React, { useState } from 'react';
import './App.css';
import { getApiUrl } from './config';

interface AnalysisResponse {
  response: string;
  timestamp: string;
  securityDetails?: SecurityDetails;
}

interface SecurityDetails {
  overallScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  vulnerabilities: any[];
  codeQuality: any[];
  licenseRisks: any[];
  secrets: any[];
  recommendations: string[];
  summary: string;
}

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch(getApiUrl('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: query }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AnalysisResponse = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const examples = [
    'microsoft/vscode',
    'facebook/react',
    'Security scan for torvalds/linux',
    'https://github.com/vercel/next.js',
    'Check safety of tensorflow/tensorflow'
  ];

  return (
    <div className="App">
      <header className="App-header">
        <div className="container">
          <h1>🚀 GitHub Insights Agent</h1>
          <p className="subtitle">
            AI-powered repository analysis with intelligent health assessments
          </p>

          <form onSubmit={handleSubmit} className="search-form">
            <div className="search-container">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter GitHub repo (e.g., microsoft/vscode) or URL..."
                className="search-input"
                disabled={loading}
              />
              <button 
                type="submit" 
                className="search-button"
                disabled={loading || !query.trim()}
              >
                {loading ? '🔍 Analyzing...' : '🔍 Analyze'}
              </button>
            </div>
          </form>

          <div className="examples">
            <p>Try these examples:</p>
            <div className="example-buttons">
              {examples.map((example, index) => (
                <button
                  key={index}
                  className="example-button"
                  onClick={() => setQuery(example)}
                  disabled={loading}
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="error">
              <h3>❌ Error</h3>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="result">
              <h3>📊 Analysis Results</h3>
              <div className="response-content">
                <pre>{result.response}</pre>
              </div>
              
              {result.securityDetails && (
                <div className="security-details">
                  <h4>🔒 Security Summary</h4>
                  <div className="security-score">
                    <span className={`risk-badge risk-${result.securityDetails.riskLevel.toLowerCase()}`}>
                      Security Score: {result.securityDetails.overallScore}/100 ({result.securityDetails.riskLevel})
                    </span>
                  </div>
                  
                  <div className="security-stats">
                    <div className="stat">
                      <span className="stat-label">Code Issues:</span>
                      <span className="stat-value">{result.securityDetails.codeQuality.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">Secrets Found:</span>
                      <span className="stat-value">{result.securityDetails.secrets.length}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-label">License Risks:</span>
                      <span className="stat-value">{result.securityDetails.licenseRisks.length}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="timestamp">
                Generated at: {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="info">
              <h3>✨ Features</h3>
              <ul>
                <li>🔍 Deep repository analysis</li>
                <li>🏥 Health scoring (1-10)</li>
                <li>📈 Key metrics and insights</li>
                <li>🤖 AI-powered recommendations</li>
                <li>🌐 Support for any public GitHub repo</li>
              </ul>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
