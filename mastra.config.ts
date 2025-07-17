import { createConfig } from 'mastra';

// Configuration for Nosana Builders Challenge
// Uses Ollama with qwen2.5:1.5b for local development
// and qwen2.5:32b for Nosana deployment
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
    provider: process.env.LLM_PROVIDER === 'ollama' ? 'OLLAMA' : 'OPEN_AI',
    model: process.env.LLM_MODEL || 'gemma2',
    ...(process.env.LLM_PROVIDER === 'ollama' && {
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    }),
    ...(process.env.NOSANA_ENDPOINT && {
      baseURL: process.env.NOSANA_ENDPOINT,
    }),
  },
}); 