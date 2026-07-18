/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import { ethers } from "ethers";
import { Vault, TransactionHistoryEntry } from "./types";

export const LIVE_CONTRACT_ADDRESS = "0x3BD2936Fe8b3965B4325F28eA6e411dfFc8A9063";
export const USDC_TOKEN_ADDRESS = "0x3600000000000000000000000000000000000000";

// USDC Contract Human-Readable ABI
export const USDC_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

// YieldSafe Contract Human-Readable ABI
export const YIELD_SAFE_ABI = [
  "function owner() view returns (address)",
  "function USDC() view returns (address)",
  "function SIMULATED_APY_BPS() view returns (uint256)",
  "function platformFeesAccrued() view returns (uint256)",
  "function totalLiquidity() view returns (uint256)",
  "function getUserVaults(address user) view returns (uint256[])",
  "function getVaultDetails(uint256 vaultId) view returns ((uint256 id, address owner, string goalName, uint256 targetAmount, uint256 targetDate, uint256 principal, uint256 depositedAt, uint256 lastYieldClaim, uint256 yieldAccrued, bool locked, bool closed) vault, uint256 pendingYield, bool goalMet, uint256 progressBps)",
  "function createVault(string goalName, uint256 targetAmount, uint256 targetDate, bool locked, uint256 initialDeposit) returns (uint256)",
  "function deposit(uint256 vaultId, uint256 amount)",
  "function withdraw(uint256 vaultId)",
  "function accrueYield(uint256 vaultId)",
  "function withdrawFees()"
];

// Verify if Web3 provider (MetaMask, OKX, or similar) is injected
export function isWeb3Available(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const anyWin = window as any;
    return !!(
      anyWin.ethereum !== undefined ||
      anyWin.okxwallet !== undefined ||
      anyWin.trustwallet !== undefined ||
      anyWin.coinbaseWalletExtension !== undefined
    );
  } catch (e) {
    console.warn("isWeb3Available check met global restriction or iframe security guard:", e);
    return false;
  }
}

// Convert smart-contract returned Vault tuple or struct to standard TypeScript interface
export function mapBlockchainVault(v: any): Vault {
  return {
    id: Number(v.id),
    owner: v.owner,
    goalName: v.goalName,
    targetAmount: Number(v.targetAmount),
    targetDate: Number(v.targetDate),
    principal: Number(v.principal),
    depositedAt: Number(v.depositedAt),
    lastYieldClaim: Number(v.lastYieldClaim),
    yieldAccrued: Number(v.yieldAccrued),
    locked: v.locked,
    closed: v.closed
  };
}

// Helper to interact with USDC ERC20
export async function getUSDCBalance(
  provider: ethers.BrowserProvider,
  userAddress: string,
  usdcAddress: string = USDC_TOKEN_ADDRESS
): Promise<number> {
  let nativeBalance = 0n;
  let erc20Balance = 0n;

  // 1. Attempt to fetch native gas token balance (as native asset on Arc is USDC, but standard getBalance returns 18 decimals/wei)
  try {
    nativeBalance = await provider.getBalance(userAddress);
  } catch (err) {
    console.warn("Failed to query native token balance gracefully:", err);
  }

  // 2. Attempt to fetch ERC-20 balanceOf (6 decimals)
  try {
    const contract = new ethers.Contract(usdcAddress, USDC_ABI, provider);
    const balance = await contract.balanceOf(userAddress);
    erc20Balance = BigInt(balance);
  } catch (err) {
    console.warn("Failed to query ERC-20 balanceOf gracefully:", err);
  }

  // Convert native balance from 18 decimals (wei) to 6 decimals to match ERC-20 USDC
  const nativeBalanceScaled = nativeBalance / 1_000_000_000_000n;

  // Use the larger / active balance of the two scaled 6-decimal balances
  const finalBalance = erc20Balance > nativeBalanceScaled ? erc20Balance : nativeBalanceScaled;
  return Number(finalBalance);
}

// Check if YieldSafe contract is approved to spend a certain amount of USDC
export async function getUSDCAllowance(
  provider: ethers.BrowserProvider,
  userAddress: string,
  liveContractAddress: string = LIVE_CONTRACT_ADDRESS,
  usdcAddress: string = USDC_TOKEN_ADDRESS
): Promise<number> {
  try {
    const contract = new ethers.Contract(usdcAddress, USDC_ABI, provider);
    const allowance = await contract.allowance(userAddress, liveContractAddress);
    return Number(allowance);
  } catch (err) {
    console.warn("Failed to query USDC allowance gracefully, checking if native-precompile requires no allowance:", err);
    // Return high allowance or 0 depending on failure
    return 0;
  }
}

// Approve USDC spend
export async function approveUSDC(
  signer: ethers.Signer,
  amount: number | bigint,
  liveContractAddress: string = LIVE_CONTRACT_ADDRESS,
  usdcAddress: string = USDC_TOKEN_ADDRESS
): Promise<ethers.TransactionResponse> {
  const contract = new ethers.Contract(usdcAddress, USDC_ABI, signer);
  // Approve a very high allowance to save gas on multiple deposits/creates
  const tx = await contract.approve(liveContractAddress, amount);
  return tx;
}
