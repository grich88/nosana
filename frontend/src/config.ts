// API Configuration for different environments
const config = {
  development: {
    API_BASE_URL: 'http://localhost:3000'
  },
  production: {
    API_BASE_URL: 'https://nosana-github-insights-backend.onrender.com'
  }
};

// Determine environment
const environment = process.env.NODE_ENV || 'development';

// Export the appropriate configuration
export const API_CONFIG = config[environment as keyof typeof config] || config.development;

// Helper function to get full API URL
export const getApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.API_BASE_URL}${endpoint}`;
}; 