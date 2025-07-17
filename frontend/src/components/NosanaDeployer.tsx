import React, { useState, useEffect } from 'react';

interface WalletInfo {
  connected: boolean;
  publicKey: string | null;
  balances: {
    sol: number;
    nos: number;
  };
}

interface NosanaDeployerProps {
  walletInfo: WalletInfo | null;
}

interface DeploymentJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  endpoint?: string;
  cost: number;
  created: Date;
}

const NosanaDeployer: React.FC<NosanaDeployerProps> = ({ walletInfo }) => {
  const [dockerImage, setDockerImage] = useState('yourusername/agent-challenge:latest');
  const [gpuTier, setGpuTier] = useState<'nvidia-3060' | 'nvidia-4090' | 'nvidia-a100'>('nvidia-3060');
  const [timeoutMinutes, setTimeoutMinutes] = useState(30);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<any>(null);
  const [jobs, setJobs] = useState<DeploymentJob[]>([]);
  const [showLogs, setShowLogs] = useState<string | null>(null);

  // Mock Nosana service functions
  const mockNosanaService = {
    validateDockerImage: (imageUrl: string) => {
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
    },

    getGPUTiers: () => [
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
    ],

    deployAgent: async (dockerImage: string, walletAddress: string, gpuTier: string, timeoutMinutes: number) => {
      // Simulate deployment
      await new Promise(resolve => globalThis.setTimeout(resolve, 3000));
      
      const jobId = 'job_' + Math.random().toString(36).substring(2, 11);
      const endpoint = `https://${jobId.slice(4, 12)}.nosana.io`;
      
      return {
        success: true,
        jobId,
        message: 'Agent successfully deployed to Nosana network!',
        endpoint,
        estimatedCost: mockNosanaService.calculateJobPrice(gpuTier, timeoutMinutes)
      };
    },

    calculateJobPrice: (gpuTier: string, timeoutMinutes: number) => {
      const hourlyRates = {
        'nvidia-3060': 0.5,
        'nvidia-4090': 1.5,
        'nvidia-a100': 3.0
      };
      
      const rate = hourlyRates[gpuTier as keyof typeof hourlyRates] || 0.5;
      const hours = timeoutMinutes / 60;
      
      return Number((rate * hours).toFixed(2));
    },

    getJobStatus: async (jobId: string) => {
      return {
        id: jobId,
        status: 'running',
        created: new Date(Date.now() - 10 * 60 * 1000),
        started: new Date(Date.now() - 8 * 60 * 1000),
        endpoint: `https://${jobId.slice(0, 8)}.nosana.io`,
        cost: { estimated: 2.5, actual: 1.8 },
        logs: [
          '[2025-01-09T12:00:00Z] Starting container...',
          '[2025-01-09T12:00:15Z] Installing dependencies...',
          '[2025-01-09T12:01:30Z] Building application...',
          '[2025-01-09T12:02:45Z] Starting server on port 3000...',
          '[2025-01-09T12:03:00Z] GitHub Insights Agent ready!',
          '[2025-01-09T12:03:15Z] Listening on port 3000',
          '[2025-01-09T12:03:30Z] Health check endpoint active',
        ]
      };
    },

    getNetworkStats: async () => ({
      totalNodes: 1247,
      activeJobs: 89,
      averagePrice: 1.2,
      availability: 94.7
    })
  };

  // Load jobs from localStorage on component mount
  useEffect(() => {
    const savedJobs = localStorage.getItem('nosana-jobs');
    if (savedJobs) {
      try {
        const parsedJobs = JSON.parse(savedJobs).map((job: any) => ({
          ...job,
          created: new Date(job.created)
        }));
        setJobs(parsedJobs);
      } catch (error) {
        console.error('Failed to parse saved jobs:', error);
      }
    }
  }, []);

  const handleDeploy = async () => {
    if (!walletInfo?.connected) {
      alert('Please connect your wallet first!');
      return;
    }

    const imageValidation = mockNosanaService.validateDockerImage(dockerImage);
    if (!imageValidation.valid) {
      alert(imageValidation.message);
      return;
    }

    setIsDeploying(true);
    setDeploymentResult(null);

    try {
      const result = await mockNosanaService.deployAgent(
        dockerImage,
        walletInfo.publicKey!,
        gpuTier,
        timeoutMinutes
      );

      setDeploymentResult(result);

      if (result.success) {
        // Add new job to the list
        const newJob: DeploymentJob = {
          id: result.jobId!,
          status: 'running',
          endpoint: result.endpoint,
          cost: result.estimatedCost!,
          created: new Date()
        };

        const updatedJobs = [newJob, ...jobs];
        setJobs(updatedJobs);
        
        // Save to localStorage
        localStorage.setItem('nosana-jobs', JSON.stringify(updatedJobs));
      }
    } catch (error) {
      setDeploymentResult({
        success: false,
        message: `Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsDeploying(false);
    }
  };

  const handleViewLogs = async (jobId: string) => {
    if (showLogs === jobId) {
      setShowLogs(null);
      return;
    }

    try {
      const jobStatus = await mockNosanaService.getJobStatus(jobId);
      setShowLogs(jobId);
    } catch (error) {
      console.error('Failed to get job logs:', error);
    }
  };

  const gpuTiers = mockNosanaService.getGPUTiers();
  const estimatedCost = mockNosanaService.calculateJobPrice(gpuTier, timeoutMinutes);
  const imageValidation = mockNosanaService.validateDockerImage(dockerImage);

  return (
    <div className="nosana-deployer">
      <h2>🚀 Deploy to Nosana Network</h2>
      
      {/* Wallet Connection Status */}
      <div className="connection-status">
        {walletInfo?.connected ? (
          <div className="connected">
            <p>✅ Wallet Connected: {walletInfo.publicKey?.slice(0, 4)}...{walletInfo.publicKey?.slice(-4)}</p>
            <p>💰 Balance: {walletInfo.balances.sol} SOL, {walletInfo.balances.nos} NOS</p>
          </div>
        ) : (
          <div className="not-connected">
            <p>⚠️ Please connect your Phantom wallet to deploy</p>
          </div>
        )}
      </div>

      {/* Deployment Form */}
      <div className="deployment-form">
        <div className="form-group">
          <label>🐳 Docker Image:</label>
          <input
            type="text"
            value={dockerImage}
            onChange={(e) => setDockerImage(e.target.value)}
            placeholder="yourusername/agent-challenge:latest"
            className={imageValidation.valid ? 'valid' : 'invalid'}
          />
          <p className={`validation-message ${imageValidation.valid ? 'valid' : 'invalid'}`}>
            {imageValidation.message}
          </p>
        </div>

        <div className="form-group">
          <label>🎮 GPU Tier:</label>
          <select
            value={gpuTier}
            onChange={(e) => setGpuTier(e.target.value as any)}
          >
            {gpuTiers.map(tier => (
              <option key={tier.id} value={tier.id}>
                {tier.name} - {tier.pricePerHour} NOS/hour ({tier.availability} availability)
              </option>
            ))}
          </select>
          <p className="tier-description">
            {gpuTiers.find(t => t.id === gpuTier)?.description}
          </p>
        </div>

        <div className="form-group">
          <label>⏱️ Timeout (minutes):</label>
          <input
            type="number"
            value={timeoutMinutes}
            onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
            min="5"
            max="480"
          />
          <p className="timeout-description">
            Duration: {Math.floor(timeoutMinutes / 60)}h {timeoutMinutes % 60}m
          </p>
        </div>

        <div className="cost-estimate">
          <h3>💸 Estimated Cost</h3>
          <div className="cost-breakdown">
            <p>Duration: {timeoutMinutes} minutes</p>
            <p>GPU Tier: {gpuTiers.find(t => t.id === gpuTier)?.name}</p>
            <p><strong>Total: {estimatedCost} NOS</strong></p>
          </div>
          
          {walletInfo?.connected && (
            <div className={`balance-check ${walletInfo.balances.nos >= estimatedCost ? 'sufficient' : 'insufficient'}`}>
              {walletInfo.balances.nos >= estimatedCost ? (
                <p>✅ Sufficient NOS balance</p>
              ) : (
                <p>⚠️ Need {(estimatedCost - walletInfo.balances.nos).toFixed(2)} more NOS</p>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleDeploy}
          disabled={isDeploying || !walletInfo?.connected || !imageValidation.valid}
          className="deploy-btn"
        >
          {isDeploying ? '🚀 Deploying...' : '🚀 Deploy Agent'}
        </button>
      </div>

      {/* Deployment Result */}
      {deploymentResult && (
        <div className={`deployment-result ${deploymentResult.success ? 'success' : 'error'}`}>
          <h3>{deploymentResult.success ? '✅ Deployment Successful!' : '❌ Deployment Failed'}</h3>
          <p>{deploymentResult.message}</p>
          
          {deploymentResult.success && (
            <div className="success-details">
              <p><strong>Job ID:</strong> {deploymentResult.jobId}</p>
              <p><strong>Endpoint:</strong> <a href={deploymentResult.endpoint} target="_blank" rel="noopener noreferrer">{deploymentResult.endpoint}</a></p>
              <p><strong>Cost:</strong> {deploymentResult.estimatedCost} NOS</p>
            </div>
          )}
        </div>
      )}

      {/* Job History */}
      {jobs.length > 0 && (
        <div className="job-history">
          <h3>📊 Deployment History</h3>
          <div className="jobs-list">
            {jobs.map(job => (
              <div key={job.id} className="job-item">
                <div className="job-header">
                  <div className="job-info">
                    <p><strong>Job ID:</strong> {job.id}</p>
                    <p><strong>Status:</strong> <span className={`status ${job.status}`}>{job.status.toUpperCase()}</span></p>
                    <p><strong>Created:</strong> {job.created.toLocaleString()}</p>
                    <p><strong>Cost:</strong> {job.cost} NOS</p>
                  </div>
                  
                  <div className="job-actions">
                    {job.endpoint && (
                      <a href={job.endpoint} target="_blank" rel="noopener noreferrer" className="endpoint-btn">
                        🔗 Open Agent
                      </a>
                    )}
                    <button
                      onClick={() => handleViewLogs(job.id)}
                      className="logs-btn"
                    >
                      {showLogs === job.id ? '📝 Hide Logs' : '📝 View Logs'}
                    </button>
                  </div>
                </div>
                
                {showLogs === job.id && (
                  <div className="job-logs">
                    <h4>📋 Deployment Logs</h4>
                    <div className="logs-container">
                      {[
                        '[2025-01-09T12:00:00Z] Starting container...',
                        '[2025-01-09T12:00:15Z] Installing dependencies...',
                        '[2025-01-09T12:01:30Z] Building application...',
                        '[2025-01-09T12:02:45Z] Starting server on port 3000...',
                        '[2025-01-09T12:03:00Z] GitHub Insights Agent ready!',
                        '[2025-01-09T12:03:15Z] Listening on port 3000',
                        '[2025-01-09T12:03:30Z] Health check endpoint active',
                      ].map((log, index) => (
                        <div key={index} className="log-line">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


    </div>
  );
};

export default NosanaDeployer; 