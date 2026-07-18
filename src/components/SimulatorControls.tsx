/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState } from "react";
import { Link, Play, RefreshCw, Landmark, ChevronRight, Zap, Coins, Wallet, History, AlertCircle } from "lucide-react";
import { SimulationState } from "../types";
import { formatUSDC, DEFAULT_USER_ADDRESS, DEFAULT_OWNER_ADDRESS, USDC_CONTRACT_ADDRESS } from "../mockContract";

interface SimulatorControlsProps {
  state: SimulationState;
  onFastForward: (seconds: number) => void;
  onFaucet: () => void;
  onClaimFees: () => void;
  onReset: () => void;
  activeTab: "dashboard" | "tx" | "solidity";
  setActiveTab: (tab: "dashboard" | "tx" | "solidity") => void;
  
  // Dynamic parameters mapping either from Simulation or Live Blockchain
  stateMode: "simulation" | "testnet";
  userAddress: string;
  userUSDCBalance: number;
  contractLiquidity: number;
  platformFeesAccrued: number;
  blockNumber: number;
  blockTimestamp: number;
  web3WalletConnected: boolean;
  isWeb3Connecting: boolean;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  liveContractAddress: string;
}

export default function SimulatorControls({
  state,
  onFastForward,
  onFaucet,
  onClaimFees,
  onReset,
  activeTab,
  setActiveTab,
  stateMode,
  userAddress,
  userUSDCBalance,
  contractLiquidity,
  platformFeesAccrued,
  blockNumber,
  blockTimestamp,
  web3WalletConnected,
  isWeb3Connecting,
  onConnectWallet,
  onDisconnectWallet,
  liveContractAddress
}: SimulatorControlsProps) {
  const [ffOptionSelected, setFfOptionSelected] = useState<number>(86400); // default +1 day
  const [copyStatus, setCopyStatus] = useState<string>("");

  const ffOptions = [
    { label: "1 min", seconds: 60 },
    { label: "1 hour", seconds: 3600 },
    { label: "1 day", seconds: 86400 },
    { label: "30 days", seconds: 30 * 86400 },
    { label: "1 year", seconds: 365 * 86400 }
  ];

  // Convert date representation
  const blockDate = new Date(blockTimestamp * 1000);

  const handleCopy = (address: string, label: string) => {
    navigator.clipboard.writeText(address);
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(""), 2000);
  };

  const isTestnet = stateMode === "testnet";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
      {/* COLUMN 1: Blockchain Status & Controls */}
      <div className="lg:col-span-8 crystal-panel p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-white/10" id="container-blockchain-status">
        <div className="absolute top-0 right-0 w-32 h-32 bg-radial-glow opacity-15 pointer-events-none" />
        <div>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isTestnet ? "bg-teal-400" : "bg-teal-500"}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isTestnet ? "bg-teal-500" : "bg-teal-550"}`}></span>
              </span>
              <div>
                <h3 className="text-sm font-black text-white font-display uppercase tracking-widest">
                  {isTestnet ? "EVM TESTNET GATEWAY" : "YIELDSAFE WORKSPACE VM"}
                </h3>
                <p className={`text-[10px] font-mono ${isTestnet ? "text-teal-400" : "text-teal-400"}`}>
                  STATUS: {isTestnet ? (web3WalletConnected ? "ONLINE (LINKED)" : "PINGING") : "CONNECTED (LOCAL LEDGER)"}
                </p>
              </div>
            </div>

            {!isTestnet && (
              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-zinc-400 font-extrabold uppercase tracking-wider hover:text-teal-400 bg-zinc-950/60 border border-zinc-800 rounded-xl transition cursor-pointer"
                id="btn-hard-reset"
                title="Reset Simulated State"
              >
                <RefreshCw size={11} className="animate-pulse" />
                Hard Reset
              </button>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-4">
            <div className="bg-zinc-950/70 border border-white/5 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold font-mono">Block Number</p>
              <p className="text-sm font-black text-white font-mono mt-0.5">
                {blockNumber > 0 ? `#${blockNumber}` : "Pending"}
              </p>
            </div>
            <div className="bg-zinc-950/70 border border-white/5 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold font-mono">Total Locked</p>
              <p className="text-sm font-black text-teal-400 font-mono mt-0.5">{formatUSDC(contractLiquidity)} <span className="text-[9px] text-zinc-500">USDC</span></p>
            </div>
            <div className="bg-zinc-950/70 border border-white/5 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold font-mono">EVM Address</p>
              <p 
                onClick={() => handleCopy(USDC_CONTRACT_ADDRESS, "USDC")}
                className="text-xs font-mono text-zinc-350 cursor-pointer hover:text-teal-400 mt-1 truncate font-semibold"
                title="USDC ERC-20 Address"
              >
                {copyStatus === "USDC" ? "Copied!" : "0x3600...0000"}
              </p>
            </div>
            <div className="bg-zinc-950/70 border border-white/5 p-3 rounded-2xl text-center shadow-inner">
              <p className="text-[9px] uppercase tracking-wider text-zinc-500 font-bold font-mono">Sandbox Clock</p>
              <p className="text-[11px] font-black text-white mt-1 font-mono truncate" title={blockDate.toLocaleString()}>
                {blockTimestamp > 0 ? (
                  `${blockDate.toISOString().slice(0, 10)} ${blockDate.toTimeString().slice(0, 8)}`
                ) : (
                  "Offline"
                )}
              </p>
            </div>
          </div>

          {/* Time Machine Controls */}
          <div className="bg-zinc-950/40 border border-white/5 p-4 rounded-2xl relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black uppercase tracking-widest flex items-center gap-1.5 font-display text-white text-glow-teal">
                <Zap size={14} className="text-teal-400 animate-pulse" /> {isTestnet ? "Decentralized Clock" : "Block Timestamp Warp Module"}
              </h4>
              <span className="text-[9px] text-zinc-500 font-mono font-bold tracking-wider uppercase">
                {isTestnet ? "Compounding via nodes" : "Fast forward ledger clock"}
              </span>
            </div>

            {isTestnet ? (
              <p className="text-xs text-zinc-350 leading-relaxed font-sans">
                You are currently connected to the live smart contract at <code className="text-teal-400 font-mono font-black select-all">{liveContractAddress}</code>.
                Your savings vaults compound interest natively on-chain at 5.00% APY based on real Ethereum block progression. Timestamp warp is locked in production.
              </p>
            ) : (
              <>
                <p className="text-xs text-zinc-350 leading-relaxed mb-4 font-sans">
                  YieldSafe computes simple yield progression rules over your deposits. Select a simulated timeframe and warp the ledger to release pending yield rewards instantly!
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex bg-zinc-950/90 border border-zinc-900 rounded-xl p-0.5">
                    {ffOptions.map((opt) => (
                      <button
                        key={opt.seconds}
                        onClick={() => setFfOptionSelected(opt.seconds)}
                        className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg transition-all cursor-pointer ${
                          ffOptionSelected === opt.seconds
                            ? "bg-teal-600 text-white shadow-md font-semibold"
                            : "text-zinc-400 hover:text-white"
                        }`}
                        id={`ff-${opt.seconds}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => onFastForward(ffOptionSelected)}
                    className="premium-button-teal flex items-center gap-1.5 px-5 py-2 text-white text-xs font-black font-display uppercase tracking-wider rounded-xl active:scale-95 cursor-pointer shadow-lg shadow-teal-950/40"
                    id="btn-fast-forward"
                  >
                    <Play size={11} fill="currentColor" className="text-white" />
                    Jump Time
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dynamic navigation Tabs for details lower in the page */}
        <div className="flex items-center gap-2 mt-6 pt-3 border-t border-white/5 bg-transparent justify-start select-none">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-display rounded-xl border transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-950/20"
                : "text-zinc-450 border-transparent hover:text-white"
            }`}
            id="nav-tab-dashboard"
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("tx")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-display rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "tx"
                ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-950/20"
                : "text-zinc-450 border-transparent hover:text-white"
            }`}
            id="nav-tab-transactions"
          >
            <History size={11} />
            {isTestnet ? "Blockchain Logs" : "Ledger Logs"}
          </button>
          <button
            onClick={() => setActiveTab("solidity")}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-display rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "solidity"
                ? "bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-950/20"
                : "text-zinc-450 border-transparent hover:text-white"
            }`}
            id="nav-tab-solidity"
          >
            Solidity Code
          </button>
        </div>
      </div>

      {/* COLUMN 2: User Wallet & Administrative Panel */}
      <div className="lg:col-span-4 crystal-panel p-6 rounded-3xl flex flex-col justify-between shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-white/10" id="container-user-wallet">
        <div className="absolute top-0 right-0 w-32 h-32 bg-radial-glow opacity-10 pointer-events-none" />
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-white/5 pb-4 mb-4">
            <div className="p-2 bg-teal-950/30 border border-teal-900/40 text-teal-400 rounded-xl">
              <Wallet size={16} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white font-display uppercase tracking-wider">ACTIVE PORTFOLIO</h3>
              <p 
                onClick={() => userAddress && handleCopy(userAddress, "USER")}
                className="text-[10px] hover:text-teal-400 text-zinc-500 font-mono transition cursor-pointer truncate font-medium mt-0.5"
              >
                {copyStatus === "USER" ? "Copied!" : (userAddress ? `${userAddress.slice(0, 10)}...${userAddress.slice(-6)}` : "DEFAULT INJECTED WALLET")}
              </p>
            </div>
          </div>

          {/* USDC Balance card */}
          <div className="bg-zinc-950/70 border border-white/5 rounded-2xl p-4 mb-4 shadow-inner relative overflow-hidden">
            <span className="text-[9px] tracking-widest text-zinc-550 uppercase font-bold font-mono pl-0.5">
              {isTestnet ? "BALANCE ON-CHAIN" : "AVAILABLE SANDBOX CASH"}
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black text-white font-mono tracking-tight">{formatUSDC(userUSDCBalance)}</span>
              <span className="text-xs font-extrabold text-teal-500 font-mono">USDC</span>
            </div>
            
            {isTestnet ? (
              !web3WalletConnected ? (
                <div className="mt-4 space-y-2.5">
                  <button
                    onClick={onConnectWallet}
                    disabled={isWeb3Connecting}
                    className="w-full flex items-center justify-center gap-1.5 py-3 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold font-display uppercase tracking-wider rounded-xl transition-all shadow-md shadow-teal-950/40 cursor-pointer"
                    id="btn-connect-wallet-controls"
                  >
                    <Wallet size={13} />
                    {isWeb3Connecting ? "Linking..." : "Connect EVM Wallet"}
                  </button>
                  <div className="text-center">
                    <a 
                      href="https://faucet.circle.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[10px] text-teal-400 hover:text-teal-300 underline font-mono font-medium transition-colors inline-flex items-center gap-1"
                      id="dashboard-faucet-unconnected-link"
                    >
                      ⚡ Open Circle USDC Faucet ↗
                    </a>
                  </div>
                </div>
              ) : (
                <div className="mt-4 space-y-2.5">
                  <div className="text-[10px] text-zinc-400 text-center border border-white/5 p-2 rounded-xl bg-zinc-950 font-sans space-y-2">
                    <p>Secure Metamask link active. Obtain USDC tokens to interact with Arc Network.</p>
                    <div className="pt-1.5 border-t border-white/5 flex justify-center">
                      <a 
                        href="https://faucet.circle.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-teal-400 hover:text-teal-300 underline font-mono font-bold transition-colors inline-flex items-center gap-1"
                        id="dashboard-faucet-connected-link"
                      >
                        ⚡ Claim Circle USDC Faucet ↗
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={onDisconnectWallet}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 bg-zinc-950/50 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-bold rounded-xl border border-zinc-800 transition cursor-pointer"
                    id="btn-disconnect-wallet"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              )
            ) : (
              <>
                <p className="text-[10px] text-zinc-400 mt-1.5 pl-0.5 font-sans">Generate test coins to start stashing yield:</p>
                <button
                  onClick={onFaucet}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 py-2 px-3 border border-dashed border-teal-800/80 hover:border-teal-500 text-teal-400 hover:text-white bg-teal-950/20 hover:bg-teal-950/40 text-xs font-extrabold uppercase tracking-wide rounded-xl transition cursor-pointer"
                  id="btn-claim-faucet"
                >
                  <Coins size={13} className="text-teal-500" />
                  Claim 1,500 USDC Faucet
                </button>
              </>
            )}
          </div>
        </div>

        {/* Platform Fees / Contract Owner Accrual */}
        <div className="mt-4 pt-4 border-t border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] tracking-widest text-zinc-550 uppercase font-black font-mono flex items-center gap-1">
              <Landmark size={12} className="text-teal-500" /> SYSTEM RESERVES
            </span>
            <span className="text-[9px] px-2 py-0.5 bg-teal-950/40 text-teal-400 border border-teal-900/50 rounded font-bold font-mono">
              {isTestnet ? "PRODUCTION" : "ISOLATED"}
            </span>
          </div>

          <p className="text-[11px] text-zinc-450 leading-relaxed mb-3.5 font-sans">
            Early fine exits (2.0%) and yield taxes (10.0%) accumulate in the smart contract reserves automatically.
          </p>

          <div className="bg-zinc-950/70 border border-white/5 p-3.5 rounded-2xl flex items-center justify-between gap-4">
            <div>
              <p className="text-[9px] text-zinc-550 font-mono font-bold uppercase pl-0.5">CONTRACT FEES</p>
              <p className="text-base font-black text-white font-mono mt-0.5">{formatUSDC(platformFeesAccrued)} <span className="text-[10px] text-zinc-500">USDC</span></p>
            </div>

            <button
              onClick={onClaimFees}
              disabled={platformFeesAccrued <= 0}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider font-display rounded-xl transition cursor-pointer select-none border ${
                platformFeesAccrued > 0
                  ? "bg-white text-zinc-950 border-white hover:bg-zinc-100 font-extrabold"
                  : "bg-zinc-950 border-zinc-900 text-zinc-650 cursor-not-allowed"
              }`}
              id="btn-admin-claim-fees"
            >
              Claim Reserves
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
