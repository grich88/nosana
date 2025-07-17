declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      connect(): Promise<{ publicKey: PublicKey }>;
      disconnect(): Promise<void>;
      isConnected: boolean;
    };
  }
}

export {}; 