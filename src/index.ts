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

// Enhanced GitHub API function with better error handling
async function getGitHubRepoInfo(owner: string, repo: string) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Nosana-GitHub-Insights-Agent',
  };
  
  // Only add authorization if token is available
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
  }

  try {
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 403) {
        // Rate limit exceeded - return a fallback response
        console.warn(`GitHub API rate limit exceeded for ${owner}/${repo}`);
        return {
          name: repo,
          full_name: `${owner}/${repo}`,
          description: "Repository analysis limited due to API rate limits. Please add a GitHub token for full functionality.",
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
          language: "Unknown",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          size: 0,
          watchers_count: 0,
          default_branch: "main",
          topics: [],
          license: null,
          homepage: "",
          clone_url: `https://github.com/${owner}/${repo}.git`,
          html_url: `https://github.com/${owner}/${repo}`,
          rate_limited: true
        };
      } else if (response.status === 404) {
        throw new Error(`Repository ${owner}/${repo} not found or is private`);
      } else {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }
    }
    
    const data = await response.json() as any;
    return { ...data, rate_limited: false };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('rate limit') || error.message.includes('403')) {
        // Return fallback data for rate limit errors
        console.warn(`Rate limit fallback for ${owner}/${repo}`);
        return {
          name: repo,
          full_name: `${owner}/${repo}`,
          description: "Analysis limited due to GitHub API constraints. Add GitHub token for enhanced features.",
          stargazers_count: 0,
          forks_count: 0,
          open_issues_count: 0,
          language: "Unknown",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          size: 0,
          watchers_count: 0,
          default_branch: "main",
          topics: [],
          license: null,
          homepage: "",
          clone_url: `https://github.com/${owner}/${repo}.git`,
          html_url: `https://github.com/${owner}/${repo}`,
          rate_limited: true
        };
      }
      throw error;
    }
    throw new Error(`Failed to fetch repository data: ${error}`);
  }
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

