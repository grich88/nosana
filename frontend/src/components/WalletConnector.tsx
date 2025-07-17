import React, { useState, useEffect } from 'react';
import './WalletConnector.css';

interface WalletInfo {
  connected: boolean;
  publicKey: string | null;
  balances: {
    sol: number;
    nos: number;
  };
}

interface DeploymentCost {
  estimatedCostSOL: number;
  estimatedCostNOS: number;
  duration: string;
  gpuTier: string;
}

interface WalletConnectorProps {
  onWalletConnect: (walletInfo: WalletInfo) => void;
  onWalletDisconnect: () => void;
}

const WalletConnector: React.FC<WalletConnectorProps> = ({
  onWalletConnect,
  onWalletDisconnect
}) => {
  const [wallet, setWallet] = useState<WalletInfo>({
    connected: false,
    publicKey: null,
    balances: { sol: 0, nos: 0 }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showFaucetInfo, setShowFaucetInfo] = useState(false);

  // Mock wallet service functions (since we can't import from backend)
  const mockWalletService = {
    connectWallet: async (): Promise<WalletInfo> => {
      // Simulate wallet connection
      await new Promise(resolve => setTimeout(resolve, 1000));
      return {
        connected: true,
        publicKey: 'HrKZNfMZ8YfGhUwqGY4eR6xA7xgzKWQP8JK6yzw5XvwV',
        balances: { sol: 0.245, nos: 12.5 }
      };
    },
    
    disconnectWallet: async (): Promise<void> => {
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    
    formatAddress: (address: string): string => {
      if (!address) return '';
      return `${address.slice(0, 4)}...${address.slice(-4)}`;
    },
    
    calculateDeploymentCost: (duration: number = 24, gpuTier: 'basic' | 'standard' | 'premium' = 'basic'): DeploymentCost => {
      const hourlyRates = {
        basic: { sol: 0.001, nos: 0.5 },
        standard: { sol: 0.003, nos: 1.5 },
        premium: { sol: 0.005, nos: 2.5 }
      };
      
      const rate = hourlyRates[gpuTier];
      return {
        estimatedCostSOL: rate.sol * duration,
        estimatedCostNOS: rate.nos * duration,
        duration: `${duration} hours`,
        gpuTier
      };
    },
    
    checkSufficientBalance: (
      userBalances: { sol: number; nos: number },
      deploymentCost: DeploymentCost
    ) => {
      const missingSol = Math.max(0, deploymentCost.estimatedCostSOL - userBalances.sol);
      const missingNos = Math.max(0, deploymentCost.estimatedCostNOS - userBalances.nos);
      
      return {
        sufficient: missingSol === 0 && missingNos === 0,
        missing: { sol: missingSol, nos: missingNos }
      };
    },
    
    getFaucetInfo: () => ({
      discordChannel: '#nosana-challenge-faucet',
      instructions: [
        '1. Join the Nosana Discord server',
        '2. Navigate to #nosana-challenge-faucet channel',
        '3. Request NOS and SOL tokens',
        '4. Include your GitHub repository link as proof',
        '5. Wait for tokens to be sent to your wallet'
      ],
      requirements: [
        'Active participation in Nosana Builders Challenge',
        'Valid GitHub repository with AI agent code',
        'Phantom wallet address',
        'Legitimate development project (no spam)'
      ]
    })
  };

  const handleConnect = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Check if Phantom is installed
      if (!(window as any).solana?.isPhantom) {
        throw new Error('Phantom wallet not found! Please install the Phantom browser extension.');
      }

      const walletInfo = await mockWalletService.connectWallet();
      setWallet(walletInfo);
      onWalletConnect(walletInfo);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    
    try {
      await mockWalletService.disconnectWallet();
      const disconnectedWallet = {
        connected: false,
        publicKey: null,
        balances: { sol: 0, nos: 0 }
      };
      setWallet(disconnectedWallet);
      onWalletDisconnect();
    } catch (err) {
      console.error('Disconnect error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshBalance = async () => {
    if (!wallet.connected || !wallet.publicKey) return;
    
    setIsLoading(true);
    try {
      // Simulate balance refresh
      await new Promise(resolve => setTimeout(resolve, 1000));
      const updatedWallet = { ...wallet, balances: { sol: 0.298, nos: 15.2 } };
      setWallet(updatedWallet);
      onWalletConnect(updatedWallet);
    } catch (err) {
      setError('Failed to refresh balance');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate deployment cost for display
  const deploymentCost = mockWalletService.calculateDeploymentCost(24, 'basic');
  const balanceCheck = wallet.connected 
    ? mockWalletService.checkSufficientBalance(wallet.balances, deploymentCost)
    : null;

  return (
    <div className="wallet-connector">
      <div className="wallet-status">
        <h3>🌟 Nosana Wallet</h3>
        
        {!wallet.connected ? (
          <div className="connect-section">
            <p>Connect your Phantom wallet to deploy agents on Nosana</p>
            <button 
              onClick={handleConnect}
              disabled={isLoading}
              className="connect-btn"
            >
              {isLoading ? '🔄 Connecting...' : '👻 Connect Phantom Wallet'}
            </button>
            
            {error && (
              <div className="error-message">
                <p>❌ {error}</p>
                {error.includes('Phantom wallet not found') && (
                  <a 
                    href="https://phantom.app" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="install-link"
                  >
                    📥 Install Phantom Wallet
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="connected-section">
            <div className="wallet-info">
              <p><strong>🔗 Connected:</strong> {mockWalletService.formatAddress(wallet.publicKey || '')}</p>
              
              <div className="balance-section">
                <h4>💰 Token Balances</h4>
                <div className="balances">
                  <div className="balance-item">
                    <span>◎ SOL:</span>
                    <span className="balance-value">{wallet.balances.sol.toFixed(4)}</span>
                  </div>
                  <div className="balance-item">
                    <span>🚀 NOS:</span>
                    <span className="balance-value">{wallet.balances.nos.toFixed(2)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleRefreshBalance}
                  disabled={isLoading}
                  className="refresh-btn"
                >
                  {isLoading ? '🔄' : '🔄 Refresh'}
                </button>
              </div>

              {/* Deployment Cost Analysis */}
              <div className="deployment-cost">
                <h4>💸 Deployment Cost (24h)</h4>
                <div className="cost-breakdown">
                  <div className="cost-item">
                    <span>◎ SOL Required:</span>
                    <span>{deploymentCost.estimatedCostSOL.toFixed(4)}</span>
                  </div>
                  <div className="cost-item">
                    <span>🚀 NOS Required:</span>
                    <span>{deploymentCost.estimatedCostNOS.toFixed(2)}</span>
                  </div>
                </div>
                
                {balanceCheck && (
                  <div className={`balance-status ${balanceCheck.sufficient ? 'sufficient' : 'insufficient'}`}>
                    {balanceCheck.sufficient ? (
                      <p>✅ Sufficient balance for deployment!</p>
                    ) : (
                      <div className="insufficient-balance">
                        <p>⚠️ Insufficient balance for deployment</p>
                        <div className="missing-tokens">
                          {balanceCheck.missing.sol > 0 && (
                            <p>Need {balanceCheck.missing.sol.toFixed(4)} more SOL</p>
                          )}
                          {balanceCheck.missing.nos > 0 && (
                            <p>Need {balanceCheck.missing.nos.toFixed(2)} more NOS</p>
                          )}
                        </div>
                        <button 
                          onClick={() => setShowFaucetInfo(!showFaucetInfo)}
                          className="faucet-btn"
                        >
                          🚰 Get Tokens from Faucet
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Faucet Instructions */}
              {showFaucetInfo && (
                <div className="faucet-info">
                  <h4>🚰 Token Faucet Instructions</h4>
                  <p><strong>Discord Channel:</strong> {mockWalletService.getFaucetInfo().discordChannel}</p>
                  
                  <div className="instructions">
                    <h5>Steps:</h5>
                    <ol>
                      {mockWalletService.getFaucetInfo().instructions.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  
                  <div className="requirements">
                    <h5>Requirements:</h5>
                    <ul>
                      {mockWalletService.getFaucetInfo().requirements.map((req, index) => (
                        <li key={index}>{req}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <a 
                    href="https://discord.gg/nosana" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="discord-link"
                  >
                    💬 Join Nosana Discord
                  </a>
                </div>
              )}

              <div className="wallet-actions">
                <button 
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="disconnect-btn"
                >
                  🔌 Disconnect
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletConnector; 