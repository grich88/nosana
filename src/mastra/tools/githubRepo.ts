import { createTool } from 'mastra';
import { z } from 'zod';

// Input schema for the GitHub repo tool
const githubRepoInputSchema = z.object({
  owner: z.string().describe('Repository owner/organization name (e.g., "facebook")'),
  repo: z.string().describe('Repository name (e.g., "react")'),
});

// Output schema for structured data
const githubRepoOutputSchema = z.object({
  name: z.string(),
  full_name: z.string(),
  description: z.string().nullable(),
  stars: z.number(),
  forks: z.number(),
  open_issues: z.number(),
  watchers: z.number(),
  size: z.number(),
  language: z.string().nullable(),
  license: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string(),
  homepage: z.string().nullable(),
  topics: z.array(z.string()),
  archived: z.boolean(),
  disabled: z.boolean(),
  fork: z.boolean(),
  has_issues: z.boolean(),
  has_wiki: z.boolean(),
  has_pages: z.boolean(),
  default_branch: z.string(),
  network_count: z.number(),
  subscribers_count: z.number(),
});

export const githubRepoTool = createTool({
  id: 'github-repo-stats',
  description: 'Fetches comprehensive statistics and information for a GitHub repository',
  inputSchema: githubRepoInputSchema,
  outputSchema: githubRepoOutputSchema,
  execute: async ({ owner, repo }) => {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}`;
      
      // Prepare headers
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Nosana-GitHub-Insights-Agent',
      };
      
      // Add authorization if GitHub token is available
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
      
      // Transform data to match our schema
      return {
        name: data.name,
        full_name: data.full_name,
        description: data.description,
        stars: data.stargazers_count,
        forks: data.forks_count,
        open_issues: data.open_issues_count,
        watchers: data.watchers_count,
        size: data.size,
        language: data.language,
        license: data.license?.name || null,
        created_at: data.created_at,
        updated_at: data.updated_at,
        pushed_at: data.pushed_at,
        homepage: data.homepage,
        topics: data.topics || [],
        archived: data.archived,
        disabled: data.disabled,
        fork: data.fork,
        has_issues: data.has_issues,
        has_wiki: data.has_wiki,
        has_pages: data.has_pages,
        default_branch: data.default_branch,
        network_count: data.network_count,
        subscribers_count: data.subscribers_count,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch repository data: ${String(error)}`);
    }
  },
}); 