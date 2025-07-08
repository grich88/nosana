import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { SecurityAnalyzer } from './security/SecurityAnalyzer.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize security analyzer
const securityAnalyzer = new SecurityAnalyzer();

// Middleware
app.use(cors());
app.use(express.json());

// GitHub API function
async function getGitHubRepoInfo(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Repository ${owner}/${repo} not found. Please check the owner and repository name.`);
    } else if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Please try again later or add a GitHub token.');
    } else {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
  }
  
  return await response.json();
}

// Security analysis endpoint
app.post('/security', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information. Please provide in format: owner/repo or GitHub URL' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Perform security analysis
    const securityAnalysis = await securityAnalyzer.analyzeRepository(owner, repo);
    
    // Format the security response
    const response = formatSecurityAnalysis(owner, repo, securityAnalysis);
    
    res.json({
      response,
      securityDetails: securityAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Security analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Function to analyze repository health
function analyzeRepositoryHealth(data: any): { status: string; score: number; factors: string[] } {
  const factors: string[] = [];
  let score = 5; // Base score
  
  // Check if archived
  if (data.archived) {
    return {
      status: 'ARCHIVED',
      score: 1,
      factors: ['Repository is explicitly archived'],
    };
  }
  
  // Analyze last activity
  const daysSinceLastPush = Math.floor(
    (Date.now() - new Date(data.pushed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceLastPush <= 7) {
    score += 2;
    factors.push('Very recent activity (within a week)');
  } else if (daysSinceLastPush <= 30) {
    score += 1;
    factors.push('Recent activity (within a month)');
  } else if (daysSinceLastPush <= 90) {
    factors.push('Moderate activity (within 3 months)');
  } else if (daysSinceLastPush <= 180) {
    score -= 1;
    factors.push('Low activity (3-6 months)');
  } else {
    score -= 2;
    factors.push(`Stale (${Math.floor(daysSinceLastPush / 30)} months since last push)`);
  }
  
  // Analyze popularity
  if (data.stargazers_count >= 10000) {
    score += 2;
    factors.push(`Highly popular (${formatNumber(data.stargazers_count)} stars)`);
  } else if (data.stargazers_count >= 1000) {
    score += 1;
    factors.push(`Popular (${formatNumber(data.stargazers_count)} stars)`);
  } else if (data.stargazers_count >= 100) {
    factors.push(`Moderately popular (${data.stargazers_count} stars)`);
  }
  
  // Analyze issue management
  const issueRatio = data.open_issues_count / Math.max(data.stargazers_count, 1);
  if (issueRatio < 0.05) {
    score += 1;
    factors.push('Well-managed issues (low issue-to-star ratio)');
  } else if (issueRatio > 0.15) {
    score -= 1;
    factors.push('High number of open issues relative to popularity');
  }
  
  // Analyze community engagement
  if (data.forks_count > data.stargazers_count * 0.1) {
    score += 1;
    factors.push('High fork-to-star ratio indicates active development');
  }
  
  // Determine status based on score
  let status: string;
  if (score >= 8) status = 'EXCELLENT';
  else if (score >= 6) status = 'ACTIVE & WELL-MAINTAINED';
  else if (score >= 4) status = 'STABLE';
  else if (score >= 2) status = 'STALE';
  else status = 'INACTIVE';
  
  return {
    status,
    score: Math.max(1, Math.min(10, score)),
    factors,
  };
}

// Helper function to format numbers
function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + 'B';
  }
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// Helper function to get time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
}

// Function to parse repository from message
function parseRepositoryFromMessage(message: string): { owner: string; repo: string } | null {
  // Check for GitHub URL
  const urlMatch = message.match(/github\.com\/([^\/]+)\/([^\/\s]+)/i);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }
  
  // Check for owner/repo format
  const ownerRepoMatch = message.match(/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (ownerRepoMatch) {
    return { owner: ownerRepoMatch[1], repo: ownerRepoMatch[2] };
  }
  
  // Check for common phrases with repository names
  const statsMatch = message.match(/(?:stats|info|analyze|analysis|insights).*?(?:for|of|about)\s+([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
  if (statsMatch) {
    const [owner, repo] = statsMatch[1].split('/');
    return { owner, repo };
  }
  
  return null;
}

// Function to format security analysis
function formatSecurityAnalysis(owner: string, repo: string, analysis: any): string {
  let response = `🔒 **Security Analysis: ${repo} (${owner}/${repo})**\n\n`;
  
  // Security Score and Risk Level
  response += `🛡️ **Security Score: ${analysis.overallScore}/100**\n`;
  response += `⚠️ **Risk Level: ${analysis.riskLevel}**\n\n`;
  
  // Summary
  response += `📋 **Summary**\n${analysis.summary}\n\n`;
  
  // Security Issues
  if (analysis.codeQuality.length > 0) {
    response += `🚨 **Code Security Issues (${analysis.codeQuality.length})**\n`;
    analysis.codeQuality.slice(0, 5).forEach((issue: any) => {
      response += `- ${issue.severity}: ${issue.description} in ${issue.file}\n`;
      response += `  📝 ${issue.recommendation}\n`;
    });
    if (analysis.codeQuality.length > 5) {
      response += `  ... and ${analysis.codeQuality.length - 5} more issues\n`;
    }
    response += '\n';
  }
  
  // Secrets Detection
  if (analysis.secrets.length > 0) {
    response += `🔑 **Potential Secrets Found (${analysis.secrets.length})**\n`;
    analysis.secrets.slice(0, 3).forEach((secret: any) => {
      response += `- ${secret.type} detected in ${secret.file}\n`;
    });
    if (analysis.secrets.length > 3) {
      response += `  ... and ${analysis.secrets.length - 3} more potential secrets\n`;
    }
    response += '\n';
  }
  
  // License Risks
  if (analysis.licenseRisks.length > 0) {
    response += `⚖️ **License Compliance Risks**\n`;
    analysis.licenseRisks.forEach((risk: any) => {
      response += `- ${risk.license}: ${risk.riskLevel} risk\n`;
      response += `  📄 ${risk.description}\n`;
    });
    response += '\n';
  }
  
  // Recommendations
  if (analysis.recommendations.length > 0) {
    response += `💡 **Security Recommendations**\n`;
    analysis.recommendations.forEach((rec: string) => {
      response += `- ${rec}\n`;
    });
    response += '\n';
  }
  
  // Security Badge
  const badge = getSecurityBadge(analysis.riskLevel);
  response += `${badge}\n`;
  
  return response;
}

// Function to get security badge
function getSecurityBadge(riskLevel: string): string {
  switch (riskLevel) {
    case 'LOW': return '🟢 **SECURE** - Low security risk detected';
    case 'MEDIUM': return '🟡 **CAUTION** - Medium security risk, review recommended';
    case 'HIGH': return '🟠 **WARNING** - High security risk, action required';
    case 'CRITICAL': return '🔴 **CRITICAL** - Severe security risks, immediate action required';
    default: return '⚪ **UNKNOWN** - Security status unknown';
  }
}

// Function to format repository analysis
function formatRepositoryAnalysis(data: any): string {
  const health = analyzeRepositoryHealth(data);
  const lastUpdated = getTimeAgo(data.pushed_at);
  const created = new Date(data.created_at).toLocaleDateString();
  
  let response = `📊 **Repository Overview**\n`;
  response += `- Name: ${data.name}\n`;
  response += `- Full Name: ${data.full_name}\n`;
  if (data.description) response += `- Description: ${data.description}\n`;
  if (data.language) response += `- Language: ${data.language}\n`;
  response += `- Created: ${created} | Last Updated: ${lastUpdated}\n\n`;
  
  response += `📈 **Key Metrics**\n`;
  response += `- ⭐ Stars: ${formatNumber(data.stargazers_count)}\n`;
  response += `- 🍴 Forks: ${formatNumber(data.forks_count)}\n`;
  response += `- 🐛 Open Issues: ${formatNumber(data.open_issues_count)}\n`;
  response += `- 👀 Watchers: ${formatNumber(data.watchers_count)}\n`;
  if (data.license?.name) response += `- 📄 License: ${data.license.name}\n`;
  response += '\n';
  
  response += `🏥 **Health Assessment: ${health.status}**\n`;
  response += `Health Score: ${health.score}/10\n\n`;
  response += `Key factors:\n`;
  health.factors.forEach(factor => {
    response += `- ${factor}\n`;
  });
  response += '\n';
  
  // Add insights
  response += `💡 **Insights & Recommendations**\n`;
  if (data.stargazers_count >= 1000 && data.forks_count >= 100) {
    response += `- Strong community adoption - likely a reliable choice\n`;
  }
  if (data.language) {
    response += `- Written in ${data.language} - ensure it fits your tech stack\n`;
  }
  if (data.license?.name) {
    response += `- Licensed under ${data.license.name} - verify compatibility with your project\n`;
  } else {
    response += `- No license specified - check usage rights before adoption\n`;
  }
  
  const daysSinceLastPush = Math.floor(
    (Date.now() - new Date(data.pushed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceLastPush <= 7) {
    response += `- Very active project with recent commits - great for staying current\n`;
  } else if (daysSinceLastPush > 180) {
    response += `- Consider checking if the project is still maintained before depending on it\n`;
  }
  
  if (data.topics && data.topics.length > 0) {
    response += `\n🏷️ **Topics**: ${data.topics.join(', ')}\n`;
  }
  
  return response;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'nosana-github-insights-agent',
    timestamp: new Date().toISOString()
  });
});

// Main agent endpoint
app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const repoInfo = parseRepositoryFromMessage(message);
    
    if (!repoInfo) {
      return res.json({
        response: `I can help you analyze GitHub repositories! Please provide a repository in one of these formats:
        
- GitHub URL: https://github.com/owner/repo
- Owner/Repo format: microsoft/vscode
- Natural language: "Show me stats for facebook/react"

Examples:
- "Analyze microsoft/vscode"
- "What's the health of facebook/react?"
- "Show me insights for https://github.com/vercel/next.js"`,
        timestamp: new Date().toISOString()
      });
    }

    // Check if security analysis is requested
    const isSecurityRequest = /security|secure|vulnerability|vulnerabilities|safety|safe|hack|threat|risk/i.test(message);
    
    const data = await getGitHubRepoInfo(repoInfo.owner, repoInfo.repo);
    let analysis = formatRepositoryAnalysis(data);
    let securityDetails = null;
    
    if (isSecurityRequest) {
      // Perform security analysis
      const securityAnalysis = await securityAnalyzer.analyzeRepository(repoInfo.owner, repoInfo.repo);
      securityDetails = securityAnalysis;
      
      // Append security analysis to response
      analysis += '\n\n' + formatSecurityAnalysis(repoInfo.owner, repoInfo.repo, securityAnalysis);
    }
    
    res.json({ 
      response: analysis,
      securityDetails,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error processing request:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Agent info endpoint
app.get('/agent-info', (req, res) => {
  res.json({
    name: 'GitHub Insights Agent',
    description: 'AI agent that provides comprehensive GitHub repository insights with health and security assessments',
    capabilities: [
      'Fetch repository statistics (stars, forks, issues)',
      'Analyze repository health and activity',
      'Security vulnerability scanning',
      'Code quality and safety analysis',
      'License compliance checking',
      'Hardcoded secrets detection',
      'Provide development insights and recommendations',
      'Support for any public GitHub repository'
    ],
    usage: 'Send a POST request to /chat with a message like "Show me stats for facebook/react" or use /security endpoint for detailed security analysis',
    endpoints: [
      'GET /health - Service health check',
      'GET /agent-info - Agent capabilities',
      'POST /chat - Repository analysis with security',
      'POST /security - Detailed security analysis'
    ],
    examples: [
      'Show me stats for microsoft/vscode',
      'Analyze facebook/react',
      'Security scan for torvalds/linux',
      'What is the health of https://github.com/vercel/next.js'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Nosana GitHub Insights Agent running on port ${PORT}`);
  console.log(`📊 Try: curl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -d '{"message":"Show me stats for microsoft/vscode"}'`);
}); 