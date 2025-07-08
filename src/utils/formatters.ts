/**
 * Utility functions for formatting GitHub repository data and responses
 */

export interface RepositoryData {
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  open_issues: number;
  watchers: number;
  language: string | null;
  license: string | null;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  archived: boolean;
  topics: string[];
}

export interface ContributorData {
  login: string;
  contributions: number;
  avatar_url: string;
  html_url: string;
}

/**
 * Formats large numbers with appropriate suffixes (K, M, B)
 */
export function formatNumber(num: number): string {
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

/**
 * Calculates the time difference from a date string to now
 */
export function getTimeAgo(dateString: string): string {
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

/**
 * Determines repository health status based on metrics
 */
export function assessRepositoryHealth(repo: RepositoryData): {
  status: string;
  score: number;
  factors: string[];
} {
  const factors: string[] = [];
  let score = 5; // Base score
  
  // Check if archived
  if (repo.archived) {
    return {
      status: 'ARCHIVED',
      score: 1,
      factors: ['Repository is explicitly archived'],
    };
  }
  
  // Analyze last activity
  const daysSinceLastPush = Math.floor(
    (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24)
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
  if (repo.stars >= 10000) {
    score += 2;
    factors.push(`Highly popular (${formatNumber(repo.stars)} stars)`);
  } else if (repo.stars >= 1000) {
    score += 1;
    factors.push(`Popular (${formatNumber(repo.stars)} stars)`);
  } else if (repo.stars >= 100) {
    factors.push(`Moderately popular (${repo.stars} stars)`);
  }
  
  // Analyze issue management
  const issueRatio = repo.open_issues / Math.max(repo.stars, 1);
  if (issueRatio < 0.05) {
    score += 1;
    factors.push('Well-managed issues (low issue-to-star ratio)');
  } else if (issueRatio > 0.15) {
    score -= 1;
    factors.push('High number of open issues relative to popularity');
  }
  
  // Analyze community engagement
  if (repo.forks > repo.stars * 0.1) {
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

/**
 * Generates insights and recommendations based on repository data
 */
export function generateInsights(repo: RepositoryData, contributors?: ContributorData[]): string[] {
  const insights: string[] = [];
  
  // Activity insights
  const daysSinceLastPush = Math.floor(
    (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  if (daysSinceLastPush <= 7) {
    insights.push('Very active project with recent commits - great for staying current');
  } else if (daysSinceLastPush > 180) {
    insights.push('Consider checking if the project is still maintained before depending on it');
  }
  
  // Popularity insights
  if (repo.stars >= 1000 && repo.forks >= 100) {
    insights.push('Strong community adoption - likely a reliable choice');
  }
  
  if (repo.stars > repo.forks * 5) {
    insights.push('High star-to-fork ratio suggests more users than contributors');
  }
  
  // Language insights
  if (repo.language) {
    insights.push(`Written in ${repo.language} - ensure it fits your tech stack`);
  }
  
  // Issue insights
  if (repo.open_issues > 0) {
    const issueRatio = repo.open_issues / Math.max(repo.stars, 1);
    if (issueRatio < 0.05) {
      insights.push('Well-maintained with few open issues relative to popularity');
    } else if (issueRatio > 0.15) {
      insights.push('High number of open issues - check if they affect your use case');
    }
  }
  
  // Contributor insights
  if (contributors && contributors.length > 0) {
    if (contributors.length >= 10) {
      insights.push('Diverse contributor base indicates healthy community involvement');
    } else if (contributors.length === 1) {
      insights.push('Single-contributor project - consider the bus factor risk');
    }
  }
  
  // License insights
  if (repo.license) {
    insights.push(`Licensed under ${repo.license} - verify compatibility with your project`);
  } else {
    insights.push('No license specified - check usage rights before adoption');
  }
  
  return insights;
}

/**
 * Formats a complete repository analysis into a readable response
 */
export function formatRepositoryAnalysis(
  repo: RepositoryData,
  contributors?: ContributorData[]
): string {
  const health = assessRepositoryHealth(repo);
  const insights = generateInsights(repo, contributors);
  
  const lastUpdated = getTimeAgo(repo.pushed_at);
  const created = new Date(repo.created_at).toLocaleDateString();
  
  let response = `📊 **Repository Overview**\n`;
  response += `- Name: ${repo.name}\n`;
  response += `- Full Name: ${repo.full_name}\n`;
  if (repo.description) response += `- Description: ${repo.description}\n`;
  if (repo.language) response += `- Language: ${repo.language}\n`;
  response += `- Created: ${created} | Last Updated: ${lastUpdated}\n\n`;
  
  response += `📈 **Key Metrics**\n`;
  response += `- ⭐ Stars: ${formatNumber(repo.stars)}\n`;
  response += `- 🍴 Forks: ${formatNumber(repo.forks)}\n`;
  response += `- 🐛 Open Issues: ${formatNumber(repo.open_issues)}\n`;
  response += `- 👀 Watchers: ${formatNumber(repo.watchers)}\n`;
  if (repo.license) response += `- 📄 License: ${repo.license}\n`;
  response += '\n';
  
  if (contributors && contributors.length > 0) {
    response += `👥 **Contributors**\n`;
    response += `- Total Contributors: ${contributors.length}\n`;
    response += `- Top Contributors: ${contributors.slice(0, 3).map(c => `${c.login} (${c.contributions})`).join(', ')}\n\n`;
  }
  
  response += `🏥 **Health Assessment: ${health.status}**\n`;
  response += `Health Score: ${health.score}/10\n\n`;
  response += `Key factors:\n`;
  health.factors.forEach(factor => {
    response += `- ${factor}\n`;
  });
  response += '\n';
  
  if (insights.length > 0) {
    response += `💡 **Insights & Recommendations**\n`;
    insights.forEach(insight => {
      response += `- ${insight}\n`;
    });
  }
  
  if (repo.topics && repo.topics.length > 0) {
    response += `\n🏷️ **Topics**: ${repo.topics.join(', ')}\n`;
  }
  
  return response;
} 