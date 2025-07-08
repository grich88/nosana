import React, { useState } from 'react';
import './App.css';
import { getApiUrl } from './config';

interface AnalysisResponse {
  response: string;
  timestamp: string;
  securityDetails?: SecurityDetails;
  issues?: any[];
  pullRequests?: any[];
  contributors?: any[];
  dependencies?: any[];
  releases?: any[];
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

type AnalysisType = 'overview' | 'security' | 'issues' | 'prs' | 'contributors' | 'dependencies' | 'releases';

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisType>('overview');

  const handleAnalysis = async (analysisType: AnalysisType) => {
    if (!query.trim()) {
      setError('Please enter a repository first');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setCurrentAnalysis(analysisType);

    try {
      let endpoint = '/chat';
      switch (analysisType) {
        case 'security':
          endpoint = '/security';
          break;
        case 'issues':
          endpoint = '/analyze-issues';
          break;
        case 'prs':
          endpoint = '/analyze-prs';
          break;
        case 'contributors':
          endpoint = '/analyze-contributors';
          break;
        case 'dependencies':
          endpoint = '/analyze-dependencies';
          break;
        case 'releases':
          endpoint = '/generate-release-notes';
          break;
        default:
          endpoint = '/chat';
      }

      const response = await fetch(getApiUrl(endpoint), {
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

  const analysisTypes = [
    { key: 'overview', label: '📊 Overview', desc: 'Repository health & metrics' },
    { key: 'security', label: '🔒 Security', desc: 'Vulnerability scanning' },
    { key: 'issues', label: '📋 Issues', desc: 'Open issues analysis & AI fixes' },
    { key: 'prs', label: '🔄 Pull Requests', desc: 'PR insights & merge patterns' },
    { key: 'contributors', label: '👥 Contributors', desc: 'Team analysis & patterns' },
    { key: 'dependencies', label: '📦 Dependencies', desc: 'Package health & updates' },
    { key: 'releases', label: '📝 Releases', desc: 'Release notes & versioning' }
  ];

  const examples = [
    'microsoft/vscode',
    'facebook/react',
    'vercel/next.js',
    'https://github.com/nodejs/node',
    'tensorflow/tensorflow'
  ];

  const getAnalysisIcon = (type: AnalysisType) => {
    const icons = {
      overview: '📊',
      security: '🔒',
      issues: '📋',
      prs: '🔄',
      contributors: '👥',
      dependencies: '📦',
      releases: '📝'
    };
    return icons[type];
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="container">
          <h1>🚀 GitHub Insights Agent</h1>
          <p className="subtitle">
            AI-powered repository analysis with intelligent insights & automated fixes
          </p>

          <div className="search-section">
            <div className="search-container">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter GitHub repo (e.g., microsoft/vscode) or URL..."
                className="search-input"
                disabled={loading}
                onKeyPress={(e) => e.key === 'Enter' && handleAnalysis('overview')}
              />
            </div>

            <div className="analysis-buttons">
              {analysisTypes.map((analysis) => (
                <button
                  key={analysis.key}
                  className={`analysis-button ${currentAnalysis === analysis.key ? 'active' : ''}`}
                  onClick={() => handleAnalysis(analysis.key as AnalysisType)}
                  disabled={loading}
                  title={analysis.desc}
                >
                  <span className="button-icon">{analysis.label.split(' ')[0]}</span>
                  <span className="button-text">{analysis.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>

            {loading && (
              <div className="loading-indicator">
                <div className="spinner"></div>
                <p>🔍 Analyzing {currentAnalysis}... Please wait</p>
              </div>
            )}
          </div>

          <div className="examples">
            <p>✨ Try these examples:</p>
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
              <div className="result-header">
                <h3>{getAnalysisIcon(currentAnalysis)} {currentAnalysis.charAt(0).toUpperCase() + currentAnalysis.slice(1)} Analysis Results</h3>
                <div className="analysis-badges">
                  {result.securityDetails && (
                    <span className={`security-badge ${result.securityDetails.riskLevel.toLowerCase()}`}>
                      Security: {result.securityDetails.riskLevel}
                    </span>
                  )}
                  {result.issues && (
                    <span className="info-badge">
                      {result.issues.length} Issues
                    </span>
                  )}
                  {result.pullRequests && (
                    <span className="info-badge">
                      {result.pullRequests.length} PRs
                    </span>
                  )}
                  {result.contributors && (
                    <span className="info-badge">
                      {result.contributors.length} Contributors
                    </span>
                  )}
                </div>
              </div>
              
              <div className="response-content">
                <pre>{result.response}</pre>
              </div>
              
              {result.securityDetails && currentAnalysis === 'security' && (
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
                    <div className="stat">
                      <span className="stat-label">Vulnerabilities:</span>
                      <span className="stat-value">{result.securityDetails.vulnerabilities.length}</span>
                    </div>
                  </div>
                </div>
              )}

              {result.issues && currentAnalysis === 'issues' && result.issues.length > 0 && (
                <div className="data-section">
                  <h4>📋 Top Issues</h4>
                  <div className="issues-list">
                    {result.issues.slice(0, 5).map((issue, index) => (
                      <div key={issue.number} className="issue-item">
                        <h5>#{issue.number}: {issue.title}</h5>
                        <p>👤 {issue.user.login} • 💬 {issue.comments} comments • ⭐ {issue.reactions?.total_count || 0} reactions</p>
                        <div className="issue-labels">
                          {issue.labels.slice(0, 3).map((label: any) => (
                            <span key={label.id} className="label" style={{backgroundColor: `#${label.color}`}}>
                              {label.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.contributors && currentAnalysis === 'contributors' && (
                <div className="data-section">
                  <h4>👥 Top Contributors</h4>
                  <div className="contributors-list">
                    {result.contributors.slice(0, 8).map((contributor, index) => (
                      <div key={contributor.id} className="contributor-item">
                        <img src={contributor.avatar_url} alt={contributor.login} className="avatar" />
                        <div className="contributor-info">
                          <strong>{contributor.login}</strong>
                          <span>{contributor.contributions} commits</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="timestamp">
                Generated at: {new Date(result.timestamp).toLocaleString()}
              </div>

              <div className="action-buttons">
                <button 
                  className="action-button"
                  onClick={() => handleAnalysis('overview')}
                  disabled={loading || currentAnalysis === 'overview'}
                >
                  📊 Switch to Overview
                </button>
                <button 
                  className="action-button"
                  onClick={() => handleAnalysis('security')}
                  disabled={loading || currentAnalysis === 'security'}
                >
                  🔒 Run Security Scan
                </button>
                {currentAnalysis === 'issues' && (
                  <button className="action-button primary">
                    💡 Get AI Fixes for Issues
                  </button>
                )}
              </div>
            </div>
          )}

          {!result && !error && !loading && (
            <div className="info">
              <h3>✨ Powerful GitHub Analysis Features</h3>
              <div className="features-grid">
                {analysisTypes.map((feature) => (
                  <div key={feature.key} className="feature-card">
                    <div className="feature-icon">{feature.label.split(' ')[0]}</div>
                    <h4>{feature.label.split(' ').slice(1).join(' ')}</h4>
                    <p>{feature.desc}</p>
                  </div>
                ))}
              </div>
              
              <div className="capabilities">
                <h4>🤖 AI-Powered Capabilities:</h4>
                <ul>
                  <li>🔍 Deep repository analysis with health scoring</li>
                  <li>💡 AI-generated fixes and recommendations for issues</li>
                  <li>🛡️ Comprehensive security vulnerability scanning</li>
                  <li>📈 Contributor patterns and team insights</li>
                  <li>📦 Dependency health monitoring and updates</li>
                  <li>🚀 Automated release notes generation</li>
                  <li>🌐 Support for any public GitHub repository</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </header>
    </div>
  );
}

export default App;
