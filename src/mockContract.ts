/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { SimulationState, Vault, TransactionHistoryEntry } from "./types";

export const SIMULATED_APY_BPS = 500; // 5% APY
export const BPS_DENOMINATOR = 10000;
export const SECONDS_PER_YEAR = 365 * 24 * 60 * 60; // 31,536,000 seconds
export const EARLY_WITHDRAWAL_PENALTY_BPS = 200; // 2%
export const PLATFORM_FEE_BPS = 1000; // 10%

export const DEFAULT_USER_ADDRESS = "0x9E75D8F04374Be77Ce07E5B374bCEd3FA8867f0f";
export const DEFAULT_OWNER_ADDRESS = "0xa4cEd1EF6089Eb7DE0a221295D34B8dfF4b34F33";
export const USDC_CONTRACT_ADDRESS = "0x3600000000000000000000000000000000000000";

// Generate a random transaction hash
export function generateTxHash(): string {
  const chars = "0123456789abcdef";
  let hash = "0x";
  for (let i = 0; i < 64; i++) {
    hash += chars[Math.floor(Math.random() * chars.length)];
  }
  return hash;
}

// Convert 6-decimal USDC to string display (e.g. 100000000 -> "100.00")
export function formatUSDC(amount: number): string {
  return (amount / 1000000).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

// Helper to compile pending yield for a given vault up to target block timestamp
export function getPendingYield(vault: Vault, currentTimestamp: number): number {
  if (vault.principal <= 0 || vault.closed) return 0;
  
  const elapsed = currentTimestamp - vault.lastYieldClaim;
  if (elapsed <= 0) return 0;

  // Simple interest: principal * APY * elapsed / year
  const yieldAcc = (vault.principal * SIMULATED_APY_BPS * elapsed) / (BPS_DENOMINATOR * SECONDS_PER_YEAR);
  return Math.floor(yieldAcc);
}

// Check if goal is met
export function isGoalMet(vault: Vault, currentTimestamp: number): boolean {
  if (vault.closed) return false;
  const pending = getPendingYield(vault, currentTimestamp);
  const total = vault.principal + vault.yieldAccrued + pending;
  
  const amountGoalMet = total >= vault.targetAmount;
  const dateGoalMet = vault.targetDate > 0 && currentTimestamp >= vault.targetDate;
  
  return amountGoalMet || dateGoalMet;
}

// Get progress BPS (max 10000)
export function getProgressBps(vault: Vault, currentTimestamp: number): number {
  if (vault.targetAmount <= 0) return 0;
  const pending = getPendingYield(vault, currentTimestamp);
  const total = vault.principal + vault.yieldAccrued + pending;
  
  const bps = Math.floor((total * BPS_DENOMINATOR) / vault.targetAmount);
  return Math.min(bps, BPS_DENOMINATOR);
}

// Load initialization state
export function getInitialState(): SimulationState {
  const LOCAL_STORAGE_KEY = "yieldsafe_simulation_state_v1";
  const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as SimulationState;
      // Re-align blockTimestamp if it feels outdated, or let them keep saving state
      return parsed;
    } catch (e) {
      console.error("Failed to parse cached simulation state", e);
    }
  }

  // Create mock genesis timestamp (current time)
  const genesisTimestamp = Math.floor(Date.now() / 1000);

  const genesisState: SimulationState = {
    blockTimestamp: genesisTimestamp,
    blockNumber: 18459203,
    vaults: {},
    userUSDCBalance: 8500 * 1000000, // 8,500.00 USDC
    platformFeesAccrued: 0,
    totalLiquidity: 0,
    ownerAddress: DEFAULT_OWNER_ADDRESS,
    userAddress: DEFAULT_USER_ADDRESS,
    txList: [
      {
        id: "gen-tx-1",
        timestamp: genesisTimestamp,
        type: "SYS_RESET",
        extra: "YieldSafe Savings smart contract successfully deployed to Arc Testnet.",
        txHash: "0x77cf9e9a4cedef18e5b37e8fa6b080f339cf3a6089eb7de0a221295d34b8dff4",
      }
    ],
  };

  // Seed with default vaults to make it immediately interesting
  const demoVaults: Vault[] = [
    {
      id: 1,
      owner: DEFAULT_USER_ADDRESS,
      goalName: "Developer High-End Workstation",
      targetAmount: 3500 * 1000000, // 3,500 USDC
      targetDate: genesisTimestamp + 90 * 24 * 60 * 60, // 90 Days in future
      principal: 1200 * 1000000, // 1,200 USDC
      depositedAt: genesisTimestamp - 15 * 24 * 60 * 60, // 15 days ago
      lastYieldClaim: genesisTimestamp - 15 * 24 * 60 * 60,
      yieldAccrued: 0,
      locked: true,
      closed: false,
    },
    {
      id: 2,
      owner: DEFAULT_USER_ADDRESS,
      goalName: "Arc Testnet Gas Buffer",
      targetAmount: 500 * 1000000, // 500 USDC
      targetDate: 0, // Amount-based only
      principal: 450 * 1000000, // 450 USDC
      depositedAt: genesisTimestamp - 45 * 24 * 60 * 60, // 45 days ago
      lastYieldClaim: genesisTimestamp - 5 * 24 * 60 * 60, // 5 days ago
      yieldAccrued: Math.floor((450 * 1000000 * 500 * (40 * 24 * 60 * 60)) / (10000 * SECONDS_PER_YEAR)), // accrued first 40 days
      locked: false,
      closed: false,
    }
  ];

  for (const v of demoVaults) {
    genesisState.vaults[v.id] = v;
    genesisState.totalLiquidity += v.principal;
  }

  // Record mock deposits
  genesisState.txList.push({
    id: "gen-tx-2",
    timestamp: genesisTimestamp - 15 * 24 * 60 * 60,
    type: "CREATE",
    vaultId: 1,
    vaultName: "Developer High-End Workstation",
    amount: 1200 * 1000000,
    extra: "Vault #1 created with 1,200 USDC initial locked deposit.",
    txHash: generateTxHash(),
  });

  genesisState.txList.push({
    id: "gen-tx-3",
    timestamp: genesisTimestamp - 45 * 24 * 60 * 60,
    type: "CREATE",
    vaultId: 2,
    vaultName: "Arc Testnet Gas Buffer",
    amount: 450 * 1000000,
    extra: "Vault #2 created with 450 USDC initial unlocked deposit.",
    txHash: generateTxHash(),
  });

  saveState(genesisState);
  return genesisState;
}

