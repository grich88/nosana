import axios from 'axios';

export interface NosanaJob {
  id?: string;
  name: string;
  image: string;
  command?: string[];
  env?: Record<string, string>;
  gpu: string;
  timeout: number;
  price: number;
  description?: string;
}

export interface JobStatus {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  created: Date;
  started?: Date;
  finished?: Date;
  logs?: string[];
  endpoint?: string;
  cost: {
    estimated: number;
    actual?: number;
  };
}

export interface DeploymentResponse {
  success: boolean;
  jobId?: string;
  message: string;
  endpoint?: string;
  estimatedCost?: number;
}

export class NosanaService {
  private baseURL: string;
  private apiKey?: string;

  constructor() {
    // Use environment variables for Nosana API configuration
    this.baseURL = process.env.REACT_APP_NOSANA_API_URL || 'https://api.nosana.io';
    this.apiKey = process.env.REACT_APP_NOSANA_API_KEY;
  }

  // Deploy agent to Nosana network
  async deployAgent(
    dockerImage: string,
    walletAddress: string,
    gpuTier: 'nvidia-3060' | 'nvidia-4090' | 'nvidia-a100' = 'nvidia-3060',
    timeout: number = 30 // minutes
  ): Promise<DeploymentResponse> {
    try {
      const jobDefinition: NosanaJob = {
        name: 'nosana-github-insights-agent',
        image: dockerImage,
        command: ['npm', 'start'],
        env: {
          PORT: '3000',
          NODE_ENV: 'production',
          LLM_PROVIDER: 'ollama',
          LLM_MODEL: 'qwen2.5:32b',
          NOSANA_ENDPOINT: 'https://4qvrhtl5tvy69ca2veau9dxhpt43lbpofdjbu6r21wvv.node.k8s.prd.nos.ci/'
        },
        gpu: gpuTier,
        timeout: timeout,
        price: this.calculateJobPrice(gpuTier, timeout),
        description: 'AI agent for GitHub repository insights and analysis'
      };

      // Simulate deployment (in production, this would make actual API calls)
      const response = await this.simulateDeployment(jobDefinition, walletAddress);
      
      return response;
    } catch (error) {
      console.error('Deployment failed:', error);
      return {
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Get job status and logs
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    try {
      // Simulate job status retrieval
      const mockStatus: JobStatus = {
        id: jobId,
        status: 'running',
        created: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
        started: new Date(Date.now() - 8 * 60 * 1000),  // 8 minutes ago
        endpoint: `https://${jobId.slice(0, 8)}.nosana.io`,
        cost: {
          estimated: 2.5,
          actual: 1.8
        },
        logs: [
          '[2025-01-09T12:00:00Z] Starting container...',
          '[2025-01-09T12:00:15Z] Installing dependencies...',
          '[2025-01-09T12:01:30Z] Building application...',
          '[2025-01-09T12:02:45Z] Starting server on port 3000...',
          '[2025-01-09T12:03:00Z] GitHub Insights Agent ready!'
        ]
      };

      return mockStatus;
    } catch (error) {
      console.error('Failed to get job status:', error);
      return null;
    }
  }

  // Cancel a running job
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      // Simulate job cancellation
      console.log(`Cancelling job ${jobId}...`);
      
      // In production, would make API call to Nosana
      return true;
    } catch (error) {
      console.error('Failed to cancel job:', error);
      return false;
    }
  }

  // List user's jobs
  async listJobs(walletAddress: string): Promise<JobStatus[]> {
    try {
      // Simulate job listing
      const mockJobs: JobStatus[] = [
        {
          id: 'job_12345',
          status: 'running',
          created: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          started: new Date(Date.now() - 2 * 60 * 60 * 1000 + 5 * 60 * 1000),
          endpoint: 'https://job12345.nosana.io',
          cost: { estimated: 5.0, actual: 3.2 }
        },
        {
          id: 'job_67890',
          status: 'completed',
          created: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
          started: new Date(Date.now() - 24 * 60 * 60 * 1000 + 2 * 60 * 1000),
          finished: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          endpoint: 'https://job67890.nosana.io',
          cost: { estimated: 12.0, actual: 11.5 }
        }
      ];

      return mockJobs;
    } catch (error) {
      console.error('Failed to list jobs:', error);
      return [];
    }
  }

  // Calculate job pricing based on GPU tier and duration
  private calculateJobPrice(gpuTier: string, timeoutMinutes: number): number {
    const hourlyRates = {
      'nvidia-3060': 0.5,  // NOS per hour
      'nvidia-4090': 1.5,  // NOS per hour
      'nvidia-a100': 3.0   // NOS per hour
    };

    const rate = hourlyRates[gpuTier as keyof typeof hourlyRates] || 0.5;
    const hours = timeoutMinutes / 60;
    
    return Number((rate * hours).toFixed(2));
  }

  // Simulate deployment for demo purposes
  private async simulateDeployment(
    jobDefinition: NosanaJob, 
    walletAddress: string
  ): Promise<DeploymentResponse> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate mock job ID
    const jobId = 'job_' + Math.random().toString(36).substr(2, 9);
    const endpoint = `https://${jobId.slice(4, 12)}.nosana.io`;

    return {
      success: true,
      jobId,
      message: 'Agent successfully deployed to Nosana network!',
      endpoint,
      estimatedCost: jobDefinition.price
    };
  }

  // Get available GPU tiers and pricing
  getGPUTiers(): Array<{
    id: string;
    name: string;
    description: string;
    pricePerHour: number;
    availability: 'high' | 'medium' | 'low';
  }> {
    return [
      {
        id: 'nvidia-3060',
        name: 'NVIDIA RTX 3060',
        description: 'Basic GPU tier - Perfect for lightweight AI models',
        pricePerHour: 0.5,
        availability: 'high'
      },
      {
        id: 'nvidia-4090',
        name: 'NVIDIA RTX 4090',
        description: 'High-performance GPU - Ideal for complex AI workloads',
        pricePerHour: 1.5,
        availability: 'medium'
      },
      {
        id: 'nvidia-a100',
        name: 'NVIDIA A100',
        description: 'Enterprise GPU - Maximum performance for production',
        pricePerHour: 3.0,
        availability: 'low'
      }
    ];
  }

  // Check if API is available
  async checkAPIStatus(): Promise<boolean> {
    try {
      // In production, would check actual Nosana API health
      return true;
    } catch (error) {
      console.error('Nosana API unavailable:', error);
      return false;
    }
  }

  // Get network statistics
  async getNetworkStats(): Promise<{
    totalNodes: number;
    activeJobs: number;
    averagePrice: number;
    availability: number;
  }> {
    // Simulate network statistics
    return {
      totalNodes: 1247,
      activeJobs: 89,
      averagePrice: 1.2,
      availability: 94.7
    };
  }

  // Validate Docker image URL
  validateDockerImage(imageUrl: string): { valid: boolean; message: string } {
    const dockerImageRegex = /^([a-zA-Z0-9._-]+\/)?([a-zA-Z0-9._-]+)(:[a-zA-Z0-9._-]+)?$/;
    
    if (!imageUrl) {
      return { valid: false, message: 'Docker image URL is required' };
    }

    if (!dockerImageRegex.test(imageUrl)) {
      return { valid: false, message: 'Invalid Docker image format' };
    }

    if (!imageUrl.includes(':')) {
      return { valid: false, message: 'Please specify image tag (e.g., :latest)' };
    }

    return { valid: true, message: 'Valid Docker image URL' };
  }
}

export const nosanaService = new NosanaService(); 