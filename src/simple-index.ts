import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Agent } from 'mastra';
import { createTool } from 'mastra';
import { z } from 'zod';
import { openai } from '@ai-sdk/openai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// GitHub Repository Tool
const githubRepoTool = createTool({
  id: 'github-repo-stats',
  description: 'Fetches comprehensive statistics and information for a GitHub repository',
  inputSchema: z.object({
    owner: z.string().describe('Repository owner/organization name (e.g., "facebook")'),
    repo: z.string().describe('Repository name (e.g., "react")'),
  }),
  outputSchema: z.object({
    name: z.string(),
    full_name: z.string(),
    description: z.string().nullable(),
    stars: z.number(),
    forks: z.number(),
    open_issues: z.number(),
    watchers: z.number(),
    language: z.string().nullable(),
    license: z.string().nullable(),
    created_at: z.string(),
    pushed_at: z.string(),
    archived: z.boolean(),
  }),
  execute: async ({ owner, repo }) => {
    try {
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
      
      const data = await response.json();
      
      return {
        name: data.name,
        full_name: data.full_name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        watchers: data.watchers_count,
        language: data.language,
        license: data.license?.name || null,
        created_at: data.created_at,
        pushed_at: data.pushed_at,
        archived: data.archived,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch repository data: ${String(error)}`);
    }
  },
});

// GitHub Insights Agent
const githubInsightsAgent = new Agent({
  name: 'GitHub Insights Agent',
  instructions: `You are an expert GitHub repository analyst that provides comprehensive insights about GitHub repositories.

When a user asks about a repository:
1. Parse the repository information. If they provide a full GitHub URL (like https://github.com/facebook/react), extract the owner and repo name.
2. If they only provide a repository name without owner, ask for clarification.
3. Use the github-repo-stats tool to get comprehensive repository data.
4. Provide a structured analysis that includes:
   - Basic repository information (name, description, language)
   - Key metrics (stars, forks, issues, watchers)
   - Activity indicators (last update, creation date)
   - Health assessment based on the data
   - Notable insights and recommendations

Health Assessment Guidelines:
- ACTIVE: Recent commits (within 30 days), reasonable issue-to-star ratio
- WELL-MAINTAINED: Regular updates, managed issues
- POPULAR: High star count, many forks, active community
- STABLE: Mature project with consistent activity
- STALE: No recent updates (6+ months), high issue count
- ARCHIVED: Explicitly marked as archived

Format your responses to be informative, well-structured, and actionable. Always cite the specific metrics that support your health assessment.`,

  model: openai('gpt-4o-mini'),
  tools: {
    githubRepoStats: githubRepoTool,
  },
});

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

    const response = await githubInsightsAgent.generate(message);
    
    res.json({ 
      response: response.text,
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
    description: 'AI agent that provides comprehensive GitHub repository insights with health assessments',
    capabilities: [
      'Fetch repository statistics (stars, forks, issues)',
      'Analyze repository health and activity',
      'Provide development insights and recommendations',
      'Support for any public GitHub repository'
    ],
    usage: 'Send a POST request to /chat with a message like "Show me stats for facebook/react"'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Nosana GitHub Insights Agent running on port ${PORT}`);
  console.log(`📊 Try: curl -X POST http://localhost:${PORT}/chat -H "Content-Type: application/json" -d '{"message":"Show me stats for microsoft/vscode"}'`);
}); 