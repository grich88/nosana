import { createConfig } from 'mastra';

export default createConfig({
  name: 'nosana-github-insights-agent',
  agents: {
    directory: './src/mastra/agents',
  },
  tools: {
    directory: './src/mastra/tools',
  },
  workflows: {
    directory: './src/mastra/workflows',
  },
  llm: {
    provider: 'OPEN_AI',
    model: 'gpt-4o-mini', // Can be changed to qwen2.5:32b for Nosana deployment
  },
}); 