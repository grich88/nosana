import { createWorkflow, Step } from '@mastra/core';
import { z } from 'zod';

// Input schema for the workflow
const githubAnalysisInputSchema = z.object({
  owner: z.string().describe('Repository owner/organization name'),
  repo: z.string().describe('Repository name'),
  includeContributors: z.boolean().default(true).describe('Whether to include contributor analysis'),
});

// Output schema for the complete analysis
const githubAnalysisOutputSchema = z.object({
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
    description: z.string().nullable(),
    stars: z.number(),
    forks: z.number(),
    open_issues: z.number(),
    language: z.string().nullable(),
    license: z.string().nullable(),
    created_at: z.string(),
    pushed_at: z.string(),
  }),
  contributors: z.object({
    total_contributors: z.number(),
    top_contributors: z.array(z.object({
      login: z.string(),
      contributions: z.number(),
    })),
  }).optional(),
  health_assessment: z.object({
    status: z.string(),
    score: z.number(),
    factors: z.array(z.string()),
  }),
  recommendations: z.array(z.string()),
});

export const githubAnalysisWorkflow = createWorkflow({
  name: 'GitHub Repository Analysis',
  triggerSchema: githubAnalysisInputSchema,
  
  steps: [
    // Step 1: Fetch repository data
    Step.tool({
      name: 'fetchRepository',
      tool: 'github-repo-stats',
      input: ({ trigger }) => ({
        owner: trigger.owner,
        repo: trigger.repo,
      }),
    }),
    
    // Step 2: Fetch contributors (conditional)
    Step.tool({
      name: 'fetchContributors',
      tool: 'github-contributors',
      input: ({ trigger }) => ({
        owner: trigger.owner,
        repo: trigger.repo,
        limit: 10,
      }),
      condition: ({ trigger }) => trigger.includeContributors,
    }),
    
    // Step 3: Generate health assessment
    Step.ai({
      name: 'generateHealthAssessment',
      input: ({ trigger, steps }) => {
        const repoData = steps.fetchRepository;
        const contributorsData = steps.fetchContributors;
        
        return {
          repository: repoData,
          contributors: contributorsData,
          analysisPrompt: `
Based on the following GitHub repository data, provide a comprehensive health assessment:

Repository: ${repoData.full_name}
Stars: ${repoData.stars}
Forks: ${repoData.forks}
Open Issues: ${repoData.open_issues}
Language: ${repoData.language}
Last Push: ${repoData.pushed_at}
Created: ${repoData.created_at}
${contributorsData ? `Contributors: ${contributorsData.total_contributors}` : ''}

Analyze the repository health and provide:
1. Health status (ACTIVE, WELL-MAINTAINED, POPULAR, STABLE, STALE, ARCHIVED, or EXPERIMENTAL)
2. Health score (1-10)
3. Key factors contributing to the assessment
4. Specific recommendations for users or potential contributors

Consider factors like:
- Activity recency (last push date)
- Community engagement (stars, forks, contributors)
- Issue management (open issues vs popularity)
- Project maturity (creation date vs current state)
- Language ecosystem and trends

Respond in JSON format with the structure:
{
  "status": "status_name",
  "score": number,
  "factors": ["factor1", "factor2", ...],
  "recommendations": ["rec1", "rec2", ...]
}
          `
        };
      },
      model: {
        provider: 'OPEN_AI',
        name: 'gpt-4o-mini',
      },
    }),
    
    // Step 4: Format final output
    Step.transform({
      name: 'formatOutput',
      input: ({ steps }) => {
        const repoData = steps.fetchRepository;
        const contributorsData = steps.fetchContributors;
        const healthData = steps.generateHealthAssessment;
        
        // Parse the AI response (assuming it returns valid JSON)
        let healthAssessment;
        try {
          healthAssessment = JSON.parse(healthData.text || '{}');
        } catch {
          healthAssessment = {
            status: 'UNKNOWN',
            score: 5,
            factors: ['Unable to analyze'],
            recommendations: ['Manual review recommended'],
          };
        }
        
        return {
          repository: {
            name: repoData.name,
            full_name: repoData.full_name,
            description: repoData.description,
            stars: repoData.stars,
            forks: repoData.forks,
            open_issues: repoData.open_issues,
            language: repoData.language,
            license: repoData.license,
            created_at: repoData.created_at,
            pushed_at: repoData.pushed_at,
          },
          contributors: contributorsData ? {
            total_contributors: contributorsData.total_contributors,
            top_contributors: contributorsData.contributors.slice(0, 5).map(c => ({
              login: c.login,
              contributions: c.contributions,
            })),
          } : undefined,
          health_assessment: {
            status: healthAssessment.status,
            score: healthAssessment.score,
            factors: healthAssessment.factors,
          },
          recommendations: healthAssessment.recommendations,
        };
      },
      outputSchema: githubAnalysisOutputSchema,
    }),
  ],
}); 