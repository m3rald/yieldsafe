/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState } from "react";
import { X, Shield, Calendar, Award, Info, Sparkles, PlusCircle } from "lucide-react";
import { SimulationState } from "../types";
import { formatUSDC } from "../mockContract";

interface CreateVaultModalProps {
  state: SimulationState;
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    goalName: string,
    targetAmount: number, // raw USDC with 6 decimals representing
    targetDate: number, // unix stamp
    locked: boolean,
    initialDeposit: number // raw USDC with 6 decimals representing
  ) => void;
  // Web3 parameters
  stateMode: "simulation" | "testnet";
  userUSDCBalance: number;
  blockTimestamp: number;
  web3WalletConnected: boolean;
  web3Allowance: number;
  isWeb3Transacting: boolean;
  onConnectWallet: () => void;
}

export default function CreateVaultModal({
  state,
  isOpen,
  onClose,
  onCreate,
  stateMode,
  userUSDCBalance,
  blockTimestamp,
  web3WalletConnected,
  web3Allowance,
  isWeb3Transacting,
  onConnectWallet
}: CreateVaultModalProps) {
  const [goalName, setGoalName] = useState("");
  const [targetAmountStr, setTargetAmountStr] = useState("1000"); // typical default
  const [deadlineType, setDeadlineType] = useState<"none" | "date">("none");
  const [targetDateStr, setTargetDateStr] = useState("");
  const [locked, setLocked] = useState(true);
  const [initialDepositStr, setInitialDepositStr] = useState("100"); // typical default
  const [errorMessage, setErrorMessage] = useState("");

  if (!isOpen) return null;

  const isTestnet = stateMode === "testnet";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (isTestnet && !web3WalletConnected) {
      setErrorMessage("Please connect your wallet first");
      return;
    }

    if (!goalName.trim()) {
      setErrorMessage("Goal name is required");
      return;
    }

    const parsedTarget = parseFloat(targetAmountStr);
    if (isNaN(parsedTarget) || parsedTarget < 1) {
      setErrorMessage("Target must be at least 1 USDC");
      return;
    }

    let targetDateUnix = 0;
    if (deadlineType === "date") {
      if (!targetDateStr) {
        setErrorMessage("Please select a target deadline date");
        return;
      }
      const selectedTime = new Date(targetDateStr).getTime() / 1000;
      if (isNaN(selectedTime) || selectedTime <= blockTimestamp) {
        setErrorMessage(`Target date must be in the future (relative to block time)`);
        return;
      }
      targetDateUnix = Math.floor(selectedTime);
    }

    const parsedDeposit = parseFloat(initialDepositStr || "0");
    if (isNaN(parsedDeposit) || parsedDeposit < 0) {
      setErrorMessage("Initial deposit must be a valid number");
      return;
    }

    if (parsedDeposit > 0 && parsedDeposit < 1) {
      setErrorMessage("If making an initial deposit, it must be at least 1 USDC");
      return;
    }

    const targetDecimalValue = Math.floor(parsedTarget * 1000000);
    const depositDecimalValue = Math.floor(parsedDeposit * 1000000);

    if (depositDecimalValue > userUSDCBalance) {
      setErrorMessage(`Insufficient wallet balance (${formatUSDC(userUSDCBalance)} USDC)`);
      return;
    }

    // Call create
    onCreate(goalName, targetDecimalValue, targetDateUnix, locked, depositDecimalValue);

    // Reset state & close
    setGoalName("");
    setTargetAmountStr("1000");
    setDeadlineType("none");
    setTargetDateStr("");
    setLocked(true);
    setInitialDepositStr("100");
    onClose();
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-950 text-teal-400 border border-teal-900 rounded-lg">
              <PlusCircle size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 font-sans tracking-tight">Establish Savings Goal Vault</h3>
              <p className="text-xs text-zinc-500 font-sans">Compiles a new goal-based yield instance on-chain</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-450 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition"
            id="btn-close-modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3 bg-teal-950/40 border border-teal-900/60 rounded-xl">
              <Info size={16} className="text-teal-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs font-semibold text-teal-200 font-sans leading-normal">{errorMessage}</p>
            </div>
          )}

          {/* Goal Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">
              Savings Goal Name
            </label>
            <input
              type="text"
              required
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              placeholder="e.g. Next-Gen iPad Pro, Emergency Buffer"
              className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-sm text-zinc-100 placeholder-zinc-650 focus:outline-none focus:border-teal-500/60 transition"
              id="input-goal-name"
            />
          </div>

          {/* Goal Target amount / Deadline Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Target Amount */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">
                Target Amount (USDC)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={targetAmountStr}
                  onChange={(e) => setTargetAmountStr(e.target.value)}
                  placeholder="1000"
                  className="w-full pl-3.5 pr-14 py-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-teal-500/60 transition"
                  id="input-target-amount"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 font-mono">
                  USDC
                </span>
              </div>
            </div>

            {/* Initial Deposit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans flex items-center justify-between">
                <span>Initial Deposit (USDC)</span>
                <span className="text-[10px] text-zinc-550 capitalize normal-case">
                  Bal: {formatUSDC(userUSDCBalance)}
                </span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={initialDepositStr}
                  onChange={(e) => setInitialDepositStr(e.target.value)}
                  placeholder="100"
                  className="w-full pl-3.5 pr-14 py-2.5 bg-zinc-950 border border-zinc-800/80 rounded-lg text-sm text-zinc-100 focus:outline-none focus:border-teal-500/60 transition"
                  id="input-initial-deposit"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500 font-mono">
                  USDC
                </span>
              </div>
            </div>
          </div>

          {/* Goal Deadline Toggle */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">
              Goal Completion Check
            </label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 border border-zinc-800/50 rounded-lg">
              <button
                type="button"
                onClick={() => setDeadlineType("none")}
                className={`py-1.5 text-xs font-medium rounded-md transition ${
                  deadlineType === "none"
                    ? "bg-zinc-850 text-teal-400 font-semibold shadow-inner border border-zinc-750/30"
                    : "text-zinc-500 hover:text-zinc-350"
                }`}
                id="btn-deadline-none"
              >
                No Time Deadline
              </button>
              <button
                type="button"
                onClick={() => setDeadlineType("date")}
                className={`py-1.5 text-xs font-medium rounded-md transition ${
                  deadlineType === "date"
                    ? "bg-zinc-850 text-teal-400 font-semibold shadow-inner border border-zinc-750/30"
                    : "text-zinc-500 hover:text-zinc-350"
                }`}
                id="btn-deadline-date"
              >
                With Deadline Date
              </button>
            </div>

            {deadlineType === "date" && (
              <div className="relative animate-fade-in mt-1.5">
                <input
                  type="datetime-local"
                  required
                  value={targetDateStr}
                  onChange={(e) => setTargetDateStr(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-teal-500/60 transition text-left"
                  id="input-target-date"
                />
                <Calendar size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-550" />
              </div>
            )}
          </div>

          {/* Lock Configuration Mode */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/50">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider font-sans">
              Vault Asset Lockdown Modality
            </label>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option A: Locked Vault */}
              <div
                onClick={() => setLocked(true)}
                className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                  locked
                    ? "border-teal-500/50 bg-teal-950/20"
                    : "border-zinc-800/65 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-950/80"
                }`}
                id="select-locked-true"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Shield size={14} className={locked ? "text-teal-400" : "text-zinc-400"} />
                  <span className={`text-xs font-bold font-sans ${locked ? "text-teal-400" : "text-zinc-300"}`}>
                    Locked Goal Vault
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                  Prevents withdrawal until goal is achieved. Early exits forfeit accrued interest & trigger a{" "}
                  <strong className="text-zinc-200">2.00% penalty</strong> on principal!
                </p>
              </div>

              {/* Option B: Flexible Vault */}
              <div
                onClick={() => setLocked(false)}
                className={`p-3 rounded-xl border cursor-pointer flex flex-col justify-between transition-all select-none ${
                  !locked
                    ? "border-teal-500/50 bg-teal-950/20"
                    : "border-zinc-800/65 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-950/80"
                }`}
                id="select-locked-false"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Award size={14} className={!locked ? "text-teal-400" : "text-zinc-400"} />
                  <span className={`text-xs font-bold font-sans ${!locked ? "text-teal-400" : "text-zinc-300"}`}>
                    Flexible Vault
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal font-sans">
                  Liquidity remains fully accessible at any time. Earns 5.00% APY; no early penalties. Compiles normal platform taxes (10% of yield) upon settlement.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800/80 text-xs font-bold text-zinc-400 hover:text-zinc-100 border border-zinc-850 rounded-xl transition font-sans"
              id="btn-cancel-modal"
            >
              Cancel
            </button>
            {isTestnet && !web3WalletConnected ? (
              <button
                type="button"
                onClick={onConnectWallet}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-sky-500 hover:bg-sky-450 text-zinc-950 text-xs font-bold rounded-xl transition shadow-md font-sans"
                id="btn-modal-connect-wallet"
              >
                Connect MetaMask Wallet
              </button>
            ) : (
              <button
                type="submit"
                disabled={isWeb3Transacting}
                className="flex items-center gap-1 px-5 py-2 bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold rounded-xl transition shadow-md shadow-teal-950 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                id="btn-create-submit"
              >
                <Sparkles size={12} fill="currentColor" />
                {isWeb3Transacting ? "Broadcasting..." : (isTestnet && web3Allowance < (parseFloat(initialDepositStr || "0") * 1000000) ? "Approve & Compile" : "Compile & Initialize")}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