export function saveState(state: SimulationState) {
  const LOCAL_STORAGE_KEY = "yieldsafe_simulation_state_v1";
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
}

// ──────────────── CONST VALUE ACTIONS ────────────────

export function resetSimulation(): SimulationState {
  localStorage.removeItem("yieldsafe_simulation_state_v1");
  return getInitialState();
}

/**
 * Create a Vault
 */
export function createVault(
  state: SimulationState,
  goalName: string,
  targetAmount: number, // 6 decimals
  targetDate: number, // unix stamp
  locked: boolean,
  initialDeposit: number // 6 decimals
): { state: SimulationState; error?: string; vaultId?: number } {
  if (!goalName.trim()) {
    return { state, error: "Goal name is required and cannot be empty" };
  }
  if (targetAmount < 1 * 1000000) {
    return { state, error: "Min target amount is 1 USDC (1,000,000 micro-USDC)" };
  }
  if (targetDate !== 0 && targetDate <= state.blockTimestamp) {
    return { state, error: "Target date must be in the future relative to the current block timestamp" };
  }
  if (initialDeposit > 0 && initialDeposit < 1 * 1000000) {
    return { state, error: "Min initial deposit is 1 USDC if depositing" };
  }
  if (initialDeposit > state.userUSDCBalance) {
    return { state, error: "Insufficient USDC balance in wallet for initial deposit" };
  }

  const nextId = Object.keys(state.vaults).length > 0 
    ? Math.max(...Object.keys(state.vaults).map(Number)) + 1 
    : 1;

  const newVault: Vault = {
    id: nextId,
    owner: state.userAddress,
    goalName: goalName.trim(),
    targetAmount,
    targetDate,
    principal: 0,
    depositedAt: 0,
    lastYieldClaim: 0,
    yieldAccrued: 0,
    locked,
    closed: false,
  };

  const updatedVaults = { ...state.vaults };
  updatedVaults[nextId] = newVault;

  let userUSDCBalance = state.userUSDCBalance;
  let totalLiquidity = state.totalLiquidity;
  const blockNumber = state.blockNumber + 1;
  const txList = [...state.txList];

  const txHash = generateTxHash();
  txList.unshift({
    id: `tx-${txHash}`,
    timestamp: state.blockTimestamp,
    type: "CREATE",
    vaultId: nextId,
    vaultName: goalName,
    amount: initialDeposit,
    extra: `Goal Vault #${nextId} established: "${goalName}" | Target: ${formatUSDC(targetAmount)} USDC | ${locked ? "Locked" : "Unlocked"}.`,
    txHash,
  });

  const nextState: SimulationState = {
    ...state,
    blockNumber,
    vaults: updatedVaults,
    userUSDCBalance,
    totalLiquidity,
    txList,
  };

  if (initialDeposit > 0) {
    // Perform simulated deposit
    return deposit(nextState, nextId, initialDeposit);
  }

  saveState(nextState);
  return { state: nextState, vaultId: nextId };
}

