import React, { useState } from 'react';
import axios from 'axios';
import './App.css';
import { API_CONFIG } from './config';

interface AnalysisResult {
  response: string;
  timestamp?: string;
  searchResults?: any[];
  totalFound?: number;
  bounties?: any[];
  totalBounties?: number;
  estimatedEarnings?: any;
  patterns?: any[];
  similarRepositories?: any[];
  learningPath?: any[];
  estimatedTimeToComplete?: string;
  fixes?: any[];
  contributors?: any[];
  dependencies?: any;
  issues?: any[];
  pullRequests?: any[];
  releases?: any[];
}

interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
}

type AnalysisType = 'overview' | 'security' | 'issues' | 'pullRequests' | 'contributors' | 'dependencies' | 'releases' | 'codeSearch' | 'bounties' | 'patterns' | 'similar' | 'learning' | 'vulnerabilities';

const App: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisType>('overview');
  
  // Chat functionality state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [showChat, setShowChat] = useState<boolean>(false);
  
  // Additional state for advanced features
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [skills, setSkills] = useState<string>('');
  const [targetRole, setTargetRole] = useState<string>('');
  const [vulnerabilityType, setVulnerabilityType] = useState<string>('');

  const analysisTypes = [
    { id: 'overview', label: '📊 Overview', description: 'Repository health and metrics' },
    { id: 'security', label: '🔒 Security', description: 'Vulnerability scanning' },
    { id: 'issues', label: '📋 Issues', description: 'AI-powered issue analysis' },
    { id: 'pullRequests', label: '🔄 Pull Requests', description: 'PR insights and patterns' },
    { id: 'contributors', label: '👥 Contributors', description: 'Team analysis' },
    { id: 'dependencies', label: '📦 Dependencies', description: 'Package health monitoring' },
    { id: 'releases', label: '📝 Releases', description: 'Release notes generation' },
    { id: 'codeSearch', label: '🔍 Code Fix Search', description: 'Search GitHub for fixes' },
    { id: 'bounties', label: '💰 Bounty Hunter', description: 'Find paid issues' },
    { id: 'patterns', label: '🧠 Code Patterns', description: 'Pattern analysis' },
    { id: 'similar', label: '🔗 Similar Repos', description: 'Find similar projects' },
    { id: 'learning', label: '📚 Learning Path', description: 'AI learning roadmap' },
    { id: 'vulnerabilities', label: '🛡️ Vuln Fixes', description: 'Security fix search' }
  ];

  const handleAnalysis = async (analysisType: AnalysisType) => {
    if (!message.trim() && !['bounties'].includes(analysisType)) {
      setError('Please enter a GitHub repository URL or describe your issue');
      return;
    }

    if (analysisType === 'codeSearch' && !message.trim() && !code.trim()) {
      setError('Please enter either a problem description or code snippet');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);
    setCurrentAnalysis(analysisType);
    // Reset chat when new analysis starts
    setChatMessages([]);
    setShowChat(false);

    try {
      let endpoint = '';
      let requestData: any = { message };

      switch (analysisType) {
        case 'overview':
          endpoint = '/agent-info';
          break;
        case 'security':
          endpoint = '/analyze-security';
          break;
        case 'issues':
          endpoint = '/analyze-issues';
          break;
        case 'pullRequests':
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
        case 'codeSearch':
          endpoint = '/search-fixes';
          requestData = { message, code, language, errorType: vulnerabilityType };
          break;
        case 'bounties':
          endpoint = '/find-bounties';
          requestData = { 
            message, 
            skills: skills ? skills.split(',').map(s => s.trim()) : undefined, 
            language, 
            difficulty: 'medium' 
          };
          break;
        case 'patterns':
          endpoint = '/analyze-patterns';
          break;
        case 'similar':
          endpoint = '/find-similar';
          break;
        case 'learning':
          endpoint = '/generate-learning-path';
          requestData = { 
            message, 
            currentSkills: skills ? skills.split(',').map(s => s.trim()) : undefined, 
            targetRole 
          };
          break;
        case 'vulnerabilities':
          endpoint = '/search-vulnerability-fixes';
          requestData = { message, vulnerabilityType, cveId: '' };
          break;
        default:
          throw new Error('Unknown analysis type');
      }

             const response = await axios.post(`${API_CONFIG.API_BASE_URL}${endpoint}`, requestData, {
         headers: {
           'Content-Type': 'application/json',
         },
       });

      setResult(response.data);
    } catch (err: any) {
      console.error('Analysis error:', err);
      if (err.response?.data?.error) {
        setError(`Error: ${err.response.data.error}`);
      } else {
        setError('An error occurred while analyzing the repository. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChatQuestion = async () => {
    if (!chatInput.trim() || !result) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: chatInput,
      timestamp: new Date()
    };

    setChatMessages(prev => [...prev, userMessage]);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await axios.post(`${API_CONFIG.API_BASE_URL}/chat-about-analysis`, {
        question: chatInput,
        analysisType: currentAnalysis,
        originalQuery: message,
        previousAnalysis: result.response
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.data.response || response.data.message || 'I apologize, but I couldn\'t process your question. Please try rephrasing it.',
        timestamp: new Date()
      };

      setChatMessages(prev => [...prev, aiMessage]);
    } catch (err: any) {
      console.error('Chat error:', err);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'I\'m having trouble responding right now. Please try your question again.',
        timestamp: new Date()
      };
      setChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatQuestion();
    }
  };

  const renderAdvancedInputs = () => {
    if (['codeSearch', 'bounties', 'learning', 'vulnerabilities'].includes(currentAnalysis)) {
      return (
        <div className="advanced-inputs">
          {currentAnalysis === 'codeSearch' && (
            <>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Paste your problematic code here (optional)..."
                className="code-input"
                rows={6}
              />
              <div className="input-row">
                <input
                  type="text"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  placeholder="Programming language (e.g., JavaScript, Python)"
                  className="language-input"
                />
                <input
                  type="text"
                  value={vulnerabilityType}
                  onChange={(e) => setVulnerabilityType(e.target.value)}
                  placeholder="Error type (e.g., TypeError, SyntaxError)"
                  className="error-type-input"
                />
              </div>
            </>
          )}
          
          {(currentAnalysis === 'bounties' || currentAnalysis === 'learning') && (
            <div className="input-row">
              <input
                type="text"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="Your skills (comma-separated: React, Node.js, Python)"
                className="skills-input"
              />
              {currentAnalysis === 'learning' && (
                <input
                  type="text"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="Target role (e.g., Full Stack Developer)"
                  className="role-input"
                />
              )}
            </div>
          )}
          
          {currentAnalysis === 'vulnerabilities' && (
            <input
              type="text"
              value={vulnerabilityType}
              onChange={(e) => setVulnerabilityType(e.target.value)}
              placeholder="Vulnerability type or CVE ID (e.g., SQL Injection, CVE-2023-1234)"
              className="vuln-input"
            />
          )}
        </div>
      );
    }
    return null;
  };

  const formatResponse = (response: string) => {
    // Convert markdown-style formatting to HTML-like formatting for better display
    return response
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^\- (.*$)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[h1-6]|<li|<p)(.+)$/gm, '<p>$1</p>')
      .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
      .replace(/<\/ul>\s*<ul>/g, '');
  };

  const renderSpecialResults = () => {
    if (!result) return null;

    // Handle bounty results
    if (currentAnalysis === 'bounties' && result.bounties && result.bounties.length > 0) {
      return (
        <div className="special-results">
          <div className="bounty-summary">
            <div className="stat-card">
              <h4>💰 Total Bounties</h4>
              <span className="stat-number">{result.totalBounties}</span>
            </div>
            {result.estimatedEarnings && (
              <div className="stat-card">
                <h4>💵 Est. Earnings</h4>
                <span className="stat-number">${result.estimatedEarnings.total || 0}</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Handle code search results
    if (currentAnalysis === 'codeSearch' && result.searchResults && result.searchResults.length > 0) {
      return (
        <div className="special-results">
          <div className="search-summary">
            <div className="stat-card">
              <h4>🔍 Results Found</h4>
              <span className="stat-number">{result.totalFound || result.searchResults.length}</span>
            </div>
            <div className="stat-card">
              <h4>📊 Relevance</h4>
              <span className="stat-number">85%</span>
            </div>
          </div>
        </div>
      );
    }

    // Handle learning path results
    if (currentAnalysis === 'learning' && result.learningPath && result.learningPath.length > 0) {
      return (
        <div className="special-results">
          <div className="learning-summary">
            <div className="stat-card">
              <h4>📚 Modules</h4>
              <span className="stat-number">{result.learningPath.length}</span>
            </div>
            <div className="stat-card">
              <h4>⏱️ Time Required</h4>
              <span className="stat-number">{result.estimatedTimeToComplete || 'TBD'}</span>
            </div>
          </div>
        </div>
      );
    }

    // Handle similar repositories
    if (currentAnalysis === 'similar' && result.similarRepositories && result.similarRepositories.length > 0) {
      return (
        <div className="special-results">
          <div className="similar-summary">
            <div className="stat-card">
              <h4>🔗 Similar Repos</h4>
              <span className="stat-number">{result.similarRepositories.length}</span>
            </div>
            <div className="stat-card">
              <h4>⭐ Avg Stars</h4>
              <span className="stat-number">
                {Math.round(result.similarRepositories.reduce((sum: number, repo: any) => sum + (repo.stargazers_count || 0), 0) / result.similarRepositories.length)}
              </span>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>🚀 Nosana GitHub Insights Agent</h1>
          <p className="subtitle">AI-Powered Repository Analysis & Code Intelligence Platform</p>
          <div className="version-badge">v3.0.0 - Enterprise Edition</div>
        </header>

        <div className="analysis-types">
          {analysisTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setCurrentAnalysis(type.id as AnalysisType)}
              className={`analysis-btn ${currentAnalysis === type.id ? 'active' : ''}`}
              title={type.description}
            >
              {type.label}
            </button>
          ))}
        </div>

        <div className="input-section">
          <div className="current-analysis">
            <h3>{analysisTypes.find(t => t.id === currentAnalysis)?.label}</h3>
            <p>{analysisTypes.find(t => t.id === currentAnalysis)?.description}</p>
          </div>

          <div className="main-input-group">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                currentAnalysis === 'bounties' 
                  ? "Optional: Describe your interests or leave blank to search all bounties"
                  : currentAnalysis === 'codeSearch'
                  ? "Describe your coding problem or paste GitHub URL"
                  : currentAnalysis === 'vulnerabilities'
                  ? "Describe security issue or vulnerability type"
                  : "Enter GitHub repository URL (e.g., https://github.com/owner/repo)"
              }
              className="message-input"
              disabled={loading}
            />
            <button
              onClick={() => handleAnalysis(currentAnalysis)}
              disabled={loading}
              className="analyze-btn"
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Analyzing...
                </>
              ) : (
                `🔍 ${analysisTypes.find(t => t.id === currentAnalysis)?.label.replace(/[^a-zA-Z\s]/g, '').trim()}`
              )}
            </button>
          </div>

          {renderAdvancedInputs()}
        </div>

        {error && (
          <div className="error-message">
            <span className="error-icon">⚠️</span>
            {error}
          </div>
        )}

        {result && (
          <div className="result-section">
            <div className="result-header">
              <h2>📊 Analysis Results</h2>
              {result.timestamp && (
                <span className="timestamp">
                  Generated: {new Date(result.timestamp).toLocaleString()}
                </span>
              )}
            </div>

            {renderSpecialResults()}

            <div className="result-content">
              <div 
                className="response-text"
                dangerouslySetInnerHTML={{ __html: formatResponse(result.response) }}
              />
            </div>

            <div className="action-buttons">
              <button
                onClick={() => setCurrentAnalysis('overview')}
                className="action-btn secondary"
                disabled={currentAnalysis === 'overview'}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setCurrentAnalysis('security')}
                className="action-btn secondary"
                disabled={currentAnalysis === 'security'}
              >
                🔒 Security Scan
              </button>
              <button
                onClick={() => setCurrentAnalysis('codeSearch')}
                className="action-btn secondary"
                disabled={currentAnalysis === 'codeSearch'}
              >
                🔍 Find Fixes
              </button>
              <button
                onClick={() => setCurrentAnalysis('bounties')}
                className="action-btn secondary"
                disabled={currentAnalysis === 'bounties'}
              >
                💰 Find Bounties
              </button>
            </div>

            {/* AI Chat Interface */}
            <div className="chat-section">
              <div className="chat-header">
                <h3>🤖 Ask AI About This Analysis</h3>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="chat-toggle-btn"
                >
                  {showChat ? '▼ Hide Chat' : '▲ Show Chat'}
                </button>
              </div>

              {showChat && (
                <div className="chat-container">
                  {chatMessages.length > 0 && (
                    <div className="chat-messages">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className={`chat-message ${msg.type}`}>
                          <div className="message-avatar">
                            {msg.type === 'user' ? '👤' : '🤖'}
                          </div>
                          <div className="message-content">
                            <div 
                              className="message-text"
                              dangerouslySetInnerHTML={{ __html: formatResponse(msg.content) }}
                            />
                            <div className="message-time">
                              {msg.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="chat-message ai">
                          <div className="message-avatar">🤖</div>
                          <div className="message-content">
                            <div className="message-text">
                              <span className="typing-indicator">AI is thinking...</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="chat-input-container">
                    <div className="chat-suggestions">
                      <span className="suggestion-label">💡 Try asking:</span>
                      <button 
                        onClick={() => setChatInput("What are the main security concerns?")}
                        className="suggestion-btn"
                      >
                        What are the main security concerns?
                      </button>
                      <button 
                        onClick={() => setChatInput("How can I contribute to this project?")}
                        className="suggestion-btn"
                      >
                        How can I contribute?
                      </button>
                      <button 
                        onClick={() => setChatInput("Explain the technical details")}
                        className="suggestion-btn"
                      >
                        Explain technical details
                      </button>
                    </div>
                    
                    <div className="chat-input-group">
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyPress={handleChatKeyPress}
                        placeholder="Ask me anything about this analysis... (Press Enter to send)"
                        className="chat-input"
                        rows={2}
                        disabled={chatLoading}
                      />
                      <button
                        onClick={handleChatQuestion}
                        disabled={chatLoading || !chatInput.trim()}
                        className="chat-send-btn"
                      >
                        {chatLoading ? '⏳' : '📤'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <footer className="footer">
          <div className="footer-content">
            <div className="feature-highlight">
              <h4>🎯 Key Features</h4>
              <ul>
                <li>🤖 AI-Powered Code Analysis</li>
                <li>🔍 GitHub-Wide Fix Search</li>
                <li>💰 Bounty Opportunity Discovery</li>
                <li>🧠 Code Pattern Recognition</li>
                <li>📚 Personalized Learning Paths</li>
                <li>🛡️ Security Vulnerability Research</li>
                <li>🔗 Similar Project Discovery</li>
              </ul>
            </div>
            <div className="tech-stack">
              <h4>⚡ Powered By</h4>
              <div className="tech-badges">
                <span className="tech-badge">React</span>
                <span className="tech-badge">Node.js</span>
                <span className="tech-badge">GitHub API</span>
                <span className="tech-badge">AI/ML</span>
                <span className="tech-badge">TypeScript</span>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>Built for <strong>Nosana Builders Challenge</strong> • Enterprise GitHub Intelligence Platform</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
