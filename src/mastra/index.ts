import { Mastra } from 'mastra';
import { githubInsightsAgent } from './agents/githubInsights';

export const mastra = new Mastra({
  agents: {
    githubInsights: githubInsightsAgent,
  },
});

export default mastra; 