/**
 * Deposit USDC into existing vault
 */
export function deposit(
  state: SimulationState,
  vaultId: number,
  amount: number // 6 decimals
): { state: SimulationState; error?: string } {
  const vault = state.vaults[vaultId];
  if (!vault) {
    return { state, error: `Vault #${vaultId} not found` };
  }
  if (vault.closed) {
    return { state, error: "Vault is already closed" };
  }
  if (amount < 1 * 1000000) {
    return { state, error: "Minimum deposit is 1 USDC" };
  }
  if (amount > state.userUSDCBalance) {
    return { state, error: "Insufficient USDC balance in wallet" };
  }

  // Create deep copy of vault
  const v = { ...vault };

  // 1. Accrue existing yield before updating principal
  if (v.principal > 0) {
    const pending = getPendingYield(v, state.blockTimestamp);
    v.yieldAccrued += pending;
    v.lastYieldClaim = state.blockTimestamp;
  } else {
    v.depositedAt = state.blockTimestamp;
    v.lastYieldClaim = state.blockTimestamp;
  }

  // 2. Transfer funds
  v.principal += amount;
  
  const updatedVaults = { ...state.vaults };
  updatedVaults[vaultId] = v;

  const userUSDCBalance = state.userUSDCBalance - amount;
  const totalLiquidity = state.totalLiquidity + amount;
  const blockNumber = state.blockNumber + 1;
  const txList = [...state.txList];

  const txHash = generateTxHash();
  txList.unshift({
    id: `tx-${txHash}`,
    timestamp: state.blockTimestamp,
    type: "DEPOSIT",
    vaultId,
    vaultName: v.goalName,
    amount,
    extra: `Deposited ${formatUSDC(amount)} USDC into Vault #${vaultId}. New Principal: ${formatUSDC(v.principal)} USDC.`,
    txHash,
  });

  const nextState: SimulationState = {
    ...state,
    blockNumber,
    vaults: updatedVaults,
    userUSDCBalance,
    totalLiquidity,
    txList,
  };

  saveState(nextState);
  return { state: nextState };
}

/**
 * Manually accrue yield
 */
export function accrueYield(
  state: SimulationState,
  vaultId: number
): { state: SimulationState; error?: string; accruedPaid?: number } {
  const vault = state.vaults[vaultId];
  if (!vault) {
    return { state, error: `Vault #${vaultId} not found` };
  }
  if (vault.closed) {
    return { state, error: "Vault is already closed" };
  }
  if (vault.principal <= 0) {
    return { state, error: "Vault has zero principal; no yield to accrue" };
  }

  const elapsed = state.blockTimestamp - vault.lastYieldClaim;
  if (elapsed <= 0) {
    return { state, error: "No time has elapsed since the last yield accrual" };
  }

  const v = { ...vault };
  const pending = getPendingYield(v, state.blockTimestamp);
  
  v.yieldAccrued += pending;
  v.lastYieldClaim = state.blockTimestamp;

  const updatedVaults = { ...state.vaults };
  updatedVaults[vaultId] = v;

  const blockNumber = state.blockNumber + 1;
  const txList = [...state.txList];

  const txHash = generateTxHash();
  txList.unshift({
    id: `tx-${txHash}`,
    timestamp: state.blockTimestamp,
    type: "ACCRUE",
    vaultId,
    vaultName: v.goalName,
    extra: `Manual Yield Accrued on Vault #${vaultId}. Compound Increase: +${formatUSDC(pending)} USDC. Total Accrued: ${formatUSDC(v.yieldAccrued)} USDC.`,
    txHash,
  });

  const nextState: SimulationState = {
    ...state,
    blockNumber,
    vaults: updatedVaults,
    txList,
  };

  saveState(nextState);
  return { state: nextState, accruedPaid: pending };
}

/**
 * Withdraw from Vault
 */
