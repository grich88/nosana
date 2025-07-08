import { createTool } from 'mastra';
import { z } from 'zod';

// Input schema for the GitHub contributors tool
const githubContributorsInputSchema = z.object({
  owner: z.string().describe('Repository owner/organization name'),
  repo: z.string().describe('Repository name'),
  limit: z.number().default(10).describe('Maximum number of contributors to fetch (default: 10)'),
});

// Output schema for contributors data
const contributorSchema = z.object({
  login: z.string(),
  contributions: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
  type: z.string(),
});

const githubContributorsOutputSchema = z.object({
  contributors: z.array(contributorSchema),
  total_contributors: z.number(),
});

export const githubContributorsTool = createTool({
  id: 'github-contributors',
  description: 'Fetches top contributors for a GitHub repository to assess community involvement',
  inputSchema: githubContributorsInputSchema,
  outputSchema: githubContributorsOutputSchema,
  execute: async ({ owner, repo, limit = 10 }) => {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/contributors?per_page=${limit}`;
      
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
          throw new Error(`Repository ${owner}/${repo} not found or has no contributors data.`);
        } else if (response.status === 403) {
          throw new Error('GitHub API rate limit exceeded. Please try again later or add a GitHub token.');
        } else {
          throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      
      // Transform contributors data
      const contributors = data.map((contributor: any) => ({
        login: contributor.login,
        contributions: contributor.contributions,
        avatar_url: contributor.avatar_url,
        html_url: contributor.html_url,
        type: contributor.type,
      }));
      
      return {
        contributors,
        total_contributors: contributors.length,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to fetch contributors data: ${String(error)}`);
    }
  },
}); 