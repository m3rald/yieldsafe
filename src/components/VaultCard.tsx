/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from "react";
import { Link, Shield, Award, Calendar, ChevronRight, CheckCircle2, Lock, ArrowUpRight, Zap, RefreshCw, Sparkles, Coins, AlertTriangle } from "lucide-react";
import { Vault, SimulationState } from "../types";
import { formatUSDC, getPendingYield, getProgressBps, isGoalMet, SIMULATED_APY_BPS, SECONDS_PER_YEAR, BPS_DENOMINATOR, EARLY_WITHDRAWAL_PENALTY_BPS, PLATFORM_FEE_BPS } from "../mockContract";

interface VaultCardProps {
  key?: any;
  vault: Vault;
  simulationTimestamp: number;
  walletBalance: number;
  onDeposit: (vaultId: number, amount: number) => void;
  onAccrueYield: (vaultId: number) => void;
  onWithdraw: (vaultId: number) => void;
  // Web3 Integration
  stateMode: "simulation" | "testnet";
  web3Allowance: number;
}

export default function VaultCard({
  vault,
  simulationTimestamp,
  walletBalance,
  onDeposit,
  onAccrueYield,
  onWithdraw,
  stateMode,
  web3Allowance
}: VaultCardProps) {
  // Collapsible actions states
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositError, setDepositError] = useState("");
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);


  // Live ticking state
  const [liveTimestamp, setLiveTimestamp] = useState(simulationTimestamp);
  
  // Real-time tick hook
  useEffect(() => {
    setLiveTimestamp(simulationTimestamp);
    
    // Setup a high-resolution interval to simulate progression of block times
    const startReal = Date.now();
    const interval = setInterval(() => {
      const deltaSec = (Date.now() - startReal) / 1000;
      setLiveTimestamp(simulationTimestamp + deltaSec);
    }, 100);

    return () => clearInterval(interval);
  }, [simulationTimestamp]);

  // Calc live quantities based on ticking timestamp
  const principal = vault.principal;
  const closed = vault.closed;

  const currentPending = closed ? 0 : getPendingYield(vault, liveTimestamp);
  const totalSavings = principal + vault.yieldAccrued + currentPending;
  const targetCompleted = closed ? false : isGoalMet(vault, liveTimestamp);
  const progressBps = closed ? 0 : getProgressBps(vault, liveTimestamp);
  const progressPercent = (progressBps / 100).toFixed(1);

  // Checks for penalty info
  const earlyExitPenaltyApplies = vault.locked && !targetCompleted && !closed;
  const potentialPenalty = Math.floor((principal * EARLY_WITHDRAWAL_PENALTY_BPS) / BPS_DENOMINATOR);
  const potentialPlatformCut = Math.floor(((vault.yieldAccrued + currentPending) * PLATFORM_FEE_BPS) / BPS_DENOMINATOR);
  const estimatedPayout = earlyExitPenaltyApplies 
    ? (principal - potentialPenalty) 
    : (principal + (vault.yieldAccrued + currentPending) - potentialPlatformCut);

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError("");

    const parsedAmt = parseFloat(depositAmount);
    if (isNaN(parsedAmt) || parsedAmt < 1) {
      setDepositError("Minimum deposit is 1 USDC");
      return;
    }

    if (parsedAmt * 1000000 > walletBalance) {
      setDepositError("Insufficient USDC wallet balance");
      return;
    }

    onDeposit(vault.id, Math.floor(parsedAmt * 1000000));
    setDepositAmount("");
    setShowDepositForm(false);
  };

  const handleAccrueClick = () => {
    onAccrueYield(vault.id);
  };

  const handleWithdrawClick = () => {
    if (earlyExitPenaltyApplies && !withdrawConfirm) {
      setWithdrawConfirm(true);
    } else {
      onWithdraw(vault.id);
      setWithdrawConfirm(false);
    }
  };

  // Human readable representations
  const formattedPrincipal = formatUSDC(vault.principal);
  const formattedAccruedOnChain = formatUSDC(vault.yieldAccrued);
  const formattedLivePending = (currentPending / 1000000).toFixed(6);
  const formattedTotalSavings = (totalSavings / 1000000).toFixed(6);
  const formattedTarget = formatUSDC(vault.targetAmount);

  const daysLeft = (vault.targetDate > 0 && !closed)
    ? Math.max(0, Math.ceil((vault.targetDate - liveTimestamp) / 86400))
    : 0;

  return (
    <div 
      className={`crystal-panel crystal-panel-interactive rounded-3xl p-6 shadow-2xl transition-all duration-300 flex flex-col justify-between relative overflow-hidden group border ${
        closed 
          ? "border-zinc-900/60 opacity-50 hover:opacity-70 saturate-50 bg-zinc-950/40" 
          : targetCompleted 
            ? "border-teal-500/40 bg-gradient-to-br from-teal-950/20 via-zinc-900/40 to-zinc-950/90 shadow-[0_12px_4px_-10px_rgba(13,148,136,0.25)]" 
            : "border-white/10 hover:border-teal-500/25"
      }`}
      id={`vault-card-${vault.id}`}
    >
      {/* Decorative ambient glowing point inside the card on hover */}
      <div className="absolute -top-12 -right-12 w-24 h-24 bg-teal-600/10 rounded-full blur-xl group-hover:bg-teal-500/20 transition-all duration-300 pointer-events-none" />
      
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-4 relative z-10">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-[9px] px-2 py-0.5 font-mono font-medium uppercase rounded-md tracking-wider border ${
                closed 
                  ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                  : targetCompleted
                    ? "bg-teal-950/50 text-teal-400 border-teal-900/50 font-bold"
                    : "bg-zinc-950 text-zinc-400 border-zinc-800"
              }`}>
                Vault #{vault.id}
              </span>
              
              {vault.locked ? (
                <span className="text-[9px] px-2 py-0.5 flex items-center gap-1 font-sans font-bold uppercase tracking-wider text-amber-400 bg-amber-950/40 border border-amber-900/50 rounded-md">
                  <Shield size={9} className="text-amber-400" /> Locked
                </span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 flex items-center gap-1 font-sans font-bold uppercase tracking-wider text-teal-400 bg-teal-950/40 border border-teal-900/50 rounded-md">
                  <Award size={9} className="text-teal-400" /> Flexible
                </span>
              )}
            </div>
            <h4 className="text-base font-black text-white font-display tracking-tight leading-tight mt-1.5 truncate max-w-[210px]" title={vault.goalName}>
              {vault.goalName}
            </h4>
          </div>

          <div className="flex-shrink-0 text-right">
            {closed ? (
              <span className="text-xs font-semibold text-zinc-500 flex items-center gap-1 font-sans uppercase tracking-wider">
                Closed
              </span>
            ) : targetCompleted ? (
              <span className="text-xs font-black text-teal-400 flex items-center gap-1 font-display uppercase tracking-wider animate-pulse">
                <CheckCircle2 size={13} fill="currentColor" className="text-zinc-950" /> Target Met!
              </span>
            ) : (
              <span className="text-xs font-bold text-teal-500/80 font-sans uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-ping" />
                Active
              </span>
            )}
          </div>
        </div>

        {/* Primary Savings Display */}
        <div className="bg-zinc-950/60 border border-white/5 rounded-2xl p-4 mb-4 flex items-center justify-between shadow-inner relative z-10">
          <div className="space-y-0.5">
            <span className="text-[9px] text-zinc-500 uppercase font-extrabold font-mono tracking-widest">SAVINGS LEDGER</span>
            <div className="flex items-baseline gap-1" title={`${totalSavings / 1000000} USDC`}>
              <span className="text-2xl font-black font-mono text-white tracking-tight">
                {closed ? "0.00" : formattedTotalSavings}
              </span>
              <span className="text-xs font-extrabold text-teal-500 font-mono">USDC</span>
            </div>
          </div>
          
          <div className="text-right space-y-0.5">
            <span className="text-[9px] text-zinc-500 uppercase font-extrabold font-mono tracking-widest">YIELD RATE</span>
            <p className="text-sm font-black text-white text-glow-teal font-mono flex items-center gap-0.5 justify-end">
              <Zap size={11} className="text-teal-500 fill-teal-500/30" /> 5.00%
            </p>
          </div>
        </div>

        {/* Progress Bar and Targets */}
        {!closed && (
          <div className="space-y-2 mb-4 relative z-10">
            <div className="flex justify-between items-baseline text-xs font-sans">
              <span className="text-zinc-400 font-medium font-sans">Progress: <strong className="text-white font-mono">{progressPercent}%</strong></span>
              <span className="text-zinc-300 font-mono text-[11px]">
                {formatUSDC(vault.principal)} / {formattedTarget} <span className="text-[10px] text-zinc-500">Target</span>
              </span>
            </div>
            {/* Progress tracks percentage */}
            <div className="w-full bg-zinc-950 h-2.5 rounded-full overflow-hidden border border-white/5 p-0.5">
              <div 
                className="h-full bg-gradient-to-r from-teal-650 via-teal-500 to-sky-500 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(13,148,136,0.5)]"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* Time constraints */}
            {vault.targetDate > 0 && (
              <p className="text-[10px] text-zinc-400 flex items-center gap-1.5 font-sans pt-0.5">
                <Calendar size={11} className="text-zinc-500" />
                <span>Locked until: <strong className="font-mono text-zinc-300">{new Date(vault.targetDate * 1000).toLocaleDateString()}</strong></span>
                {daysLeft > 0 ? (
                  <span className="text-amber-400 font-semibold">({daysLeft}d left)</span>
                ) : (
                  <span className="text-teal-400 font-bold">(Goal Matures)</span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Breakdown details */}
        {!closed && (
          <div className="border-t border-b border-white/5 py-3.5 space-y-2 text-xs mb-4 relative z-10 font-sans">
            <div className="flex justify-between font-sans text-zinc-400">
              <span>Principal Deposit</span>
              <span className="text-white font-mono font-medium">{formattedPrincipal} USDC</span>
            </div>
            <div className="flex justify-between font-sans text-zinc-400">
              <span className="flex items-center gap-1">
                Yield Locked On-Chain
              </span>
              <span className="text-white font-mono font-medium">+{formattedAccruedOnChain} USDC</span>
            </div>
            
            <div className="flex justify-between font-sans items-center text-zinc-400">
              <span>Un-acrued Pending Yield</span>
              <div className="flex items-center gap-1.5">
                <span className="text-teal-400 font-mono font-bold">+{formattedLivePending} USDC</span>
                {currentPending > 0 && (
                  <button
                    onClick={handleAccrueClick}
                    className="p-1 text-[9px] font-black text-teal-400 hover:text-white bg-teal-950/20 hover:bg-teal-600 rounded border border-teal-900/50 transition cursor-pointer"
                    title="Accrue Yield On-chain"
                    id={`btn-accrue-onchain-${vault.id}`}
                  >
                    <RefreshCw size={9} className="animate-spin-slow" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* FOOTER ACTIONS */}
      <div className="space-y-2.5 mt-auto relative z-10">
        {/* Warnings and alerts based on settings */}
        {withdrawConfirm && earlyExitPenaltyApplies && (
          <div className="bg-teal-950/40 border border-teal-900/60 rounded-2xl p-3.5 text-[11px] text-teal-200 leading-normal font-sans animation-fade-in mb-2">
            <div className="flex items-start gap-1.5 mb-2">
              <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <span className="font-black text-amber-300 uppercase tracking-wide">Early Exit Fine Warning!</span>
            </div>
            Breaking this locked vault before maturation results in a <strong className="text-white">2.00% fine on your principal</strong>.
            <div className="grid grid-cols-1 gap-1 text-zinc-350 font-mono mt-2.5 border-t border-teal-900/40 pt-2 text-[10px]">
              <div>Principal: {formattedPrincipal} USDC</div>
              <div className="text-amber-400">Penalty: -{formatUSDC(potentialPenalty)} USDC</div>
              <div className="text-amber-500">Yield Sacrificed: -{(vault.yieldAccrued + currentPending) / 1000000} USDC</div>
              <div className="text-emerald-400 font-black text-xs mt-1">Payout: {formatUSDC(estimatedPayout)} USDC</div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setWithdrawConfirm(false)}
                className="px-3 py-1 bg-zinc-950 hover:bg-zinc-900 text-[10px] font-bold rounded-lg text-zinc-300 border border-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleWithdrawClick}
                className="px-3 py-1 bg-teal-600 hover:bg-teal-500 text-[10px] font-extrabold rounded-lg text-white font-display uppercase tracking-wider transition cursor-pointer"
                id={`btn-confirm-early-withdraw-${vault.id}`}
              >
                Break Vault
              </button>
            </div>
          </div>
        )}

        {/* Collapsible Deposit Input Field */}
        {showDepositForm && !closed && (
          <form onSubmit={handleDepositSubmit} className="space-y-2 p-3 bg-zinc-950/80 rounded-2xl border border-white/5 animate-fade-in mb-2 shadow-inner">
            <span className="text-[9px] uppercase font-bold text-zinc-500 font-mono tracking-widest pl-0.5">Deposit Amount</span>
            <div className="flex gap-2 items-center">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  step="any"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full pl-3 pr-14 py-2 bg-zinc-900/60 border border-zinc-800 rounded-xl focus:outline-none focus:border-teal-500 text-xs text-white font-mono"
                  id={`input-deposit-amount-${vault.id}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold text-teal-500 font-mono">
                  USDC
                </span>
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-black font-display uppercase tracking-widest rounded-xl transition cursor-pointer"
                id={`btn-deposit-submit-${vault.id}`}
              >
                {stateMode === "testnet" && web3Allowance < (parseFloat(depositAmount || "0") * 1000000) ? "Approve" : "Stash"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDepositForm(false);
                  setDepositError("");
                }}
                className="px-2 py-1.5 hover:bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs rounded-lg cursor-pointer"
              >
                X
              </button>
            </div>
            {depositError && (
              <p className="text-[10px] text-teal-400 font-sans pl-1 font-semibold">{depositError}</p>
            )}
          </form>
        )}

        {/* Primary CTA button list */}
        {!closed ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setShowDepositForm(!showDepositForm);
                setWithdrawConfirm(false);
              }}
              className="py-2.5 flex items-center justify-center gap-1 text-zinc-300 hover:text-white bg-zinc-950/70 hover:bg-zinc-900 border border-zinc-850 rounded-2xl transition cursor-pointer text-xs font-bold font-sans active:scale-95"
              id={`btn-open-deposit-form-${vault.id}`}
            >
              <Coins size={12} className="text-teal-500" />
              Stash USDC
            </button>

            {/* Withdraw Button */}
            {!withdrawConfirm && (
              <button
                onClick={handleWithdrawClick}
                className={`py-2.5 text-xs font-black uppercase tracking-wider rounded-2xl border transition-all duration-300 active:scale-95 cursor-pointer font-display ${
                  targetCompleted 
                    ? "bg-teal-600 border-teal-600 hover:bg-teal-500 text-white shadow-lg shadow-teal-950/20"
                    : earlyExitPenaltyApplies
                      ? "border-teal-900/40 hover:border-teal-700/60 text-teal-400 hover:text-teal-300 bg-teal-950/10 hover:bg-teal-950/20"
                      : "border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-300 hover:text-white"
                }`}
                id={`btn-withdraw-${vault.id}`}
              >
                {earlyExitPenaltyApplies ? "Break" : "Withdraw"}
              </button>
            )}
          </div>
        ) : (
          <div className="w-full text-center py-2.5 border border-white/5 bg-zinc-950/40 rounded-2xl text-zinc-500 text-xs font-mono select-none uppercase tracking-widest text-[9px] font-bold">
            Settled & Terminated
          </div>
        )}
      </div>
    </div>
  );
}
