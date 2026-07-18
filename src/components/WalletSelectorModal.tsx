/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useEffect, useState } from "react";
import { X, Wallet, Check, AlertCircle, ExternalLink, ShieldCheck, HelpCircle } from "lucide-react";

interface WalletSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  isConnecting: boolean;
  onSelectWallet: (walletType: string) => Promise<void>;
  selectedWallet: string;
}

interface WalletOption {
  id: string;
  name: string;
  description: string;
  downloadUrl: string;
  detectKey: string;
  isInstalled: boolean;
}

export function WalletSelectorModal({
  isOpen,
  onClose,
  isConnecting,
  onSelectWallet,
  selectedWallet
}: WalletSelectorModalProps) {
  const [detectedWallets, setDetectedWallets] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const anyWin = window as any;
      const safeGet = (obj: any, key: string) => {
        try {
          if (!obj) return undefined;
          return obj[key];
        } catch {
          return undefined;
        }
      };

      const isEth = safeGet(anyWin, "ethereum");
      
      let isMetamaskDetected = false;
      let isBraveDetected = false;
      let isTrustDetected = false;
      let isCoinbaseDetected = false;

      if (isEth) {
        if (safeGet(isEth, "isMetaMask")) isMetamaskDetected = true;
        if (safeGet(isEth, "isBraveWallet")) isBraveDetected = true;
        if (safeGet(isEth, "isTrust") || safeGet(anyWin, "trustwallet")) isTrustDetected = true;
        if (safeGet(isEth, "isCoinbaseWallet")) isCoinbaseDetected = true;

        const providers = safeGet(isEth, "providers");
        if (providers && Array.isArray(providers)) {
          for (const provider of providers) {
            if (provider) {
              if (safeGet(provider, "isMetaMask")) isMetamaskDetected = true;
              if (safeGet(provider, "isBraveWallet")) isBraveDetected = true;
              if (safeGet(provider, "isTrust")) isTrustDetected = true;
              if (safeGet(provider, "isCoinbaseWallet")) isCoinbaseDetected = true;
            }
          }
        }
      }

      let isOkxDetected = !!safeGet(anyWin, "okxwallet");
      let isTrustWalletDetected = !!(safeGet(anyWin, "trustwallet") || isTrustDetected);
      let isCoinbaseWalletDetected = !!(safeGet(anyWin, "coinbaseWalletExtension") || isCoinbaseDetected);

      setDetectedWallets({
        metamask: isMetamaskDetected,
        okx: isOkxDetected,
        brave: isBraveDetected || !!(isEth && safeGet(isEth, "isBraveWallet")),
        trust: isTrustWalletDetected,
        coinbase: isCoinbaseWalletDetected,
        generic: !!isEth
      });
    } catch (err) {
      console.error("General error in wallet detection:", err);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const walletOptions: WalletOption[] = [
    {
      id: "okx",
      name: "OKX Wallet",
      description: "OKX Web3 Wallet extension with comprehensive multi-chain support.",
      downloadUrl: "https://www.okx.com/web3",
      detectKey: "okx",
      isInstalled: detectedWallets["okx"]
    },
    {
      id: "metamask",
      name: "MetaMask",
      description: "The most popular browser extension vault & secure wallet gateway.",
      downloadUrl: "https://metamask.io/download/",
      detectKey: "metamask",
      isInstalled: detectedWallets["metamask"]
    },
    {
      id: "brave",
      name: "Brave Wallet",
      description: "Privacy-centric EVM wallet built directly into the Brave browser.",
      downloadUrl: "https://brave.com/wallet/",
      detectKey: "brave",
      isInstalled: detectedWallets["brave"] || detectedWallets["metamask"] // fallback check for Brave injections
    },
    {
      id: "trust",
      name: "Trust Wallet",
      description: "Multi-functional secure option to stash and compound tokens.",
      downloadUrl: "https://trustwallet.com/",
      detectKey: "trust",
      isInstalled: detectedWallets["trust"]
    },
    {
      id: "coinbase",
      name: "Coinbase Wallet",
      description: "Fast-acting browser extension linked to coinbase systems.",
      downloadUrl: "https://www.coinbase.com/wallet",
      detectKey: "coinbase",
      isInstalled: detectedWallets["coinbase"]
    },
    {
      id: "generic",
      name: "Default Injected",
      description: "Standard web3 browser provider (Rabby, Frame, or other defaults).",
      downloadUrl: "https://ethereum.org/en/wallets/",
      detectKey: "generic",
      isInstalled: detectedWallets["generic"]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-fade-in" id="wallet-selector-overlay">
      <div 
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]"
        id="wallet-selector-container"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-sky-950/30 border border-sky-800/50 text-sky-400 rounded-lg">
              <Wallet size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 font-sans tracking-tight">Connect EVM Wallet</h3>
              <p className="text-xs text-zinc-400 font-sans mt-0.5">Select your preferred EVM provider to interact with YieldSafe.</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-zinc-850 text-zinc-400 hover:text-zinc-200 rounded-lg transition"
            id="wallet-selector-close"
          >
            <X size={16} />
          </button>
        </div>

        {/* List content */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 custom-scrollbar">
          {isConnecting && (
            <div className="bg-sky-950/20 border border-sky-900/40 p-4 rounded-xl flex items-center gap-3 text-sky-200 text-xs font-sans mb-2">
              <span className="w-2.5 h-2.5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              <span>Confirm connection prompt in your wallet extension...</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2.5">
            {walletOptions.map((opt) => {
              const isSelected = selectedWallet === opt.id;
              return (
                <div 
                  key={opt.id}
                  className={`group relative p-3.5 rounded-xl border flex items-start gap-3.5 transition-all ${
                    opt.isInstalled 
                      ? "bg-zinc-850/40 border-zinc-800/85 hover:border-sky-500/50 hover:bg-zinc-850/80 cursor-pointer" 
                      : "bg-zinc-950/20 border-zinc-900/50 hover:border-zinc-800"
                  }`}
                  onClick={() => opt.isInstalled && !isConnecting && onSelectWallet(opt.id)}
                  id={`wallet-option-${opt.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold font-sans ${opt.isInstalled ? "text-zinc-100 group-hover:text-white" : "text-zinc-500"}`}>
                        {opt.name}
                      </span>
                      {opt.isInstalled ? (
                        <span className="bg-teal-950/40 border border-teal-900/65 text-teal-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-sans">
                          Detected
                        </span>
                      ) : (
                        <a 
                          href={opt.downloadUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 text-zinc-400 hover:text-zinc-305 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-sans flex items-center gap-0.5 transition"
                        >
                          Install <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
                    <p className={`text-xs mt-1 leading-relaxed font-sans ${opt.isInstalled ? "text-zinc-400 group-hover:text-zinc-300" : "text-zinc-600"}`}>
                      {opt.description}
                    </p>
                  </div>

                  {opt.isInstalled && (
                    <div className="flex-shrink-0 flex items-center justify-center self-center">
                      {isSelected ? (
                        <div className="w-5 h-5 bg-sky-500/20 text-sky-400 border border-sky-500/60 rounded-full flex items-center justify-center">
                          <Check size={11} className="stroke-[3.5]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 bg-zinc-800 group-hover:bg-zinc-700 text-zinc-500 group-hover:text-zinc-300 rounded-full flex items-center justify-center text-[10px] font-bold transition">
                          →
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center gap-2 text-[10px] text-zinc-500 font-sans justify-center">
          <ShieldCheck size={11} className="text-zinc-400" />
          <span>Strictly compliant with standard EIP-1193 EVM browser connection specifications.</span>
        </div>
      </div>
    </div>
  );
}
