import express, { Request, Response } from 'express';
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
app.post('/security', async (req: Request, res: Response) => {
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
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'healthy', 
    service: 'nosana-github-insights-agent',
    timestamp: new Date().toISOString()
  });
});

// Main agent endpoint
app.post('/chat', async (req: Request, res: Response) => {
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
app.get('/agent-info', (req: Request, res: Response) => {
  res.json({
    name: 'GitHub Insights Agent',
    version: '2.0.0',
    description: 'Advanced AI agent providing comprehensive GitHub repository analysis with intelligent insights, automated fixes, and actionable recommendations',
    capabilities: [
      '📊 Repository health scoring and analysis',
      '🔒 Comprehensive security vulnerability scanning',
      '📋 Open issues analysis with AI-powered fix suggestions',
      '🔄 Pull request insights and merge pattern analysis',
      '👥 Contributor analysis and team dynamics insights',
      '📦 Dependency health monitoring and update recommendations',
      '📝 Automated release notes generation',
      '🛡️ Code quality assessment and best practices',
      '💡 AI-generated actionable recommendations',
      '🌐 Support for any public GitHub repository'
    ],
    features: {
      overview: {
        description: 'Repository health & metrics analysis',
        includes: ['Health scoring (1-10)', 'Key metrics', 'Activity patterns', 'Community insights']
      },
      security: {
        description: 'Vulnerability scanning & security assessment',
        includes: ['Code vulnerability detection', 'Dependency analysis', 'Secret scanning', 'License compliance']
      },
      issues: {
        description: 'Open issues analysis with AI fixes',
        includes: ['Issue categorization', 'Priority analysis', 'AI fix suggestions', 'Maintenance insights']
      },
      pullRequests: {
        description: 'PR insights & merge patterns',
        includes: ['Merge rate analysis', 'Review patterns', 'Performance metrics', 'Team efficiency']
      },
      contributors: {
        description: 'Team analysis & contributor patterns',
        includes: ['Contribution distribution', 'Activity patterns', 'Team dynamics', 'Bus factor analysis']
      },
      dependencies: {
        description: 'Package health & update monitoring',
        includes: ['Outdated packages', 'Security updates', 'Dependency analysis', 'Health recommendations']
      },
      releases: {
        description: 'Release notes & versioning insights',
        includes: ['Release frequency', 'Change analysis', 'Version recommendations', 'Automated notes']
      }
    },
    usage: {
      basic: 'Send a POST request to /chat with a repository identifier',
      advanced: 'Use specific endpoints for detailed analysis types',
      formats: [
        'owner/repo (e.g., microsoft/vscode)',
        'GitHub URLs (e.g., https://github.com/facebook/react)',
        'Natural language (e.g., "Analyze security for tensorflow/tensorflow")'
      ]
    },
    endpoints: [
      {
        method: 'GET',
        path: '/health',
        description: 'Service health check'
      },
      {
        method: 'GET',
        path: '/agent-info',
        description: 'Agent capabilities and documentation'
      },
      {
        method: 'POST',
        path: '/chat',
        description: 'General repository analysis with intelligent routing'
      },
      {
        method: 'POST',
        path: '/security',
        description: 'Detailed security vulnerability analysis'
      },
      {
        method: 'POST',
        path: '/analyze-issues',
        description: 'Open issues analysis with AI fix recommendations'
      },
      {
        method: 'POST',
        path: '/analyze-prs',
        description: 'Pull request insights and merge pattern analysis'
      },
      {
        method: 'POST',
        path: '/analyze-contributors',
        description: 'Contributor analysis and team dynamics'
      },
      {
        method: 'POST',
        path: '/analyze-dependencies',
        description: 'Dependency health and update recommendations'
      },
      {
        method: 'POST',
        path: '/generate-release-notes',
        description: 'AI-generated release notes and versioning insights'
      }
    ],
    examples: [
      {
        type: 'Overview Analysis',
        query: 'microsoft/vscode',
        description: 'Get comprehensive repository health and metrics'
      },
      {
        type: 'Security Scan',
        query: 'facebook/react',
        description: 'Perform detailed security vulnerability analysis'
      },
      {
        type: 'Issues Analysis',
        query: 'nodejs/node',
        description: 'Analyze open issues with AI fix suggestions'
      },
      {
        type: 'Team Insights',
        query: 'tensorflow/tensorflow',
        description: 'Get contributor patterns and team dynamics'
      },
      {
        type: 'Release Planning',
        query: 'vercel/next.js',
        description: 'Generate release notes and versioning insights'
      }
    ],
    aiFeatures: [
      'Intelligent issue categorization and priority analysis',
      'AI-powered fix suggestions for common problems',
      'Security vulnerability pattern recognition',
      'Code quality assessment with recommendations',
      'Team collaboration pattern analysis',
      'Automated release note generation from commits',
      'Smart dependency update recommendations',
      'Project health scoring with actionable insights'
    ]
  });
});

// Open Issues Analysis endpoint
app.post('/analyze-issues', async (req: Request, res: Response) => {
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
    
    // Get open issues
    const issues = await getOpenIssues(owner, repo);
    const analysis = await analyzeIssuesWithAI(issues, owner, repo);
    
    res.json({
      response: analysis,
      issues: issues,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Issues analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Pull Request Insights endpoint
app.post('/analyze-prs', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Get recent pull requests
    const prs = await getRecentPullRequests(owner, repo);
    const analysis = await analyzePullRequestsWithAI(prs, owner, repo);
    
    res.json({
      response: analysis,
      pullRequests: prs,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('PR analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Contributors Analysis endpoint
app.post('/analyze-contributors', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Get contributors data
    const contributors = await getContributors(owner, repo);
    const commits = await getRecentCommits(owner, repo);
    const analysis = await analyzeContributorsWithAI(contributors, commits, owner, repo);
    
    res.json({
      response: analysis,
      contributors: contributors,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Contributors analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Dependency Health endpoint
app.post('/analyze-dependencies', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Analyze dependencies
    const depAnalysis = await analyzeDependencyHealth(owner, repo);
    
    res.json({
      response: depAnalysis.summary,
      dependencies: depAnalysis.details,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Dependency analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Release Notes Generator endpoint
app.post('/generate-release-notes', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Generate release notes from recent commits
    const releases = await getRecentReleases(owner, repo);
    const commits = await getRecentCommits(owner, repo);
    const releaseNotes = await generateReleaseNotesWithAI(releases, commits, owner, repo);
    
    res.json({
      response: releaseNotes,
      releases: releases,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Release notes generation error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Helper functions for enhanced GitHub insights

// Get open issues from repository
async function getOpenIssues(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=20`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Failed to fetch issues for ${owner}/${repo}: ${response.status}`);
      return [];
    }
    const issues = await response.json() as any[];
    // Filter out pull requests (GitHub API includes PRs in issues)
    return issues.filter(issue => !issue.pull_request);
  } catch (error) {
    console.error('Error fetching issues:', error);
    return [];
  }
}

// AI-powered issue analysis
async function analyzeIssuesWithAI(issues: any[], owner: string, repo: string): Promise<string> {
  if (issues.length === 0) {
    return `📋 **Open Issues Analysis for ${owner}/${repo}**\n\n🎉 **Great news!** This repository has no open issues.\n\nThis indicates excellent maintenance and issue management. The project appears to be well-maintained with prompt issue resolution.`;
  }

  let analysis = `📋 **Open Issues Analysis for ${owner}/${repo}**\n\n`;
  analysis += `📊 **Summary**: ${issues.length} open issues found\n\n`;

  // Categorize issues
  const bugIssues = issues.filter(issue => 
    issue.labels.some((label: any) => label.name.toLowerCase().includes('bug'))
  );
  const featureRequests = issues.filter(issue => 
    issue.labels.some((label: any) => label.name.toLowerCase().includes('feature') || label.name.toLowerCase().includes('enhancement'))
  );
  const helpWanted = issues.filter(issue => 
    issue.labels.some((label: any) => label.name.toLowerCase().includes('help wanted') || label.name.toLowerCase().includes('good first issue'))
  );

  analysis += `🔍 **Issue Categories**:\n`;
  analysis += `- 🐛 Bugs: ${bugIssues.length}\n`;
  analysis += `- ✨ Feature Requests: ${featureRequests.length}\n`;
  analysis += `- 🤝 Help Wanted: ${helpWanted.length}\n`;
  analysis += `- 📝 Other: ${issues.length - bugIssues.length - featureRequests.length - helpWanted.length}\n\n`;

  // Top issues analysis
  analysis += `🔥 **Top Priority Issues** (Most commented/reacted):\n`;
  const sortedIssues = issues
    .sort((a, b) => (b.comments + (b.reactions?.total_count || 0)) - (a.comments + (a.reactions?.total_count || 0)))
    .slice(0, 5);

  sortedIssues.forEach((issue, index) => {
    const ageInDays = Math.floor((Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24));
    analysis += `${index + 1}. **${issue.title}** (#${issue.number})\n`;
    analysis += `   - Age: ${ageInDays} days | Comments: ${issue.comments} | Reactions: ${issue.reactions?.total_count || 0}\n`;
    analysis += `   - 💡 **AI Suggestion**: `;
    
    if (issue.labels.some((l: any) => l.name.toLowerCase().includes('bug'))) {
      analysis += `This bug issue needs debugging. Check error logs, add reproduction steps, and assign to maintainers.\n`;
    } else if (issue.labels.some((l: any) => l.name.toLowerCase().includes('feature'))) {
      analysis += `Feature request with community interest. Consider roadmap prioritization and design discussion.\n`;
    } else if (issue.comments === 0) {
      analysis += `No responses yet. Needs initial triage and labeling by maintainers.\n`;
    } else {
      analysis += `Active discussion. Review latest comments for resolution progress.\n`;
    }
    analysis += '\n';
  });

  // AI recommendations
  analysis += `💡 **AI Recommendations**:\n`;
  if (bugIssues.length > issues.length * 0.4) {
    analysis += `- ⚠️ High bug ratio detected. Consider improving testing and QA processes.\n`;
  }
  if (helpWanted.length > 0) {
    analysis += `- 🤝 ${helpWanted.length} issues marked for community help. Great for new contributors!\n`;
  }
  if (issues.some(issue => (Date.now() - new Date(issue.created_at).getTime()) / (1000 * 60 * 60 * 24) > 90)) {
    analysis += `- 📅 Some issues are over 90 days old. Consider closing stale issues or updating status.\n`;
  }
  analysis += `- 🎯 Focus on the top commented issues for maximum community impact.\n`;

  return analysis;
}

// Get recent pull requests
async function getRecentPullRequests(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=20&sort=updated`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Failed to fetch PRs for ${owner}/${repo}: ${response.status}`);
      return [];
    }
    return await response.json() as any[];
  } catch (error) {
    console.error('Error fetching pull requests:', error);
    return [];
  }
}

// AI-powered PR analysis
async function analyzePullRequestsWithAI(prs: any[], owner: string, repo: string): Promise<string> {
  if (prs.length === 0) {
    return `🔄 **Pull Request Analysis for ${owner}/${repo}**\n\n📭 No recent pull requests found.\n\nThis could indicate low activity or that the project is stable with infrequent updates.`;
  }

  let analysis = `🔄 **Pull Request Analysis for ${owner}/${repo}**\n\n`;
  analysis += `📊 **Summary**: ${prs.length} recent pull requests\n\n`;

  const openPRs = prs.filter(pr => pr.state === 'open');
  const mergedPRs = prs.filter(pr => pr.merged_at);
  const closedPRs = prs.filter(pr => pr.state === 'closed' && !pr.merged_at);

  analysis += `📈 **PR Status Breakdown**:\n`;
  analysis += `- 🟢 Open: ${openPRs.length}\n`;
  analysis += `- ✅ Merged: ${mergedPRs.length}\n`;
  analysis += `- ❌ Closed: ${closedPRs.length}\n\n`;

  // Merge rate analysis
  const mergeRate = prs.length > 0 ? (mergedPRs.length / prs.length * 100).toFixed(1) : '0';
  analysis += `🎯 **Merge Rate**: ${mergeRate}% (${mergedPRs.length}/${prs.length})\n\n`;

  // Recent activity
  if (openPRs.length > 0) {
    analysis += `🔥 **Active Pull Requests**:\n`;
    openPRs.slice(0, 5).forEach((pr, index) => {
      const ageInDays = Math.floor((Date.now() - new Date(pr.created_at).getTime()) / (1000 * 60 * 60 * 24));
      analysis += `${index + 1}. **${pr.title}** (#${pr.number})\n`;
      analysis += `   - Author: ${pr.user.login} | Age: ${ageInDays} days\n`;
      analysis += `   - Changes: +${pr.additions || 0}/-${pr.deletions || 0} lines\n\n`;
    });
  }

  // AI insights
  analysis += `💡 **AI Insights**:\n`;
  if (openPRs.length > 10) {
    analysis += `- ⚠️ High number of open PRs. Consider reviewing backlog and prioritizing merges.\n`;
  }
  if (parseFloat(mergeRate) > 80) {
    analysis += `- ✅ Excellent merge rate! Shows good code review process and contributor quality.\n`;
  } else if (parseFloat(mergeRate) < 50) {
    analysis += `- 🔍 Lower merge rate detected. Review PR criteria and contributor guidelines.\n`;
  }
  
  const avgResponseTime = mergedPRs.length > 0 ? 
    mergedPRs.reduce((sum, pr) => {
      const timeToMerge = new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime();
      return sum + (timeToMerge / (1000 * 60 * 60 * 24)); // days
    }, 0) / mergedPRs.length : 0;
  
  if (avgResponseTime > 0) {
    analysis += `- ⏱️ Average merge time: ${avgResponseTime.toFixed(1)} days\n`;
  }

  return analysis;
}

// Get repository contributors
async function getContributors(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=30`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Failed to fetch contributors for ${owner}/${repo}: ${response.status}`);
      return [];
    }
    return await response.json() as any[];
  } catch (error) {
    console.error('Error fetching contributors:', error);
    return [];
  }
}

// Get recent commits
async function getRecentCommits(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/commits?per_page=50`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Failed to fetch commits for ${owner}/${repo}: ${response.status}`);
      return [];
    }
    return await response.json() as any[];
  } catch (error) {
    console.error('Error fetching commits:', error);
    return [];
  }
}

// AI-powered contributor analysis
async function analyzeContributorsWithAI(contributors: any[], commits: any[], owner: string, repo: string): Promise<string> {
  if (contributors.length === 0) {
    return `👥 **Contributor Analysis for ${owner}/${repo}**\n\n📭 No contributor data available.\n\nThis might be a private repository or there was an issue fetching contributor information.`;
  }

  let analysis = `👥 **Contributor Analysis for ${owner}/${repo}**\n\n`;
  analysis += `📊 **Summary**: ${contributors.length} contributors found\n\n`;

  // Top contributors
  analysis += `🏆 **Top Contributors** (by commits):\n`;
  contributors.slice(0, 10).forEach((contributor, index) => {
    analysis += `${index + 1}. **${contributor.login}** - ${contributor.contributions} commits\n`;
  });
  analysis += '\n';

  // Contribution distribution
  const totalCommits = contributors.reduce((sum, c) => sum + c.contributions, 0);
  const topContributor = contributors[0];
  const topContributorPercentage = ((topContributor.contributions / totalCommits) * 100).toFixed(1);

  analysis += `📈 **Contribution Patterns**:\n`;
  analysis += `- Total commits: ${totalCommits}\n`;
  analysis += `- Top contributor (${topContributor.login}): ${topContributorPercentage}% of commits\n`;
  
  if (parseFloat(topContributorPercentage) > 80) {
    analysis += `- ⚠️ High concentration: Single contributor dominance detected\n`;
  } else if (parseFloat(topContributorPercentage) < 30) {
    analysis += `- ✅ Well distributed: Healthy contributor diversity\n`;
  }

  // Recent activity analysis
  if (commits.length > 0) {
    const recentCommitters = new Set(commits.map(c => c.commit.author.email));
    analysis += `- Active committers (last 50 commits): ${recentCommitters.size}\n`;
    
    const lastWeekCommits = commits.filter(c => 
      (Date.now() - new Date(c.commit.author.date).getTime()) / (1000 * 60 * 60 * 24) <= 7
    );
    analysis += `- Commits in last week: ${lastWeekCommits.length}\n\n`;
  }

  // AI recommendations
  analysis += `💡 **AI Recommendations**:\n`;
  if (contributors.length < 3) {
    analysis += `- 🤝 Low contributor count. Consider improving contributor onboarding and documentation.\n`;
  }
  if (parseFloat(topContributorPercentage) > 70) {
    analysis += `- 🔄 High bus factor risk. Encourage knowledge sharing and mentoring new contributors.\n`;
  }
  if (contributors.length > 20) {
    analysis += `- 🌟 Great contributor community! Consider contributor recognition programs.\n`;
  }
  analysis += `- 📚 Review CONTRIBUTING.md and issue labels to guide new contributors.\n`;

  return analysis;
}

// Analyze dependency health
async function analyzeDependencyHealth(owner: string, repo: string): Promise<{ summary: string; details: any[] }> {
  const packageFiles = ['package.json', 'requirements.txt', 'pom.xml', 'Cargo.toml', 'go.mod'];
  let summary = `📦 **Dependency Health Analysis for ${owner}/${repo}**\n\n`;
  const details: any[] = [];

  try {
    for (const file of packageFiles) {
      const content = await getFileContentFromRepo(owner, repo, file);
      if (content) {
        const analysis = analyzeDependencyFile(content, file);
        if (analysis) {
          details.push(analysis);
          summary += `📄 **${file}** found - ${analysis.summary}\n`;
        }
      }
    }

    if (details.length === 0) {
      summary += `🔍 No common dependency files found (package.json, requirements.txt, etc.)\n\n`;
      summary += `💡 **Recommendations**:\n`;
      summary += `- Check if this is a compiled language or uses different dependency management\n`;
      summary += `- Review project structure for dependency configuration files\n`;
    } else {
      summary += `\n💡 **AI Security Recommendations**:\n`;
      summary += `- 🔄 Regularly update dependencies to patch security vulnerabilities\n`;
      summary += `- 🛡️ Use dependency scanning tools like Dependabot or Snyk\n`;
      summary += `- 📋 Pin dependency versions for reproducible builds\n`;
      summary += `- 🔍 Audit dependencies for known vulnerabilities\n`;
    }

  } catch (error) {
    console.error('Dependency analysis error:', error);
    summary = `📦 **Dependency Health Analysis**\n\n❌ Error analyzing dependencies: ${error}\n`;
  }

  return { summary, details };
}

// Get recent releases
async function getRecentReleases(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=10`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }
  
  try {
    const response = await fetch(url, { headers });
    if (!response.ok) {
      console.warn(`Failed to fetch releases for ${owner}/${repo}: ${response.status}`);
      return [];
    }
    return await response.json() as any[];
  } catch (error) {
    console.error('Error fetching releases:', error);
    return [];
  }
}

// Generate AI-powered release notes
async function generateReleaseNotesWithAI(releases: any[], commits: any[], owner: string, repo: string): Promise<string> {
  let analysis = `📝 **Release Notes Analysis for ${owner}/${repo}**\n\n`;

  if (releases.length === 0) {
    analysis += `📭 No releases found.\n\n`;
    analysis += `💡 **AI Suggestions for First Release**:\n`;
    
    if (commits.length > 0) {
      analysis += `- 🎯 Current commit count: ${commits.length}\n`;
      analysis += `- 📅 Repository age: ${getTimeAgo(commits[commits.length - 1]?.commit?.author?.date || new Date().toISOString())}\n`;
      
      // Analyze recent commits for release content
      const recentCommits = commits.slice(0, 20);
      const features = recentCommits.filter(c => 
        /feat|feature|add/i.test(c.commit.message)
      );
      const fixes = recentCommits.filter(c => 
        /fix|bug|patch/i.test(c.commit.message)
      );
      
      analysis += `\n🚀 **Suggested v1.0.0 Release Notes** (Based on recent commits):\n\n`;
      
      if (features.length > 0) {
        analysis += `✨ **Features**:\n`;
        features.slice(0, 5).forEach(commit => {
          analysis += `- ${commit.commit.message.split('\n')[0]}\n`;
        });
        analysis += '\n';
      }
      
      if (fixes.length > 0) {
        analysis += `🐛 **Bug Fixes**:\n`;
        fixes.slice(0, 5).forEach(commit => {
          analysis += `- ${commit.commit.message.split('\n')[0]}\n`;
        });
        analysis += '\n';
      }
    }
    
    analysis += `📋 **Release Checklist**:\n`;
    analysis += `- [ ] Update version numbers\n`;
    analysis += `- [ ] Update CHANGELOG.md\n`;
    analysis += `- [ ] Tag the release\n`;
    analysis += `- [ ] Write comprehensive release notes\n`;
    analysis += `- [ ] Test the release\n`;
    
    return analysis;
  }

  // Analyze existing releases
  analysis += `📊 **Release Summary**: ${releases.length} releases found\n\n`;
  
  const latestRelease = releases[0];
  analysis += `🏷️ **Latest Release**: ${latestRelease.tag_name} (${new Date(latestRelease.published_at).toLocaleDateString()})\n`;
  analysis += `📅 Released: ${getTimeAgo(latestRelease.published_at)}\n\n`;

  // Release frequency analysis
  if (releases.length > 1) {
    const releaseInterval = releases.length > 1 ? 
      (new Date(releases[0].published_at).getTime() - new Date(releases[releases.length - 1].published_at).getTime()) / 
      (1000 * 60 * 60 * 24 * (releases.length - 1)) : 0;
    
    analysis += `📈 **Release Frequency**: Every ${releaseInterval.toFixed(0)} days on average\n\n`;
  }

  // Recent releases
  analysis += `📋 **Recent Releases**:\n`;
  releases.slice(0, 5).forEach((release, index) => {
    analysis += `${index + 1}. **${release.tag_name}** - ${new Date(release.published_at).toLocaleDateString()}\n`;
    if (release.body && release.body.length > 0) {
      const shortDescription = release.body.substring(0, 100);
      analysis += `   ${shortDescription}${release.body.length > 100 ? '...' : ''}\n`;
    }
  });

  analysis += `\n💡 **AI Recommendations**:\n`;
  analysis += `- 📝 Maintain consistent release note formatting\n`;
  analysis += `- 🏷️ Use semantic versioning (major.minor.patch)\n`;
  analysis += `- 📋 Include breaking changes, new features, and bug fixes\n`;
  analysis += `- 🔗 Link to relevant issues and pull requests\n`;

  return analysis;
}

// Helper functions
async function getFileContentFromRepo(owner: string, repo: string, path: string): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    
    const data = await response.json() as { content?: string; encoding?: string };
    if (data.content && data.encoding === 'base64') {
      return Buffer.from(data.content, 'base64').toString('utf-8');
    }
    return null;
  } catch (error) {
    console.warn(`Error fetching file ${path}:`, error);
    return null;
  }
}

function analyzeDependencyFile(content: string, filename: string): any | null {
  try {
    if (filename === 'package.json') {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const depCount = Object.keys(deps).length;
      
      return {
        file: filename,
        type: 'npm',
        dependencyCount: depCount,
        summary: `${depCount} npm dependencies detected`,
        details: deps
      };
    } else if (filename === 'requirements.txt') {
      const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
      return {
        file: filename,
        type: 'pip',
        dependencyCount: lines.length,
        summary: `${lines.length} Python packages detected`,
        details: lines
      };
    }
    // Add more dependency file types as needed
    
    return null;
  } catch (error) {
    console.warn(`Error parsing ${filename}:`, error);
    return null;
  }
}

app.listen(PORT, () => {
  console.log(`🚀 Nosana GitHub Insights Agent running on port ${PORT}`);
  console.log(`📊 Try: curl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -d '{"message":"Show me stats for microsoft/vscode"}'`);
}); 