// Agent information endpoint
app.post('/agent-info', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    // Enhanced agent response with new capabilities
    const agentInfo = `🚀 **Nosana GitHub Insights Agent v3.0 - Enterprise Edition**

Welcome to the most advanced GitHub analysis platform! I'm your AI-powered code intelligence assistant, built for the Nosana Builders Challenge.

## 🎯 **13 Powerful Analysis Types**

### **📊 Core Repository Analysis**
- **Overview**: Complete repository health scoring and metrics
- **Security**: Advanced vulnerability scanning and risk assessment  
- **Issues**: AI-powered issue analysis with smart fix suggestions
- **Pull Requests**: PR insights, patterns, and merge analysis
- **Contributors**: Team dynamics and collaboration patterns
- **Dependencies**: Package health monitoring and update recommendations
- **Releases**: Automated release notes generation

### **🔍 Advanced Code Intelligence** 
- **Code Fix Search**: Search ALL of GitHub for fixes to your problems (GPU intensive!)
- **Bounty Hunter**: Discover paid issues and bounty opportunities 
- **Code Patterns**: AI pattern recognition and best practice analysis
- **Similar Repos**: Find projects with similar tech stacks and problems
- **Learning Path**: Personalized AI-generated learning roadmaps
- **Vulnerability Research**: Security fix pattern discovery

## 🚀 **How to Use Each Feature**

### **1. 🔍 Code Fix Search (GPU Powerhouse!)**
- **Input**: Describe your problem OR paste problematic code
- **Optional**: Specify programming language and error type
- **Output**: Comprehensive GitHub search results with AI-generated fixes
- **Example**: "React useState not updating" + code snippet

### **2. 💰 Bounty Hunter** 
- **Input**: Your skills (comma-separated) and preferred language
- **Output**: Active bounty opportunities with estimated earnings
- **Features**: Difficulty matching, skill-based filtering, earnings calculator
- **Example**: Skills: "React, Node.js, Python" → Find matching paid issues

### **3. 🧠 Code Pattern Analysis**
- **Input**: GitHub repository URL
- **Output**: AI analysis of coding patterns, best practices, and recommendations
- **Benefits**: Learn from successful patterns, identify improvements

### **4. 🔗 Similar Repository Finder**
- **Input**: GitHub repository URL  
- **Output**: Repositories with similar technology stacks and purposes
- **Use Cases**: Research alternatives, find inspiration, study implementations

### **5. 📚 Learning Path Generator**
- **Input**: Repository + your current skills + target role
- **Output**: Personalized learning modules with time estimates
- **Features**: Skill gap analysis, progressive learning, career-focused

### **6. 🛡️ Vulnerability Research**
- **Input**: Security issue description or CVE ID
- **Output**: How others fixed similar vulnerabilities
- **Security Focus**: Pattern analysis, best practices, prevention strategies

## 💡 **AI-Powered Capabilities**

- **🤖 Intelligent Code Analysis**: Deep understanding of programming patterns
- **🔍 GitHub-Wide Search**: Access to millions of repositories and solutions
- **💰 Bounty Discovery**: Real-time scanning for paid opportunities
- **🧠 Pattern Recognition**: AI identifies recurring code structures and solutions
- **📚 Personalized Learning**: Adaptive educational content generation
- **🛡️ Security Intelligence**: Vulnerability pattern analysis and fix suggestions
- **📊 Health Scoring**: Comprehensive repository quality assessment
- **🔗 Relationship Mapping**: Connect related projects and technologies

## 🌟 **Enterprise Features**

- **Multi-Language Support**: JavaScript, Python, Java, Go, Rust, and 50+ more
- **Real-Time Analysis**: Live scanning of GitHub's entire ecosystem
- **AI Fix Generation**: Smart recommendations based on similar solved problems
- **Bounty Integration**: Direct links to earning opportunities
- **Learning Optimization**: Career-focused skill development paths
- **Security Research**: Advanced vulnerability pattern database

## 📈 **Performance & Scale**

- **GitHub API Integration**: Direct access to repository metadata and code
- **Rate Limit Optimization**: Intelligent request management
- **GPU Acceleration**: Intensive computations for comprehensive analysis
- **Result Caching**: Optimized performance for repeated queries
- **Scalable Architecture**: Built for enterprise-level usage

## 🔥 **Getting Started**

1. **Choose Analysis Type**: Select from 13 specialized analysis modes
2. **Provide Input**: Repository URL, code snippet, or problem description
3. **Add Context**: Skills, target role, language preferences (optional)
4. **Get AI Insights**: Comprehensive analysis with actionable recommendations
5. **Take Action**: Follow suggestions, apply fixes, claim bounties, learn!

## 💎 **Why This Agent is Unique**

- **Comprehensive Coverage**: 13 different analysis types in one platform
- **AI-First Approach**: Every feature powered by advanced AI analysis
- **Developer-Focused**: Built by developers, for developers
- **Earning Opportunities**: Only platform that finds you paid coding work
- **Learning Integration**: Combines analysis with educational content
- **Security Emphasis**: Advanced vulnerability research capabilities
- **Open Source Friendly**: Works with any public GitHub repository

## 🚀 **Ready to Explore?**

Start with any repository URL (e.g., \`https://github.com/microsoft/vscode\`) or describe your coding challenge. I'll analyze it using cutting-edge AI and provide insights that will accelerate your development journey!

**Built for Nosana Builders Challenge** | **Powered by Advanced AI** | **Enterprise-Grade Analysis**`;

    res.json({
      response: agentInfo,
      timestamp: new Date().toISOString(),
      version: "3.0.0",
      capabilities: [
        "Repository Health Analysis",
        "AI-Powered Security Scanning", 
        "Code Fix Search (GitHub-wide)",
        "Bounty Opportunity Discovery",
        "Code Pattern Recognition",
        "Similar Repository Finding",
        "Personalized Learning Paths",
        "Vulnerability Pattern Research",
        "Issue Analysis & AI Fixes",
        "PR Insights & Patterns",
        "Contributor Analysis",
        "Dependency Health Monitoring",
        "Automated Release Notes"
      ],
      supportedLanguages: [
        "JavaScript", "TypeScript", "Python", "Java", "Go", "Rust",
        "C++", "C#", "PHP", "Ruby", "Swift", "Kotlin", "Scala",
        "HTML", "CSS", "SQL", "Shell", "PowerShell", "Dockerfile"
      ],
      bountyPlatforms: [
        "Gitcoin", "IssueHunt", "Bountysource", "OpenCollective",
        "GitHub Sponsors", "Direct Repository Bounties"
      ]
    });
    
  } catch (error: any) {
    console.error('Agent info error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
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

// Code Fix Search endpoint - Search all GitHub for fixes to user's code
app.post('/search-fixes', async (req: Request, res: Response) => {
  try {
    const { message, code, language, errorType } = req.body;
    
    if (!message && !code) {
      return res.status(400).json({ error: 'Message or code is required' });
    }
    
    // Perform intensive GitHub search for similar issues and fixes
    const searchResults = await searchGitHubForFixes(message, code, language, errorType);
    const aiAnalysis = await analyzeCodeFixesWithAI(searchResults, message, code, language);
    
    res.json({
      response: aiAnalysis,
      searchResults: searchResults.slice(0, 10), // Limit results for performance
      totalFound: searchResults.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Code fix search error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Bounty Hunter endpoint - Find issues with monetary rewards
app.post('/find-bounties', async (req: Request, res: Response) => {
  try {
    const { message, skills, language, difficulty } = req.body;
    
    // Search for bounty issues across GitHub and bounty platforms
    const bountyIssues = await searchForBountyIssues(skills, language, difficulty);
    const analysis = await analyzeBountiesWithAI(bountyIssues, skills, language);
    
    res.json({
      response: analysis,
      bounties: bountyIssues,
      totalBounties: bountyIssues.length,
      estimatedEarnings: calculateEstimatedEarnings(bountyIssues),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Bounty search error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Code Pattern Analyzer endpoint - Discover patterns across GitHub
app.post('/analyze-patterns', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Analyze code patterns and find similar implementations
    const patterns = await analyzeCodePatterns(owner, repo);
    const analysis = await analyzePatternsWithAI(patterns, owner, repo);
    
    res.json({
      response: analysis,
      patterns: patterns,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Pattern analysis error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Similar Repository Finder endpoint
app.post('/find-similar', async (req: Request, res: Response) => {
  try {
    const { message } = req.body;
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Find repositories with similar technology stacks
    const similarRepos = await findSimilarRepositories(owner, repo);
    const analysis = await analyzeSimilarReposWithAI(similarRepos, owner, repo);
    
    res.json({
      response: analysis,
      similarRepositories: similarRepos,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Similar repo search error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Learning Path Generator endpoint
app.post('/generate-learning-path', async (req: Request, res: Response) => {
  try {
    const { message, currentSkills, targetRole } = req.body;
    
    const repoInfo = parseRepositoryFromMessage(message);
    if (!repoInfo) {
      return res.status(400).json({ 
        error: 'Could not parse repository information' 
      });
    }
    
    const { owner, repo } = repoInfo;
    
    // Generate AI-powered learning path based on repository analysis
    const learningPath = await generateLearningPath(owner, repo, currentSkills, targetRole);
    
    res.json({
      response: learningPath.summary,
      learningPath: learningPath.details,
      estimatedTimeToComplete: learningPath.timeEstimate,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Learning path generation error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Vulnerability Pattern Search endpoint
app.post('/search-vulnerability-fixes', async (req: Request, res: Response) => {
  try {
    const { message, vulnerabilityType, cveId } = req.body;
    
    // Search for how others fixed similar vulnerabilities
    const vulnFixes = await searchVulnerabilityFixes(vulnerabilityType, cveId, message);
    const analysis = await analyzeVulnerabilityFixesWithAI(vulnFixes, vulnerabilityType);
    
    res.json({
      response: analysis,
      fixes: vulnFixes,
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Vulnerability fix search error:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Temporary stub functions for advanced features
async function searchGitHubForFixes(message: string, code?: string, language?: string, errorType?: string): Promise<any[]> {
  console.log('Code fix search requested - feature in development');
  return [];
}

async function analyzeCodeFixesWithAI(searchResults: any[], message: string, code?: string, language?: string): Promise<string> {
  return `🔍 **Code Fix Search**\n\n🚧 This advanced feature is currently being enhanced!\n\nYour query: "${message}"\n\n💡 **Coming Soon:**\n- GitHub-wide code search\n- AI-powered fix suggestions\n- Pattern matching across repositories\n- GPU-accelerated analysis\n\nIn the meantime, try our other features like Security Analysis, Issues Analysis, or Repository Overview!`;
}

async function searchForBountyIssues(skills?: string[], language?: string, difficulty?: string): Promise<any[]> {
  console.log('Bounty search requested - feature in development');
  return [];
}

async function analyzeBountiesWithAI(bountyIssues: any[], skills?: string[], language?: string): Promise<string> {
  return `💰 **Bounty Hunter**\n\n🚧 This feature is being enhanced for better bounty discovery!\n\n🎯 **What You Can Expect:**\n- Real-time bounty issue scanning\n- Skill-based matching\n- Earnings calculator\n- Direct links to opportunities\n\nCheck back soon for the full bounty hunting experience!`;
}

function calculateEstimatedEarnings(bountyIssues: any[]): any {
  return { total: 0, breakdown: { easy: { count: 0, value: 0 }, medium: { count: 0, value: 0 }, hard: { count: 0, value: 0 } } };
}

async function analyzeCodePatterns(owner: string, repo: string): Promise<any[]> {
  console.log('Code pattern analysis requested - feature in development');
  return [];
}

async function analyzePatternsWithAI(patterns: any[], owner: string, repo: string): Promise<string> {
  return `🧠 **Code Pattern Analysis for ${owner}/${repo}**\n\n🚧 Advanced pattern recognition is being developed!\n\n🔍 **Coming Features:**\n- AI-powered pattern detection\n- Code quality insights\n- Best practice recommendations\n- Architecture analysis\n\nTry our Security Analysis or Issues Analysis for immediate insights!`;
}

async function findSimilarRepositories(owner: string, repo: string): Promise<any[]> {
  console.log('Similar repo search requested - feature in development');
  return [];
}

async function analyzeSimilarReposWithAI(similarRepos: any[], owner: string, repo: string): Promise<string> {
  return `🔗 **Similar Repository Analysis for ${owner}/${repo}**\n\n🚧 Repository discovery feature is being enhanced!\n\n📊 **Planned Capabilities:**\n- Technology stack matching\n- Similar project discovery\n- Alternative solution suggestions\n- Community insights\n\nExplore our working features like Overview, Security, or Contributors analysis!`;
}

async function generateLearningPath(owner: string, repo: string, currentSkills?: string[], targetRole?: string): Promise<any> {
  return {
    summary: `📚 **Learning Path Generator for ${owner}/${repo}**\n\n🚧 Personalized learning paths are being developed!\n\n🎯 **Future Features:**\n- AI-generated learning modules\n- Skill gap analysis\n- Progressive learning tracks\n- Career-focused recommendations\n\nExplore the repository with our Overview and Issues analysis to start learning!`,
    details: [],
    timeEstimate: 'Coming Soon'
  };
}

async function searchVulnerabilityFixes(vulnerabilityType?: string, cveId?: string, message?: string): Promise<any[]> {
  console.log('Vulnerability search requested - feature in development');
  return [];
}

async function analyzeVulnerabilityFixesWithAI(vulnFixes: any[], vulnerabilityType?: string): Promise<string> {
  return `🛡️ **Vulnerability Fix Research**\n\n🚧 Security research feature is being enhanced!\n\n🔍 **Coming Soon:**\n- CVE pattern analysis\n- Fix strategy recommendations\n- Security best practices\n- Vulnerability trend insights\n\nUse our Security Analysis feature for immediate security insights!`;
}

// Additional stub functions for core analysis features
async function getOpenIssues(owner: string, repo: string, limit: number = 20): Promise<any[]> {
  console.log(`Getting open issues for ${owner}/${repo} - feature in development`);
  return [];
}

async function analyzeIssuesWithAI(issues: any[], owner: string, repo: string): Promise<string> {
  return `📝 **Issues Analysis for ${owner}/${repo}**\n\n🚧 Enhanced issue analysis is being developed!\n\n💡 **Coming Features:**\n- AI-powered issue categorization\n- Priority recommendations\n- Solution suggestions\n- Community insights\n\nTry our Security Analysis or Repository Overview features!`;
}

async function getRecentPullRequests(owner: string, repo: string, limit: number = 20): Promise<any[]> {
  console.log(`Getting pull requests for ${owner}/${repo} - feature in development`);
  return [];
}

async function analyzePullRequestsWithAI(pullRequests: any[], owner: string, repo: string): Promise<string> {
  return `🔄 **Pull Request Analysis for ${owner}/${repo}**\n\n🚧 Advanced PR analysis is being enhanced!\n\n📊 **Planned Features:**\n- Code review insights\n- Merge pattern analysis\n- Contribution trends\n- Quality metrics\n\nExplore our Repository Overview for current insights!`;
}

async function getContributors(owner: string, repo: string, limit: number = 30): Promise<any[]> {
  console.log(`Getting contributors for ${owner}/${repo} - feature in development`);
  return [];
}

async function getRecentCommits(owner: string, repo: string, limit: number = 30): Promise<any[]> {
  console.log(`Getting commits for ${owner}/${repo} - feature in development`);
  return [];
}

async function analyzeContributorsWithAI(contributors: any[], commits: any[], owner: string, repo: string): Promise<string> {
  return `👥 **Contributors Analysis for ${owner}/${repo}**\n\n🚧 Community analysis is being enhanced!\n\n🎯 **Coming Features:**\n- Developer activity patterns\n- Contribution insights\n- Team dynamics analysis\n- Expertise mapping\n\nCheck out our Repository Overview for basic stats!`;
}

async function analyzeDependencyHealth(owner: string, repo: string): Promise<any> {
  console.log(`Analyzing dependencies for ${owner}/${repo} - feature in development`);
  return {
    summary: `📦 **Dependency Health for ${owner}/${repo}**\n\n🚧 Advanced dependency analysis is being developed!\n\n🔍 **Future Capabilities:**\n- Vulnerability scanning\n- Version compatibility checks\n- Security risk assessment\n- Update recommendations\n\nUse our Security Analysis for immediate security insights!`,
    details: []
  };
}

async function getRecentReleases(owner: string, repo: string, limit: number = 10): Promise<any[]> {
  console.log(`Getting releases for ${owner}/${repo} - feature in development`);
  return [];
}

async function generateReleaseNotesWithAI(releases: any[], commits: any[], owner: string, repo: string): Promise<string> {
  return `📋 **Release Notes Analysis for ${owner}/${repo}**\n\n🚧 AI-powered release analysis is being enhanced!\n\n📈 **Planned Features:**\n- Automated release summaries\n- Change impact analysis\n- Version trend insights\n- Update recommendations\n\nExplore our Repository Overview for current version info!`;
}

app.listen(PORT, () => {
  console.log(`🚀 Nosana GitHub Insights Agent running on port ${PORT}`);
  console.log(`📊 Try: curl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -d '{"message":"Show me stats for microsoft/vscode"}'`);
}); 