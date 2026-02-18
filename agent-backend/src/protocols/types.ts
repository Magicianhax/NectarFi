export interface ProtocolAdapter {
  name: string;
  supply(asset: string, amount: bigint, walletAddress: `0x${string}`, sendTx: SendTxFn): Promise<string>;
  withdraw(asset: string, amount: bigint, walletAddress: `0x${string}`, sendTx: SendTxFn): Promise<string>;
  getBalance(asset: string, walletAddress: `0x${string}`): Promise<bigint>;
  getApy(asset: string): Promise<number>;
}

// Function type for sending transactions via Privy
export type SendTxFn = (tx: {
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
}) => Promise<string>; // returns tx hash