export function withdraw(
  state: SimulationState,
  vaultId: number
): { state: SimulationState; error?: string; payoutDetails?: { payout: number; penalty: number; yieldAccruedSpent: number; platformFee: number } } {
  const vault = state.vaults[vaultId];
  if (!vault) {
    return { state, error: `Vault #${vaultId} not found` };
  }
  if (vault.closed) {
    return { state, error: "Vault is already closed" };
  }
  if (vault.principal <= 0) {
    return { state, error: "Nothing to withdraw" };
  }

  // Deep copy the vault
  const v = { ...vault };

  // 1. Force accrue latest yield up to current simulated block timestamp
  const pending = getPendingYield(v, state.blockTimestamp);
  v.yieldAccrued += pending;
  v.lastYieldClaim = state.blockTimestamp;

  const wasGoalMet = (v.principal + v.yieldAccrued >= v.targetAmount) ||
                     (v.targetDate > 0 && state.blockTimestamp >= v.targetDate);

  const earlyExit = v.locked && !wasGoalMet;

  let penalty = 0;
  let yieldPayout = v.yieldAccrued;
  let platformCut = 0;
  let nextPlatformFeesAccrued = state.platformFeesAccrued;

  if (earlyExit) {
    // 2% penalty is taken on principal
    penalty = Math.floor((v.principal * EARLY_WITHDRAWAL_PENALTY_BPS) / BPS_DENOMINATOR);
    // yield is sacrificed if locked early exit
    yieldPayout = 0;
    // penalty plus lost yield goes to contract fees list
    nextPlatformFeesAccrued += penalty + v.yieldAccrued;
  } else {
    // normal platform takes 10% on yield
    platformCut = Math.floor((yieldPayout * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);
    nextPlatformFeesAccrued += platformCut;
    yieldPayout -= platformCut;
  }

  const payout = v.principal - penalty + yieldPayout;

  const oldPrincipal = v.principal;
  const totalAccruedRecord = v.yieldAccrued;

  // Mark vault has closed & clean balances
  v.principal = 0;
  v.yieldAccrued = 0;
  v.closed = true;

  const updatedVaults = { ...state.vaults };
  updatedVaults[vaultId] = v;

  const userUSDCBalance = state.userUSDCBalance + payout;
  const totalLiquidity = state.totalLiquidity - oldPrincipal; // the contract holds principal
  const blockNumber = state.blockNumber + 1;
  const txList = [...state.txList];

  const txHash = generateTxHash();
  txList.unshift({
    id: `tx-${txHash}`,
    timestamp: state.blockTimestamp,
    type: "WITHDRAW",
    vaultId,
    vaultName: v.goalName,
    amount: payout,
    extra: `Withdrew from Vault #${vaultId}. Was early exit? ${earlyExit ? "YES" : "NO"}. Principal: ${formatUSDC(oldPrincipal)} USDC. Penalty Deducted: ${formatUSDC(penalty)} USDC. Net Yield Received: ${formatUSDC(yieldPayout)} USDC (after ${formatUSDC(platformCut)} USDC Platform Fee). Total Payout: ${formatUSDC(payout)} USDC. Vault Closed successfully.`,
    txHash,
  });

  const nextState: SimulationState = {
    ...state,
    blockNumber,
    vaults: updatedVaults,
    userUSDCBalance,
    totalLiquidity,
    platformFeesAccrued: nextPlatformFeesAccrued,
    txList,
  };

  saveState(nextState);
  return { 
    state: nextState, 
    payoutDetails: {
      payout,
      penalty,
      yieldAccruedSpent: totalAccruedRecord,
      platformFee: platformCut
    }
  };
}

/**
 * Fast forward time inside the blockchain node simulation
 */
export function fastForwardTime(
  state: SimulationState,
  seconds: number
): SimulationState {
  if (seconds <= 0) return state;

  const blockTimestamp = state.blockTimestamp + seconds;
  // Increase block number by roughly 1 block per 12 seconds
  const addedBlocks = Math.max(1, Math.floor(seconds / 12));
  const blockNumber = state.blockNumber + addedBlocks;

  const nextState: SimulationState = {
    ...state,
    blockTimestamp,
    blockNumber,
  };

  saveState(nextState);
  return nextState;
}

/**
 * Admin: Withdraw Platform Fees (OnlyContract Owner)
 */
export function adminWithdrawFees(state: SimulationState): { state: SimulationState; error?: string; claimed?: number } {
  if (state.platformFeesAccrued <= 0) {
    return { state, error: "No platform fees accrued to withdraw" };
  }

  const claimed = state.platformFeesAccrued;
  // Since we withtdraw platform fees, the owner claims them. In our simulation, the user can act as owner to withdraw fees!
  // To keep the dApp fun, let's credit the user's wallet (acting as contract manager/admin)
  const userUSDCBalance = state.userUSDCBalance + claimed;
  const blockNumber = state.blockNumber + 1;
  const txList = [...state.txList];

  const txHash = generateTxHash();
  txList.unshift({
    id: `tx-${txHash}`,
    timestamp: state.blockTimestamp,
    type: "FEES_WITHDRAWAL",
    amount: claimed,
    extra: `Admin withdrew platform fees of ${formatUSDC(claimed)} USDC to administrative account.`,
    txHash,
  });

  const nextState: SimulationState = {
    ...state,
    blockNumber,
    platformFeesAccrued: 0,
    userUSDCBalance,
    txList,
  };

  saveState(nextState);
  return { state: nextState, claimed };
}
