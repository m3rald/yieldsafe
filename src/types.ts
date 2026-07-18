/**
 * @license
 * SPDX-License-Identifier: MIT
 */

export interface Vault {
  id: number;
  owner: string;
  goalName: string;
  targetAmount: number; // in USDC (6 decimals, e.g. 100,000,000 = 100 USDC)
  targetDate: number;   // unix timestamp, 0 = amount-only
  principal: number;    // USDC (6 decimals)
  depositedAt: number;  // timestamp of first deposit
  lastYieldClaim: number; // timestamp of last accrue
  yieldAccrued: number; // USDC (6 decimals)
  locked: boolean;      // true = locked until target met
  closed: boolean;     // true = withdrawn & done
}

export interface TransactionHistoryEntry {
  id: string; // unique UUID or string
  timestamp: number; // unix timestamp of transaction
  type: 'CREATE' | 'DEPOSIT' | 'ACCRUE' | 'WITHDRAW' | 'SYS_RESET' | 'FEES_WITHDRAWAL';
  vaultId?: number;
  vaultName?: string;
  amount?: number; // value in USDC units (6 decimals)
  extra?: string; // further details like wallet address, accrued amount, penalty, platform cut
  txHash: string; // simulated hex tx hash
}

export interface SimulationState {
  blockTimestamp: number; // current simulated block.timestamp
  blockNumber: number; // simulated block number
  vaults: Record<number, Vault>;
  userUSDCBalance: number; // how much USDC user has in wallet (6 decimals)
  platformFeesAccrued: number; // how much fees owner can claim (6 decimals)
  totalLiquidity: number; // total USDC in contract (6 decimals)
  ownerAddress: string; // contract owner address
  userAddress: string; // active user address
  txList: TransactionHistoryEntry[];
}
