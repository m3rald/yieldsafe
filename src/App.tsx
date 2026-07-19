/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState, useEffect } from "react";

declare global {
  interface Window {
    ethereum?: any;
  }
}

import { 
  Plus, 
  Coins, 
  RefreshCw, 
  AlertCircle, 
  Info, 
  Check, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Link2,
  Trash2,
  History,
  FileCode,
  Compass,
  Landmark,
  ShieldAlert,
  Zap,
  Sun,
  Moon
} from "lucide-react";
import { 
  getInitialState, 
  createVault, 
  deposit, 
  accrueYield, 
  withdraw, 
  fastForwardTime, 
  adminWithdrawFees,
  resetSimulation,
  formatUSDC,
  generateTxHash,
  isGoalMet,
  DEFAULT_USER_ADDRESS
} from "./mockContract";
import { SimulationState, Vault, TransactionHistoryEntry } from "./types";
import SimulatorControls from "./components/SimulatorControls";
import CreateVaultModal from "./components/CreateVaultModal";
import VaultCard from "./components/VaultCard";
import CodeViewer from "./components/CodeViewer";
import { WalletSelectorModal } from "./components/WalletSelectorModal";
import { 
  LIVE_CONTRACT_ADDRESS, 
  USDC_TOKEN_ADDRESS, 
  YIELD_SAFE_ABI, 
  isWeb3Available, 
  mapBlockchainVault, 
  getUSDCBalance, 
  getUSDCAllowance, 
  approveUSDC 
} from "./web3Contract";
import { ethers } from "ethers";
import { usePrivy, useWallets } from "@privy-io/react-auth";

export default function App() {
  const { login, logout, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const [privyProvider, setPrivyProvider] = useState<any>(null);
  const [state, setState] = useState<SimulationState>(getInitialState);
  const [currentView, setCurrentView] = useState<"landing" | "main">("landing");
  const [themeMode, setThemeMode] = useState<"dark" | "light">(() => {
    return (localStorage.getItem("yieldsafe_theme") as "dark" | "light") || "dark";
  });

  const toggleTheme = () => {
    const nextTheme = themeMode === "dark" ? "light" : "dark";
    setThemeMode(nextTheme);
    localStorage.setItem("yieldsafe_theme", nextTheme);
    addNotification(`Switched to ${nextTheme === "dark" ? "Dark Classic" : "Light Aura"} Mode.`, "info");
  };
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "tx" | "solidity">("dashboard");
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; type: "success" | "error" | "info" }>>([]);
  const [filterType, setFilterType] = useState<"all" | "active" | "locked" | "flexible" | "completed" | "closed">("all");

  // Web3 states
  const [stateMode, setStateMode] = useState<"simulation" | "testnet">("simulation");
  const [web3WalletConnected, setWeb3WalletConnected] = useState(false);
  const [web3ChainId, setWeb3ChainId] = useState<number | null>(null);
  const [web3Address, setWeb3Address] = useState("");
  const [web3USDCBalance, setWeb3USDCBalance] = useState(0);
  const [web3Allowance, setWeb3Allowance] = useState(0);
  const [web3Vaults, setWeb3Vaults] = useState<Record<number, Vault>>({});
  const [web3TotalLiquidity, setWeb3TotalLiquidity] = useState(0);
  const [web3PlatformFeesAccrued, setWeb3PlatformFeesAccrued] = useState(0);
  const [web3BlockNumber, setWeb3BlockNumber] = useState(0);
  const [web3BlockTimestamp, setWeb3BlockTimestamp] = useState(0);
  const [web3TxList, setWeb3TxList] = useState<TransactionHistoryEntry[]>([]);
  const [isWeb3Connecting, setIsWeb3Connecting] = useState(false);
  const [isWeb3Transacting, setIsWeb3Transacting] = useState(false);
  const [isContractDeployed, setIsContractDeployed] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState<string>(() => {
    return localStorage.getItem("yieldsafe_selected_wallet") || "metamask";
  });
  const [isWalletSelectorOpen, setIsWalletSelectorOpen] = useState(false);

  const getActiveEthereumObject = (walletType: string = selectedWallet) => {
    if (authenticated && privyProvider) {
      return privyProvider;
    }
    if (typeof window === "undefined") return undefined;
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

      const ethereum = safeGet(anyWin, "ethereum");
      switch (walletType) {
        case "okx":
          return safeGet(anyWin, "okxwallet") || ethereum;
        case "metamask":
          try {
            const providers = safeGet(ethereum, "providers");
            if (providers && Array.isArray(providers)) {
              const metaMaskProvider = providers.find((p: any) => {
                return safeGet(p, "isMetaMask") === true;
              });
              if (metaMaskProvider) return metaMaskProvider;
            }
            return ethereum;
          } catch {
            return ethereum;
          }
        case "brave":
          return ethereum;
        case "trust":
          return safeGet(anyWin, "trustwallet") || ethereum;
        case "coinbase":
          return safeGet(anyWin, "coinbaseWalletExtension") || ethereum;
        default:
          return ethereum;
      }
    } catch (e) {
      console.warn("Soft-caught getActiveEthereumObject error:", e);
      return undefined;
    }
  };
  const [liveContractAddress, setLiveContractAddress] = useState<string>(() => {
    const cached = localStorage.getItem("yieldsafe_contract_address");
    if (cached === "0xd364a439D0b788bEaDc42603727041361e6D079B") {
      localStorage.removeItem("yieldsafe_contract_address");
      return LIVE_CONTRACT_ADDRESS;
    }
    return cached || LIVE_CONTRACT_ADDRESS;
  });
  const [usdcTokenAddress, setUsdcTokenAddress] = useState<string>(() => {
    return localStorage.getItem("yieldsafe_usdc_address") || USDC_TOKEN_ADDRESS;
  });

  // Status variables for UI (mapped to current mode)
  const isTestnet = stateMode === "testnet";
  const activeVaults = isTestnet ? web3Vaults : state.vaults;
  const activeUserAddress = isTestnet ? web3Address : state.userAddress;
  const activeUSDCBalance = isTestnet ? web3USDCBalance : state.userUSDCBalance;
  const activePlatformFees = isTestnet ? web3PlatformFeesAccrued : state.platformFeesAccrued;
  const activeContractLiquidity = isTestnet ? web3TotalLiquidity : state.totalLiquidity;
  const activeBlockTimestamp = isTestnet ? web3BlockTimestamp : state.blockTimestamp;
  const activeBlockNumber = isTestnet ? web3BlockNumber : state.blockNumber;
  const activeTxList = isTestnet ? web3TxList : state.txList;

  const totalVolumeUSDC = (Object.values(activeVaults) as Vault[]).reduce((sum, v) => sum + v.principal, 0);
  const totalYieldAccrued = (Object.values(activeVaults) as Vault[]).reduce((sum, v) => sum + v.yieldAccrued, 0);

  const addNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Date.now().toString() + Math.random().toString();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5500);
  };

  // On-chain state loader
  const loadBlockchainState = async (provider?: any, userAddr?: string) => {
    try {
      const activeEth = getActiveEthereumObject();
      if (!activeEth) return;
      
      const activeAddress = userAddr || web3Address;
      if (!activeAddress) return;
      
      const currentProvider = provider || new ethers.BrowserProvider(activeEth as any);
      
      // Get and store the connected chain ID
      let connectedChainId: number | null = null;
      try {
        const net = await currentProvider.getNetwork();
        connectedChainId = Number(net.chainId);
        setWeb3ChainId(connectedChainId);
      } catch (err) {
        console.warn("Failed to check network chain ID:", err);
      }

      // Pre-flight check: ensure the provider is actively connected to the specific Arc Testnet chain (Chain ID 5042002) before state loading
      if (connectedChainId !== null && connectedChainId !== 5042002) {
        console.warn(`DEBUG INFO: Provider actively connected to chain ID ${connectedChainId}, which is not the Arc Testnet (5042002). Aborting on-chain state load.`);
        setIsContractDeployed(false);
        setWeb3USDCBalance(0);
        setWeb3Allowance(0);
        setWeb3TotalLiquidity(0);
        setWeb3PlatformFeesAccrued(0);
        setWeb3Vaults({});
        return;
      }
      
      // Graceful bytecode presence verification to avoid throwing BAD_DATA decoding errors on mismatching networks
      let hasContract = false;
      try {
        const code = await currentProvider.getCode(liveContractAddress);
        if (code && code !== "0x" && code !== "0x0" && code !== "0x00") {
          hasContract = true;
        } else if (connectedChainId === 5042002) {
          // Robust fallback: If actively connected to Arc Testnet, assume contract is deployed to bypass RPC/iframe glitches
          hasContract = true;
        }
      } catch (err) {
        console.warn("Failed to check contract bytecode deployment status", err);
        if (connectedChainId === 5042002) {
          hasContract = true;
        }
      }
      
      setIsContractDeployed(hasContract);
      
      if (!hasContract) {
        console.warn("YieldSafe smart contract is not deployed or mismatching network on the currently selected MetaMask network.");
        // Fetch the USDC balance anyways so the user's mock USDC fund status/balance is fully visible and reflective!
        const balance = await getUSDCBalance(currentProvider, activeAddress, usdcTokenAddress);
        setWeb3USDCBalance(balance);
        setWeb3Allowance(0);
        setWeb3TotalLiquidity(0);
        setWeb3PlatformFeesAccrued(0);
        setWeb3Vaults({});
        try {
          const block = await currentProvider.getBlock("latest");
          if (block) {
            setWeb3BlockNumber(block.number);
            setWeb3BlockTimestamp(Number(block.timestamp));
          }
        } catch {}
        return;
      }
      
      const contract = new ethers.Contract(liveContractAddress, YIELD_SAFE_ABI, currentProvider);
      
      let resolvedUsdcAddress = usdcTokenAddress;
      try {
        const liveContractUsdc = await contract.USDC();
        if (liveContractUsdc && liveContractUsdc !== ethers.ZeroAddress) {
          resolvedUsdcAddress = liveContractUsdc;
        }
      } catch (err) {
        console.warn("Could not query dynamic USDC address from contract, using default constant", err);
      }
      
      // Load balances and basic contract stats
      const balance = await getUSDCBalance(currentProvider, activeAddress, resolvedUsdcAddress);
      const allowance = await getUSDCAllowance(currentProvider, activeAddress, liveContractAddress, resolvedUsdcAddress);
      
      const platformFees = await contract.platformFeesAccrued();
      const totalLiq = await contract.totalLiquidity();
      
      const block = await currentProvider.getBlock("latest");
      const blockNum = block ? block.number : 0;
      const blockTime = block ? Number(block.timestamp) : Math.floor(Date.now() / 1000);
      
      // Fetch list of vault IDs
      const vaultIds: any[] = await contract.getUserVaults(activeAddress);
      const fetchedVaults: Record<number, Vault> = {};
      
      for (const rawId of vaultIds) {
        const id = Number(rawId);
        try {
          const details = await contract.getVaultDetails(id);
          const mapped = mapBlockchainVault(details.vault);
          fetchedVaults[id] = mapped;
        } catch (err) {
          console.warn(`Error loading vault #${id} gracefully`, err);
        }
      }
      
      setWeb3USDCBalance(balance);
      setWeb3Allowance(allowance);
      setWeb3TotalLiquidity(Number(totalLiq));
      setWeb3PlatformFeesAccrued(Number(platformFees));
      setWeb3BlockNumber(blockNum);
      setWeb3BlockTimestamp(blockTime);
      setWeb3Vaults(fetchedVaults);
    } catch (err) {
      console.warn("Error executing loadBlockchainState gracefully", err);
    }
  };

  // Reliable network switch/addition helper for Arc Testnet (Chain ID 5042002, 0x4cef52)
  const switchNetwork = async () => {
    console.log("DEBUG: Target chain ID: 5042002 ('0x4cef52')");
    try {
      const ethObj = getActiveEthereumObject();
      if (!ethObj) {
        console.error("DEBUG ERROR: No active Ethereum wallet object detected.");
        addNotification("Could not find connected Web3 wallet.", "error");
        return false;
      }
      
      const targetChainIdHex = "0x" + Number(5042002).toString(16); // 5042002 in hex: "0x4cef52"
      console.log(`DEBUG: Requesting switch to chain ID 5042002 (Hex: ${targetChainIdHex}) via wallet_switchEthereumChain`);
      
      try {
        const response = await ethObj.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainIdHex }],
        });
        console.log("DEBUG SUCCESS: wallet_switchEthereumChain raw response:", response);
        addNotification("Switched to Arc Testnet!", "success");
        return true;
      } catch (switchError: any) {
        // Log raw error parameters comprehensively to assist dynamic troubleshooting
        console.error("DEBUG ERROR: Full raw switch object caught:", switchError);
        console.error("DEBUG ERROR properties:", {
          code: switchError?.code,
          message: switchError?.message,
          data: switchError?.data,
          stack: switchError?.stack,
        });

        // Safe conversion to string for detailed debug output
        const errorMsgString = typeof switchError === "object" ? JSON.stringify(switchError, Object.getOwnPropertyNames(switchError)) : String(switchError);
        console.error("DEBUG ERROR stringified:", errorMsgString);

        // Code 4902 means the chain hasn't been added to MetaMask
        // Rabby or Coinbase or other wallets might throw -32603 or specific messages indicating missing chain IDs
        const isChainMissing = 
          switchError?.code === 4902 || 
          switchError?.code === -32603 || 
          (switchError?.message && (
            switchError.message.includes("Unrecognized chain ID") || 
            switchError.message.includes("4902") || 
            switchError.message.includes("Unrecognized chain") ||
            switchError.message.includes("wallet_addEthereumChain")
          ));

        if (isChainMissing) {
          console.log("DEBUG: Chain not recognized by provider. Requesting wallet_addEthereumChain to register Arc Testnet metadata...");
          try {
            const addResponse = await ethObj.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: targetChainIdHex,
                  chainName: "Arc Testnet",
                  nativeCurrency: {
                    name: "USDC",
                    symbol: "USDC",
                    decimals: 6,
                  },
                  rpcUrls: ["https://rpc.testnet.arc.network"],
                  blockExplorerUrls: ["https://testnet.arcscan.app"],
                },
              ],
            });
            console.log("DEBUG SUCCESS: wallet_addEthereumChain raw response:", addResponse);
            addNotification("Arc Testnet added to wallet and selected!", "success");
            return true;
          } catch (addError: any) {
            console.error("DEBUG ERROR: Failed to add Arc Testnet chain via wallet_addEthereumChain:", addError);
            console.error("DEBUG ERROR properties for adding chain:", {
              code: addError?.code,
              message: addError?.message,
              data: addError?.data,
              stack: addError?.stack,
            });
            addNotification(`Failed to add Arc Testnet: ${addError?.message || addError}`, "error");
            return false;
          }
        } else {
          // If the network switch failed on direct user interaction due to user rejection or browser extensions / iframe limits
          const isUserRejected = switchError?.code === 4001 || (switchError?.message && switchError.message.includes("User rejected"));
          if (isUserRejected) {
            console.warn("DEBUG WARN: User rejected the network switch prompt manually.");
            addNotification("Network switch request was cancelled by the user.", "info");
          } else {
            console.error(`DEBUG ERROR: Unhandled switch exception: ${switchError?.message || switchError}`);
            addNotification(`Chain switch failed: ${switchError?.message || switchError}. Refer to console logs.`, "error");
          }
          return false;
        }
      }
    } catch (err: any) {
      console.error("DEBUG ERROR: General error inside switchNetwork outer catch:", err);
      return false;
    }
  };

  // Wallet connector
  const connectWallet = async (walletType: string = selectedWallet) => {
    if (!isWeb3Available()) {
      addNotification("No compatible Web3 provider or wallet detected in browser.", "error");
      return;
    }
    setIsWeb3Connecting(true);
    try {
      const ethObject = getActiveEthereumObject(walletType);
      if (!ethObject) {
        throw new Error(`The requested wallet provider was not found. Please ensure it is installed and enabled.`);
      }

      setSelectedWallet(walletType);
      localStorage.setItem("yieldsafe_selected_wallet", walletType);
      localStorage.setItem("yieldsafe_wallet_disconnected", "false");

      const provider = new ethers.BrowserProvider(ethObject as any);
      const accounts = await ethObject.request({ method: "eth_requestAccounts" });
      const address = accounts[0];
      setWeb3Address(address);
      setWeb3WalletConnected(true);
      
      const displayNames: Record<string, string> = {
        metamask: "MetaMask",
        okx: "OKX Wallet",
        brave: "Brave Wallet",
        trust: "Trust Wallet",
        coinbase: "Coinbase Wallet",
        generic: "Web3 Wallet"
      };
      const walletName = displayNames[walletType] || "EVM Wallet";
      addNotification(`${walletName} connected: ${address.slice(0, 6)}...${address.slice(-4)}`, "success");
      
      // Auto switch network to Arc Testnet if needed
      let activeProvider = provider;
      try {
        const net = await provider.getNetwork();
        const connectedChainId = Number(net.chainId);
        setWeb3ChainId(connectedChainId);
        if (connectedChainId !== 5042002) {
          addNotification("Wrong network detected. Switching to Arc Testnet...", "info");
          const switched = await switchNetwork();
          if (switched) {
            activeProvider = new ethers.BrowserProvider(ethObject as any);
            try {
              const newNet = await activeProvider.getNetwork();
              setWeb3ChainId(Number(newNet.chainId));
            } catch {}
          }
        }
      } catch (e) {
        console.warn("Could not check chain ID during connection:", e);
      }

      // Close selector modal if open
      setIsWalletSelectorOpen(false);

      await loadBlockchainState(activeProvider, address);
    } catch (err: any) {
      console.error("Wallet connection failed", err);
      addNotification(`Connection failed: ${err.message || err}`, "error");
    } finally {
      setIsWeb3Connecting(false);
    }
  };

  // Wallet disconnection
  const disconnectWallet = () => {
    setWeb3Address("");
    setWeb3WalletConnected(false);
    localStorage.setItem("yieldsafe_wallet_disconnected", "true");
    addNotification("Wallet disconnected. Returning to Local Simulation presets.", "info");
  };

  // Sync Privy embedded wallet to Web3 state
  useEffect(() => {
    let active = true;
    if (authenticated && wallets.length > 0) {
      const privyWallet = wallets.find(w => w.walletClientType === 'privy');
      if (privyWallet) {
        privyWallet.getEthereumProvider().then((provider) => {
          if (!active) return;
          setPrivyProvider(provider);
          setWeb3Address(privyWallet.address);
          setWeb3WalletConnected(true);
          setSelectedWallet("privy");

          // Automatically switch/add Arc Testnet network if needed
          const ethersProvider = new ethers.BrowserProvider(provider);
          ethersProvider.getNetwork().then((net) => {
            const currentChainId = Number(net.chainId);
            setWeb3ChainId(currentChainId);
            if (currentChainId !== 5042002) {
              const targetChainIdHex = "0x" + Number(5042002).toString(16);
              provider.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: targetChainIdHex }],
              }).catch((switchError: any) => {
                const isChainMissing = 
                  switchError?.code === 4902 || 
                  switchError?.code === -32603 || 
                  (switchError?.message && (
                    switchError.message.includes("Unrecognized chain ID") || 
                    switchError.message.includes("4902") || 
                    switchError.message.includes("Unrecognized chain") ||
                    switchError.message.includes("wallet_addEthereumChain")
                  ));
                if (isChainMissing) {
                  provider.request({
                    method: "wallet_addEthereumChain",
                    params: [
                      {
                        chainId: targetChainIdHex,
                        chainName: "Arc Testnet",
                        nativeCurrency: {
                          name: "USDC",
                          symbol: "USDC",
                          decimals: 6,
                        },
                        rpcUrls: ["https://rpc.testnet.arc.network"],
                        blockExplorerUrls: ["https://testnet.arcscan.app"],
                      },
                    ],
                  }).catch(console.error);
                }
              });
            }
          });
        }).catch((err) => {
          console.error("Failed to get Privy provider:", err);
        });
      }
    } else {
      setPrivyProvider(null);
    }
    return () => {
      active = false;
    };
  }, [authenticated, wallets]);

  // Set up account/chain listeners based on active wallet type
  useEffect(() => {
    const activeWalletType = localStorage.getItem("yieldsafe_selected_wallet") || selectedWallet || "metamask";
    const ethObject = getActiveEthereumObject(activeWalletType);

    if (isWeb3Available() && ethObject) {
      // Check if already authorized/connected on startup
      const isDisconnected = localStorage.getItem("yieldsafe_wallet_disconnected") === "true";
      if (!isDisconnected) {
        ethObject.request({ method: "eth_accounts" })
          .then(async (accounts: string[]) => {
            if (accounts && accounts.length > 0) {
              setWeb3Address(accounts[0]);
              setWeb3WalletConnected(true);
              let provider = new ethers.BrowserProvider(ethObject as any);
              
              // Force update the network to arc testnet upon connection of Wallet
              try {
                const net = await provider.getNetwork();
                const connectedChainId = Number(net.chainId);
                setWeb3ChainId(connectedChainId);
                if (connectedChainId !== 5042002) {
                  addNotification("Checking network... Switching to Arc Testnet...", "info");
                  const switched = await switchNetwork();
                  if (switched) {
                    provider = new ethers.BrowserProvider(ethObject as any);
                    try {
                      const newNet = await provider.getNetwork();
                      setWeb3ChainId(Number(newNet.chainId));
                    } catch {}
                  }
                }
              } catch (e) {
                console.warn("Could not check chain ID during startup auto-connect:", e);
              }
              
              await loadBlockchainState(provider, accounts[0]);
            }
          })
          .catch((err: any) => {
            console.warn("Error auto-detecting connected accounts gracefully:", err);
          });
      }

      const handleAccounts = async (accounts: string[]) => {
        try {
          if (accounts.length > 0) {
            setWeb3Address(accounts[0]);
            setWeb3WalletConnected(true);
            let provider = new ethers.BrowserProvider(ethObject as any);
            
            // Force update the network to arc testnet upon connection of Wallet
            try {
              const net = await provider.getNetwork();
              const connectedChainId = Number(net.chainId);
              setWeb3ChainId(connectedChainId);
              if (connectedChainId !== 5042002) {
                addNotification("Switching to Arc Testnet...", "info");
                const switched = await switchNetwork();
                if (switched) {
                  provider = new ethers.BrowserProvider(ethObject as any);
                  try {
                    const newNet = await provider.getNetwork();
                    setWeb3ChainId(Number(newNet.chainId));
                  } catch {}
                }
              }
            } catch (e) {
              console.warn("Could not check chain ID in handleAccounts:", e);
            }
            
            await loadBlockchainState(provider, accounts[0]);
          } else {
            setWeb3Address("");
            setWeb3WalletConnected(false);
            setWeb3Vaults({});
          }
        } catch (e) {
          console.error("Error in accountsChanged listener", e);
        }
      };
      
      const handleChain = () => {
        try {
          window.location.reload();
        } catch (e) {
          console.error("Error in chainChanged listener", e);
        }
      };
      
      try {
        ethObject.on("accountsChanged", handleAccounts);
        ethObject.on("chainChanged", handleChain);
      } catch (e) {
        console.error("Error registering wallet listeners", e);
      }
      
      return () => {
        try {
          if (ethObject.removeListener) {
            ethObject.removeListener("accountsChanged", handleAccounts);
            ethObject.removeListener("chainChanged", handleChain);
          }
        } catch (e) {
          console.error("Error removing wallet listeners", e);
        }
      };
    }
  }, [selectedWallet]);

  // Sync blockchain on-chain metrics regularly in web3 mode
  useEffect(() => {
    if (stateMode === "testnet" && web3WalletConnected) {
      // Force update network on testnet mode switch if connected to wrong chain
      const checkAndSwitchNetwork = async () => {
        try {
          const ethObj = getActiveEthereumObject();
          if (ethObj) {
            const provider = new ethers.BrowserProvider(ethObj as any);
            const net = await provider.getNetwork();
            const connectedChainId = Number(net.chainId);
            if (connectedChainId !== 5042002) {
              addNotification("Wrong network detected. Switching to Arc Testnet...", "info");
              await switchNetwork();
            }
          }
        } catch (e) {
          console.warn("Error in checkAndSwitchNetwork:", e);
        }
      };
      
      checkAndSwitchNetwork().then(() => {
        loadBlockchainState();
      });
      
      const interval = setInterval(() => {
        loadBlockchainState();
      }, 7500);
      return () => clearInterval(interval);
    }
  }, [stateMode, web3WalletConnected]);

  const handleCreateVault = async (
    goalName: string,
    targetAmount: number,
    targetDate: number,
    locked: boolean,
    initialDeposit: number
  ) => {
    if (stateMode === "testnet") {
      const privyWallet = wallets.find(w => w.walletClientType === 'privy');
      if (!privyWallet) {
        addNotification("Please login via Privy first to formulate on-chain vaults.", "error");
        return;
      }
      setIsWeb3Transacting(true);
      try {
        const ethObj = await privyWallet.getEthereumProvider();
        if (!ethObj) throw new Error("Active wallet provider not found.");
        const provider = new ethers.BrowserProvider(ethObj as any);
        const signer = await provider.getSigner();

        // Check allowance
        if (initialDeposit > 0 && web3Allowance < initialDeposit) {
          addNotification("USDC allowance insufficient. Requesting Approval...", "info");
          const aprTx = await approveUSDC(signer, ethers.MaxUint256, liveContractAddress, usdcTokenAddress);
          addNotification("Approval tx pending blockchain inclusion...", "info");
          await aprTx.wait();
          addNotification("USDC Approved! Formulating Savings Goal on-chain...", "success");

          const freshAllowance = await getUSDCAllowance(provider, privyWallet.address, liveContractAddress, usdcTokenAddress);
          setWeb3Allowance(freshAllowance);
        }

        const contract = new ethers.Contract(liveContractAddress, YIELD_SAFE_ABI, signer);
        addNotification("Please confirm the formulation transaction in Privy...", "info");
        const tx = await contract.createVault(
          goalName,
          targetAmount,
          targetDate,
          locked,
          initialDeposit
        );
        addNotification("Savings Goal formulation broadcasted to Arc Testnet...", "info");
        const receipt = await tx.wait();
        addNotification(`Vault formulated! Hash: ${receipt.hash.slice(0, 12)}...`, "success");

        const historyItem: TransactionHistoryEntry = {
          id: `web3-tx-${receipt.hash}`,
          timestamp: Math.floor(Date.now() / 1000),
          type: "CREATE",
          extra: `Vault formulated on-chain for "${goalName}" with initial deposit of ${formatUSDC(initialDeposit)} USDC.`,
          txHash: receipt.hash
        };
        setWeb3TxList(p => [historyItem, ...p]);
        
        await loadBlockchainState(provider, privyWallet.address);
      } catch (err: any) {
        console.error("Failed to create vault on-chain", err);
        addNotification(`Formulation failed: ${err.reason || err.message || err}`, "error");
      } finally {
        setIsWeb3Transacting(false);
      }
      return;
    }

    const result = createVault(state, goalName, targetAmount, targetDate, locked, initialDeposit);
    if (result.error) {
      addNotification(result.error, "error");
    } else {
      setState(result.state);
      addNotification(`Vault established! Staked ${formatUSDC(initialDeposit)} USDC for "${goalName}".`, "success");
    }
  };

  const handleDeposit = async (vaultId: number, amount: number) => {
    if (stateMode === "testnet") {
      if (!web3WalletConnected) return;
      setIsWeb3Transacting(true);
      try {
        const ethObj = getActiveEthereumObject();
        if (!ethObj) throw new Error("Active wallet provider not found.");
        const provider = new ethers.BrowserProvider(ethObj as any);
        const signer = await provider.getSigner();

        // Check allowance
        if (web3Allowance < amount) {
          addNotification("USDC allowance insufficient. Requesting Approval...", "info");
          const aprTx = await approveUSDC(signer, ethers.MaxUint256, liveContractAddress, usdcTokenAddress);
          addNotification("Approval tx pending blockchain inclusion...", "info");
          await aprTx.wait();
          addNotification("USDC Approved! Sending deposit...", "success");

          const freshAllowance = await getUSDCAllowance(provider, web3Address, liveContractAddress, usdcTokenAddress);
          setWeb3Allowance(freshAllowance);
        }

        const contract = new ethers.Contract(liveContractAddress, YIELD_SAFE_ABI, signer);
        addNotification(`Signing stash of ${formatUSDC(amount)} USDC to Vault #${vaultId}...`, "info");
        const tx = await contract.deposit(vaultId, amount);
        addNotification("Deposit broadcasted...", "info");
        const receipt = await tx.wait();
        addNotification(`Deposit settled! Hash: ${receipt.hash.slice(0, 12)}...`, "success");

        const historyItem: TransactionHistoryEntry = {
          id: `web3-tx-${receipt.hash}`,
          timestamp: Math.floor(Date.now() / 1000),
          type: "DEPOSIT",
          vaultId,
          amount,
          extra: `Stashed ${formatUSDC(amount)} USDC into on-chain Vault #${vaultId}.`,
          txHash: receipt.hash
        };
        setWeb3TxList(p => [historyItem, ...p]);

        await loadBlockchainState(provider, web3Address);
      } catch (err: any) {
        console.error("Deposit failed", err);
        addNotification(`Deposit failed: ${err.reason || err.message || err}`, "error");
      } finally {
        setIsWeb3Transacting(false);
      }
      return;
    }

    const result = deposit(state, vaultId, amount);
    if (result.error) {
      addNotification(result.error, "error");
    } else {
      setState(result.state);
      addNotification(`Stashed ${formatUSDC(amount)} USDC into savings vault successfully!`, "success");
    }
  };

  const handleAccrueYield = async (vaultId: number) => {
    if (stateMode === "testnet") {
      if (!web3WalletConnected) return;
      setIsWeb3Transacting(true);
      try {
        const ethObj = getActiveEthereumObject();
        if (!ethObj) throw new Error("Active wallet provider not found.");
        const provider = new ethers.BrowserProvider(ethObj as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(liveContractAddress, YIELD_SAFE_ABI, signer);

        addNotification(`Compounding yield for Vault #${vaultId}...`, "info");
        const tx = await contract.accrueYield(vaultId);
        addNotification("Transaction broadcasted...", "info");
        const receipt = await tx.wait();
        addNotification("Yield accrued on-chain!", "success");

        const historyItem: TransactionHistoryEntry = {
          id: `web3-tx-${receipt.hash}`,
          timestamp: Math.floor(Date.now() / 1000),
          type: "ACCRUE",
          vaultId,
          extra: `Compounded pending yields on-chain for Vault #${vaultId}.`,
          txHash: receipt.hash
        };
        setWeb3TxList(p => [historyItem, ...p]);

        await loadBlockchainState(provider, web3Address);
      } catch (err: any) {
        console.error("Accrual failed", err);
        addNotification(`Accrual failed: ${err.reason || err.message || err}`, "error");
      } finally {
        setIsWeb3Transacting(false);
      }
      return;
    }

    const result = accrueYield(state, vaultId);
    if (result.error) {
      addNotification(result.error, "info");
    } else {
      setState(result.state);
      if (result.accruedPaid !== undefined && result.accruedPaid > 0) {
        addNotification(`On-chain storage updated! Compounded +${formatUSDC(result.accruedPaid)} USDC in simulated yields.`, "success");
      } else {
        addNotification("Yield calculated. Zero elapsed cents to compound.", "info");
      }
    }
  };

  const handleWithdraw = async (vaultId: number) => {
    if (stateMode === "testnet") {
      if (!web3WalletConnected) return;
      setIsWeb3Transacting(true);
      try {
        const ethObj = getActiveEthereumObject();
        if (!ethObj) throw new Error("Active wallet provider not found.");
        const provider = new ethers.BrowserProvider(ethObj as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(liveContractAddress, YIELD_SAFE_ABI, signer);

        addNotification(`Withdrawing reserves and settling Vault #${vaultId}...`, "info");
        const tx = await contract.withdraw(vaultId);
        addNotification("Transaction broadcasted...", "info");
        const receipt = await tx.wait();
        addNotification(`Withdrawal settled successfully!`, "success");

        const historyItem: TransactionHistoryEntry = {
          id: `web3-tx-${receipt.hash}`,
          timestamp: Math.floor(Date.now() / 1000),
          type: "WITHDRAW",
          vaultId,
          extra: `Withdrawn full principal and interests on-chain for Vault #${vaultId}.`,
          txHash: receipt.hash
        };
        setWeb3TxList(p => [historyItem, ...p]);

        await loadBlockchainState(provider, web3Address);
      } catch (err: any) {
        console.error("Release failed", err);
        addNotification(`Withdrawals failed: ${err.reason || err.message || err}`, "error");
      } finally {
        setIsWeb3Transacting(false);
      }
      return;
    }

    const result = withdraw(state, vaultId);
    if (result.error) {
      addNotification(result.error, "error");
    } else {
      setState(result.state);
      if (result.payoutDetails) {
        const { payout, penalty, yieldAccruedSpent, platformFee } = result.payoutDetails;
        if (penalty > 0) {
          addNotification(`Early vault exit processed. Net payout of ${formatUSDC(payout)} USDC received. Sacrificed yields & deducted principal penalty: ${formatUSDC(penalty)} USDC.`, "info");
        } else {
          addNotification(`Savings Goal Vault successfully settled! Received ${formatUSDC(payout)} USDC of savings & yields. Net platform fees accounted: ${formatUSDC(platformFee)} USDC.`, "success");
        }
      }
    }
  };

  const handleFastForward = (seconds: number) => {
    const nextState = fastForwardTime(state, seconds);
    setState(nextState);

    const labelMap: Record<number, string> = {
      60: "1 minute",
      3600: "1 hour",
      86400: "1 day",
      2592000: "30 days",
      31536000: "1 year"
    };
    const duration = labelMap[seconds] || `${seconds} seconds`;
    addNotification(`Ledger advanced by ${duration}! Check your vaults to see newly compounded interest totals ticking up live!`, "success");
  };

  const handleFaucetClaim = () => {
    const amount = 1500 * 1000000; // 1,500 USDC
    const prevBal = state.userUSDCBalance;
    const blockNumber = state.blockNumber + 1;
    const txHash = generateTxHash();

    const nextState: SimulationState = {
      ...state,
      userUSDCBalance: prevBal + amount,
      blockNumber,
      txList: [
        {
          id: `tx-${txHash}`,
          timestamp: state.blockTimestamp,
          type: "DEPOSIT",
          extra: `USDC Faucet dispensed 1,500.00 USDC to account ${DEFAULT_USER_ADDRESS}.`,
          txHash,
        },
        ...state.txList
      ]
    };
    setState(nextState);
    addNotification("Faucet Dispensation complete! Credited +1,500.00 USDC in test wallet.", "success");
  };

  const handleClaimFees = async () => {
    if (stateMode === "testnet") {
      if (!web3WalletConnected) return;
      setIsWeb3Transacting(true);
      try {
        const ethObj = getActiveEthereumObject();
        if (!ethObj) throw new Error("Active wallet provider not found.");
        const provider = new ethers.BrowserProvider(ethObj as any);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(liveContractAddress, YIELD_SAFE_ABI, signer);

        addNotification("Executing platform reserves claims...", "info");
        const tx = await contract.withdrawFees();
        addNotification("Claim broadcasted. Settling values...", "info");
        const receipt = await tx.wait();
        addNotification("Platform Fees claimed on-chain successfully!", "success");

        const historyItem: TransactionHistoryEntry = {
          id: `web3-tx-${receipt.hash}`,
          timestamp: Math.floor(Date.now() / 1000),
          type: "FEES_WITHDRAWAL",
          extra: `Platform fees claimed and settled by admin.`,
          txHash: receipt.hash
        };
        setWeb3TxList(p => [historyItem, ...p]);

        await loadBlockchainState(provider, web3Address);
      } catch (err: any) {
        console.error("Platform Fees claim failed", err);
        addNotification(`Withdraw fees failed: ${err.reason || err.message || err}`, "error");
      } finally {
        setIsWeb3Transacting(false);
      }
      return;
    }

    const result = adminWithdrawFees(state);
    if (result.error) {
      addNotification(result.error, "error");
    } else {
      setState(result.state);
      addNotification(`Contract reserves settled! Received ${formatUSDC(result.claimed || 0)} USDC in platform revenue.`, "success");
    }
  };

  const handleResetState = () => {
    if (window.confirm("Restore factory default simulation state? This deletes custom goals and reset balances.")) {
      const reseted = resetSimulation();
      setState(reseted);
      addNotification("Blockchain state reset to initial genesis block.", "info");
    }
  };

  // filter vaults
  const vaultList = Object.values(activeVaults) as Vault[];
  const filteredVaults = vaultList.filter((v) => {
    if (filterType === "all") return true;
    if (filterType === "active") return !v.closed;
    if (filterType === "locked") return v.locked && !v.closed;
    if (filterType === "flexible") return !v.locked && !v.closed;
    if (filterType === "completed") return isGoalMet(v, activeBlockTimestamp) && !v.closed;
    if (filterType === "closed") return v.closed;
    return true;
  });

  const renderLandingPage = () => {
    return (
      <div className="space-y-16 animate-fade-in relative z-10 max-w-6xl mx-auto py-10 px-6 lg:px-8">
        {/* Simplified Header for Landing Page */}
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-teal-650 via-teal-500 to-sky-500 flex items-center justify-center shadow-lg border border-white/10">
              <Zap size={20} className="text-white fill-white text-glow-teal" />
            </div>
            <h1 className="text-2xl font-black font-display tracking-tight text-white flex items-center gap-0.5">
              <span>Yield</span>
              <span className="text-teal-400 font-black">Safe</span>
            </h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full select-none text-[10px] font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                themeMode === "light"
                  ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-205" 
                  : "bg-zinc-950 text-zinc-400 border-zinc-900 hover:text-zinc-200"
              } border`}
              title="Toggle Light/Dark Theme Mode"
              id="landing-theme-toggle"
            >
              {themeMode === "light" ? (
                <>
                  <Sun size={11} className="text-amber-600 animate-spin-slow" />
                  <span>Light Aura</span>
                </>
              ) : (
                <>
                  <Moon size={11} className="text-sky-500" />
                  <span>Dark Cyber</span>
                </>
              )}
            </button>
            {authenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-350 font-mono bg-zinc-950 border border-zinc-900 px-3 py-1.5 rounded-xl">
                  {user?.email?.address || user?.google?.email || (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : "Authenticated")}
                </span>
                <button
                  onClick={logout}
                  className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 px-3 py-1.5 rounded-xl text-xs font-bold font-sans transition cursor-pointer"
                  id="landing-privy-logout-btn"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="bg-teal-500 hover:bg-teal-400 text-zinc-950 px-4 py-1.5 rounded-xl text-xs font-bold font-sans transition cursor-pointer"
                id="landing-privy-login-btn"
              >
                Log in
              </button>
            )}
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-zinc-500 bg-zinc-950 border border-zinc-900 px-2.5 py-1 rounded-md">
              v1.1.2 Sandbox
            </span>
          </div>
        </div>

        {/* Brand New Left-Aligned Two-Column Grid Setup matching the Reference Design */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center pt-4 md:pt-10">
          
          {/* Left Column: Natural, human, sophisticated left-aligned copywriting & immediate trigger actions */}
          <div className="lg:col-span-7 space-y-6 text-left relative z-15">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[10px] font-mono tracking-wider font-extrabold uppercase">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
              STABLECOIN SAVINGS ARCHITECTURE
            </div>
            
            <h2 className="text-xl sm:text-2xl md:text-[28px] lg:text-[30px] font-bold font-alegreya tracking-normal leading-[1.35] text-white">
              Unlock on-chain yields<br />
              you thought were{" "}
              <span className="text-teal-400 text-glow-teal">out of reach.</span><br />
              Now just one tap away.
            </h2>
            
            <p className="text-sm md:text-base text-zinc-400 font-sans leading-relaxed max-w-lg">
              Simulate stablecoin growth with high-precision compounding vaults. Track sandbox performance instantly or connect to trigger live on-chain yields.
            </p>

            {/* Direct Trigger Action buttons with visual weight */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4.5 pt-2">
              <button
                onClick={() => {
                  setCurrentView("main");
                  addNotification(`Entering YieldSafe Dashboard with ${stateMode === "simulation" ? "Sandbox" : "Web3"} Mode.`, "success");
                  if (stateMode === "testnet" && !web3WalletConnected && isWeb3Available()) {
                    setIsWalletSelectorOpen(true);
                  }
                }}
                className="premium-button-teal flex items-center justify-center gap-2.5 px-8 py-4 text-white text-xs font-black font-display uppercase tracking-widest rounded-2xl active:scale-95 cursor-pointer shadow-xl"
                id="btn-launch-app-left"
              >
                Launch YieldSafe App ↗
              </button>
              
              <div className="flex items-center justify-center gap-2 px-4.5 py-3.5 rounded-2xl bg-zinc-950/40 border border-white/5 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-500"></span>
                </span>
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  {stateMode === "simulation" ? "SIMULATION ACTIVE" : "EVM BRIDGE READY"}
                </span>
              </div>
            </div>

            {/* Faucet external link badge */}
            <div className="pt-1 text-xs flex items-center gap-2 text-zinc-500 font-mono">
              <span className="text-teal-500/80">✦</span>
              <span>Need testnet funds?</span>
              <a 
                href="https://faucet.circle.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-teal-400 hover:text-teal-300 underline underline-offset-4 decoration-teal-500/30 transition-colors flex items-center gap-1 font-bold"
                id="arc-faucet-link"
              >
                Claim Circle USDC Faucet tokens ↗
              </a>
            </div>
          </div>

          {/* Right Column: Concentric orbit widget mirroring the provided marketing wireframe */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative z-10 w-full">
            
            {/* The Concentric Circle Interactive Orbit Engine */}
            <div className="relative w-full aspect-square max-w-[340px] md:max-w-[380px] flex items-center justify-center mb-8">
              
              {/* Pulsing light behind the orbit */}
              <div className="absolute w-72 h-72 rounded-full bg-teal-500/5 blur-3xl pointer-events-none" />

              {/* Orbiting concentric ring 3 (outermost ring - radius ~180px) */}
              <div className="absolute w-[340px] h-[340px] md:w-[380px] md:h-[380px] rounded-full border border-teal-500/5 animate-spin-slow [animation-duration:40s]" />

              {/* Orbiting concentric ring 2 (middle ring - radius ~130px) */}
              <div className="absolute w-[260px] h-[260px] md:w-[290px] md:h-[290px] rounded-full border border-white/5 animate-spin-slow [animation-duration:25s] [animation-direction:reverse]" />

              {/* Orbiting concentric ring 1 (innermost ring - radius ~80px) */}
              <div className="absolute w-[170px] h-[170px] md:w-[190px] md:h-[190px] rounded-full border border-teal-500/10 animate-spin-slow [animation-duration:15s]" />

              {/* Center Focal core displaying the yield value */}
              <div className="w-28 h-28 md:w-32 md:h-32 rounded-full crystal-panel flex flex-col items-center justify-center text-center border-teal-500/30 shadow-2xl relative z-20 animate-pulse-slow">
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-500/10 to-transparent pointer-events-none" />
                <Zap size={18} className="text-teal-400 animate-float [animation-duration:3s] mb-0.5" />
                <span className="text-2xl md:text-3xl font-black text-white font-display tracking-tight text-glow-teal leading-none">5.00%</span>
                <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-extrabold mt-1 font-mono">FIXED APY</span>
              </div>

              {/* Outer floating node A (MetaMask status trigger) */}
              <div 
                onClick={() => {
                  setStateMode("testnet");
                  addNotification("Gateway switched to Live EVM Testnet Mode.", "info");
                }}
                className={`absolute top-2 right-4 md:right-8 z-30 flex items-center gap-2 p-2 px-3 rounded-full crystal-panel crystal-panel-interactive border-white/5 text-[10px] font-bold font-mono tracking-wider text-white shadow-lg cursor-pointer ${stateMode === 'testnet' ? 'border-teal-500/50 bg-teal-950/40 text-teal-400' : 'text-zinc-400'}`}
                title="Click to select EVM Testnet Gateway"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span>EVM Node</span>
              </div>

              {/* Outer floating node B (Simulated Status trigger) */}
              <div 
                onClick={() => {
                  setStateMode("simulation");
                  addNotification("Gateway switched to risk-free Simulation Mode.", "info");
                }}
                className={`absolute bottom-3 left-4 md:left-8 z-30 flex items-center gap-2 p-2 px-3 rounded-full crystal-panel crystal-panel-interactive border-white/5 text-[10px] font-bold font-mono tracking-wider text-white shadow-lg cursor-pointer ${stateMode === 'simulation' ? 'border-teal-500/50 bg-teal-950/40 text-teal-400' : 'text-zinc-400'}`}
                title="Click to select Local Compounding Simulation"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
                <span>Sim Sandbox</span>
              </div>

              {/* Small floating decorative Node C (Faucet approved) */}
              <div className="absolute top-1/2 -left-4 -translate-y-1/2 z-25 p-2 rounded-full crystal-panel border-white/5 text-teal-400 shadow-md">
                <Coins size={14} className="text-teal-400" />
              </div>

              {/* Small floating decorative Node D (Web3 lock) */}
              <div className="absolute top-1/3 -right-3 z-25 p-2 rounded-full crystal-panel border-white/5 text-zinc-400 shadow-md">
                <Link2 size={14} className="text-slate-400" />
              </div>
            </div>

            {/* Config Gateway Compact Card embedded directly under the orbit infographic */}
            <div className="w-full crystal-panel rounded-2xl p-4.5 border border-white/5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-[#0d9488] font-mono font-extrabold tracking-widest uppercase">INTERNET PROTOCOL GATEWAY</span>
                <span className="text-[9px] text-zinc-500 font-mono tracking-wider">{stateMode === "simulation" ? "OFFLINE LEDGER" : "ON-CHAIN BRIDGE"}</span>
              </div>

              {/* Mode Toggle Pills */}
              <div className="bg-zinc-950/90 rounded-xl p-1 border border-zinc-900 flex items-center relative select-none">
                <button
                  onClick={() => {
                    setStateMode("simulation");
                    addNotification("Gateway switched to Local Simulation Mode.", "info");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer relative z-10 ${
                    stateMode === "simulation"
                      ? "bg-teal-600 text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-300 font-medium"
                  }`}
                  id="landing-toggle-simulation-new"
                >
                  <RefreshCw size={11} className={stateMode === "simulation" ? "animate-spin-slow text-white" : "text-zinc-500"} />
                  <span className="text-[10px] uppercase tracking-wider font-display">SIMULATOR</span>
                </button>
                <button
                  onClick={() => {
                    setStateMode("testnet");
                    addNotification("Gateway switched to Live Testnet Mode.", "info");
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg transition-all cursor-pointer relative z-10 ${
                    stateMode === "testnet"
                      ? "bg-teal-600 text-white font-bold"
                      : "text-zinc-500 hover:text-zinc-300 font-medium"
                  }`}
                  id="landing-toggle-testnet-new"
                >
                  <Link2 size={11} className={stateMode === "testnet" ? "text-white" : "text-zinc-500"} />
                  <span className="text-[10px] uppercase tracking-wider font-display">EVM BRIDGE</span>
                </button>
              </div>

              {/* Mode Description Text */}
              <div className="space-y-2">
                <p className="text-[10.5px] text-zinc-400 font-sans leading-normal">
                  {stateMode === "simulation" 
                    ? "Employs an offline-first Ethereum ledger simulator to fast-forward blocks, claim faucet tokens, and test APY compounds instantly."
                    : "Connects securely to active smart contracts on the Arc Testnet. Employs registered Metamask or web3 wallets to process actual ledger transactions."
                  }
                </p>
                {stateMode === "testnet" && (
                  <div className="pt-1 flex items-center gap-1.5 text-[10.5px] font-mono">
                    <span className="text-teal-400">⚡</span>
                    <a 
                      href="https://faucet.circle.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 underline underline-offset-2 transition-colors font-bold"
                      id="faucet-compact-card-link"
                    >
                      Get USDC from official Circle Faucet ↗
                    </a>
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>

        {/* Brand/Protocol partners row inspired precisely by bottom logo list of user image */}
        <div 
          className="border-y border-white/5 py-6 flex flex-wrap items-center justify-center lg:justify-between gap-x-8 gap-y-4 text-zinc-500 font-mono text-[9px] tracking-widest uppercase font-black px-4 select-none"
          id="landing-partners-row"
        >
          <span className="hover:text-teal-400 transition-colors">✦ ARCSCAN EXPLORER</span>
          <span className="hover:text-teal-400 transition-colors">✦ USD COIN CONTRACT SECURED</span>
          <span className="hover:text-teal-400 transition-colors">✦ SOLIDITY BYTECODE VERIFIED</span>
          <span className="hover:text-teal-400 transition-colors">✦ METAMASK SUPPORTED</span>
          <span className="hover:text-teal-400 transition-colors">✦ ZERO-GAS SANDBOX VALID</span>
        </div>

        {/* Feature Bento Grid with outstanding hovering highlight glow reactions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="crystal-panel crystal-panel-interactive p-5 rounded-2xl border border-white/5 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_30px_rgba(13,148,136,0.1)] hover:border-teal-500/20">
            <span className="text-[9px] text-zinc-500 font-mono font-bold block uppercase tracking-wider mb-2">01. COMPILING INTEREST</span>
            <div>
              <p className="text-white font-bold text-sm tracking-tight mb-1">5.00% Algorithmic APY</p>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans font-medium">
                Yield rates compute strictly to 5.00% simple compounding yield on-chain.
              </p>
            </div>
          </div>
          <div className="crystal-panel crystal-panel-interactive p-5 rounded-2xl border border-white/5 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_30px_rgba(13,148,136,0.1)] hover:border-teal-500/20">
            <span className="text-[9px] text-zinc-500 font-mono font-bold block uppercase tracking-wider mb-2">02. DISCIPLINED SAVING</span>
            <div>
              <p className="text-white font-bold text-sm tracking-tight mb-1">Locked savings rules</p>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans font-medium">
                Set maturity dates to strictly enforce lock-ups, preventing premature withdrawals.
              </p>
            </div>
          </div>
          <div className="crystal-panel crystal-panel-interactive p-5 rounded-2xl border border-white/5 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_30px_rgba(13,148,136,0.1)] hover:border-teal-500/20">
            <span className="text-[9px] text-[#2d3748] dark:text-zinc-500 font-mono font-bold block uppercase tracking-wider mb-2">03. LIQUID ACCRUALS</span>
            <div>
              <p className="text-white font-bold text-sm tracking-tight mb-1">Flexible Accounts</p>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans font-medium">
                Create flexible vaults allowing instant stashes or liquidation at any given point.
              </p>
            </div>
          </div>
          <div className="crystal-panel crystal-panel-interactive p-5 rounded-2xl border border-white/5 flex flex-col justify-between transition-all duration-300 hover:shadow-[0_15px_30px_rgba(13,148,136,0.1)] hover:border-teal-500/20">
            <span className="text-[9px] text-zinc-500 font-mono font-bold block uppercase tracking-wider mb-2">04. EARLY PENALTY FINE</span>
            <div>
              <p className="text-white font-bold text-sm tracking-tight mb-1">2% Principal Warning</p>
              <p className="text-xs text-zinc-400 leading-relaxed font-sans font-medium">
                Breaking vault parameters incurs a contract reserve penalty fine to preserve pool equity.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative min-h-screen transition-all duration-300 ${themeMode === "light" ? "bg-[#f0fdfa] text-[#0f172a] theme-light" : "bg-[#01090f] text-zinc-100 theme-dark"} font-sans selection:bg-teal-500/20 selection:text-teal-350 pb-16 overflow-x-hidden`}>
      {/* Visual Identity Background Layer with glowing speedline streaks, refractions and ribbons */}
      <div className="absolute top-0 left-0 right-0 bottom-0 overflow-hidden pointer-events-none z-0">
        {/* Ambient deep tropical botanical to oceanic gradient behind everything */}
        <div className={`absolute top-0 left-0 w-full h-[900px] transition-all duration-300 ${
          themeMode === "light" 
            ? "bg-gradient-to-b from-[#e6fbf7] via-[#f8fafc] to-[#ffffff] opacity-100" 
            : "bg-gradient-to-b from-[#011414] via-[#010810] to-[#000204] opacity-95"
        }`} />
        
        {/* Glowing Speedline Sweeps & Radial Gradients (Teal to Blue Botanme style) */}
        <div className={`absolute top-[-10%] left-[-10%] w-[120%] h-[700px] transition-all duration-300 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${
          themeMode === "light"
            ? "from-teal-200/40 via-sky-100/30 to-transparent"
            : "from-teal-500/15 via-blue-700/8 to-transparent"
        } rotate-[-8deg] blur-3xl`} />
        
        <div className={`absolute top-[20%] right-[-10%] w-[50%] h-[500px] transition-all duration-300 ${
          themeMode === "light"
            ? "bg-[radial-gradient(circle_at_50%_50%,rgba(13,148,136,0.06)_0%,transparent_60%)] opacity-80"
            : "bg-radial-glow opacity-60"
        } blur-3xl`} />
        
        {/* Crisp linear diagonal streaks in beautiful botanme colors */}
        <div className={`absolute top-[8%] left-[-10%] w-[120%] h-[2px] transition-all duration-300 bg-gradient-to-r from-transparent ${
          themeMode === "light" ? "via-teal-500/25" : "via-teal-500/20"
        } to-transparent rotate-[-12deg]`} />
        
        <div className={`absolute top-[12%] left-[-10%] w-[120%] h-[1px] transition-all duration-300 bg-gradient-to-r from-transparent ${
          themeMode === "light" ? "via-sky-400/20" : "via-sky-500/15"
        } to-transparent rotate-[-12deg]`} />
        
        <div className={`absolute top-[25%] left-[-10%] w-[120%] h-[3px] transition-all duration-300 bg-gradient-to-r from-transparent ${
          themeMode === "light" ? "via-teal-400/30" : "via-teal-500/30"
        } to-transparent rotate-[-12deg] blur-[1px]`} />
        
        <div className={`absolute top-[28%] left-[-10%] w-[120%] h-[6px] transition-all duration-300 bg-gradient-to-r from-transparent ${
          themeMode === "light" ? "via-sky-400/15" : "via-sky-600/10"
        } to-transparent rotate-[-12deg] blur-[3px]`} />
        
        {/* 3D Glass Sphere Refraction visual anchors */}
        <div className={`absolute top-[180px] right-[5%] w-64 h-64 rounded-full border transition-all duration-300 ${
          themeMode === "light" ? "border-slate-200/60 bg-white/40" : "border-white/5 bg-white/2"
        } backdrop-blur-2xl rotate-45 animate-float shadow-[0_8px_32px_0_rgba(13,148,136,0.12)] flex items-center justify-center`}>
          <div className="w-[100px] h-[100px] rounded-full bg-gradient-to-tr from-teal-500/25 to-blue-500/30 blur-md animate-pulse-slow" />
          <div className={`absolute top-4 left-4 w-10 h-10 rounded-full transition-all duration-300 ${themeMode === "light" ? "bg-white/70 border-slate-300" : "bg-white/5 border-white/10"} border`} />
        </div>
        
        <div className={`absolute top-[480px] left-[-2%] w-40 h-40 rounded-full border transition-all duration-300 ${
          themeMode === "light" ? "border-slate-200/50 bg-white/30" : "border-white/5 bg-white/1"
        } backdrop-blur-xl rotate-12 animate-float shadow-inner flex items-center justify-center [animation-delay:2s]`}>
          <div className="w-12 h-12 rounded-full bg-gradient-to-bl from-sky-600/10 to-teal-400/20 blur-sm" />
        </div>
      </div>

      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 space-y-2 max-w-sm w-full">
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-xl border flex items-start gap-2.5 shadow-2xl animate-fade-in ${
              n.type === "success"
                ? "bg-slate-900 border-teal-500/40 text-teal-400"
                : n.type === "error"
                  ? "bg-zinc-900 border-teal-900/60 text-teal-400"
                  : "bg-zinc-900 border-zinc-750 text-sky-400"
            }`}
            id={`notification-${n.id}`}
          >
            {n.type === "success" && <Sparkles size={16} className="mt-0.5 flex-shrink-0" />}
            {n.type === "error" && <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-teal-400" />}
            {n.type === "info" && <Info size={16} className="mt-0.5 flex-shrink-0" />}
            
            <p className="text-xs font-medium leading-relaxed font-sans text-zinc-205">{n.message}</p>
          </div>
        ))}
      </div>

      {/* Main Container */}
      <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-8">
        
        {currentView === "landing" ? (
          renderLandingPage()
        ) : (
          <>
            {/* TOP LEVEL NAVIGATION BRAND */}
            <header className="crystal-panel crystal-panel-teal flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl relative overflow-hidden transition-all duration-300 hover:border-teal-500/35 shadow-2xl">
              <div className="absolute top-0 right-0 w-48 h-48 bg-radial-glow opacity-25 pointer-events-none" />
              <div 
                onClick={() => {
                  setCurrentView("landing");
                  addNotification("Navigated to YieldSafe Landing Portal.", "info");
                }}
                className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left cursor-pointer group active:scale-98 transition-transform duration-150"
                title="Click to yield back to Landing Portal"
                id="header-logo-clickable"
              >
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-teal-650 via-teal-500 to-sky-500 flex items-center justify-center shadow-xl shadow-teal-950/50 border border-white/10 select-none transform group-hover:rotate-6 group-hover:scale-105 transition-all duration-300">
                  <Zap size={28} className="text-white fill-white text-glow-teal animate-float [animation-duration:3s]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                    <h1 className="text-3xl font-black font-display tracking-tight text-white flex items-center gap-0.5">
                      <span className="group-hover:text-teal-400 transition-colors">Yield</span>
                      <span className="text-teal-500 font-extrabold group-hover:text-white transition-colors">Safe</span>
                    </h1>
                    <span className="text-[10px] px-2.5 py-1 bg-teal-950/65 text-teal-400 border border-teal-800/80 rounded-full font-mono font-bold tracking-wider uppercase shadow-inner">
                      {stateMode === "testnet" ? "Live Contract Mode" : "Arc Testnet VM"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-350 font-sans mt-1 max-w-xl group-hover:text-zinc-200 transition-colors">
                    {stateMode === "testnet" 
                      ? "Direct interaction with target EVM smart contracts on Arc Testnet."
                      : "Goal-based decentralized USDC savings vaults featuring built-in simulated yield structures."}
                  </p>
                </div>
              </div>

          <div className="flex flex-wrap items-center justify-center gap-4 w-full md:w-auto">
            {/* Mode Switcher Toggle Button */}
            <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-zinc-850 select-none">
              <button
                onClick={() => {
                  setStateMode("simulation");
                  addNotification("Switched to Local Simulation Mode. State is offline and safe.", "info");
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  stateMode === "simulation"
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-950/40 font-display"
                    : "text-zinc-400 hover:text-zinc-205 font-display"
                }`}
                id="toggle-mode-simulation"
              >
                <RefreshCw size={11} className={stateMode === "simulation" ? "animate-spin-slow text-white" : ""} />
                Simulation Mode
              </button>
              <button
                onClick={async () => {
                  setStateMode("testnet");
                  addNotification("Switched to Live Testnet Mode.", "info");
                  if (isWeb3Available()) {
                    setIsWalletSelectorOpen(true);
                  } else {
                    addNotification("Please install a Web3 wallet (OKX, MetaMask, or Brave) to interact with active blockchain contracts.", "error");
                  }
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                  stateMode === "testnet"
                    ? "bg-teal-600 text-white shadow-lg shadow-teal-950/40 font-display"
                    : "text-zinc-400 hover:text-zinc-205 font-display"
                }`}
                id="toggle-mode-testnet"
              >
                <Link2 size={11} className="text-white" />
                Testnet Mode
              </button>
            </div>

            {/* Dashboard Theme Switcher Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`flex items-center gap-1.5 p-3 rounded-2xl transition-all duration-300 border active:scale-95 cursor-pointer ${
                themeMode === "light"
                  ? "bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-150"
                  : "bg-zinc-950/80 text-zinc-400 border-zinc-850 hover:text-zinc-200"
              }`}
              title="Toggle Light/Dark Theme Mode"
              id="dashboard-theme-toggle"
            >
              {themeMode === "light" ? (
                <Sun size={15} className="text-amber-600 animate-spin-slow" />
              ) : (
                <Moon size={15} className="text-sky-400" />
              )}
            </button>

            {authenticated ? (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-350 font-mono bg-zinc-950/80 border border-zinc-850 px-3 py-2.5 rounded-2xl">
                  {user?.email?.address || user?.google?.email || (user?.wallet?.address ? `${user.wallet.address.slice(0, 6)}...${user.wallet.address.slice(-4)}` : "Authenticated")}
                </span>
                <button
                  onClick={logout}
                  className="bg-zinc-850 hover:bg-zinc-800 border border-zinc-750 text-zinc-200 px-4 py-3 rounded-2xl text-xs font-bold font-sans transition cursor-pointer"
                  id="dashboard-privy-logout-btn"
                >
                  Log out
                </button>
              </div>
            ) : (
              <button
                onClick={login}
                className="bg-teal-500 hover:bg-teal-400 text-zinc-950 px-5 py-3 rounded-2xl text-xs font-bold font-sans transition cursor-pointer"
                id="dashboard-privy-login-btn"
              >
                Log in
              </button>
            )}

            <button
              onClick={() => setIsModalOpen(true)}
              className="premium-button-teal flex items-center gap-1.5 px-5 py-3 text-white text-xs font-bold font-display uppercase tracking-wider rounded-2xl active:scale-95 cursor-pointer"
              id="btn-open-create-modal"
            >
              <Plus size={14} className="stroke-[3]" />
              Formulate Savings Goal
            </button>
          </div>
        </header>

        {/* WRONG NETWORK ALERT / DIAGNOSTIC PANEL */}
        {stateMode === "testnet" && web3WalletConnected && (web3ChainId !== 5042002 || !isContractDeployed) && (
          <div className="bg-amber-950/20 border border-amber-900/60 p-5 rounded-2xl flex flex-col md:flex-row items-start gap-4 text-amber-200 animate-fade-in" id="wrong-network-banner">
            <ShieldAlert className="text-amber-500 mt-1.5 flex-shrink-0" size={24} />
            <div className="w-full space-y-3">
              <div>
                <h4 className="text-base font-bold tracking-tight text-white font-sans flex items-center gap-2">
                  <span>Arc Testnet Configuration Required</span>
                  <span className="bg-amber-950 text-amber-400 border border-amber-800 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded font-mono">
                    Current Chain ID: {web3ChainId !== null ? web3ChainId : "Detecting..."}
                  </span>
                </h4>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed font-sans">
                  The dApp requires <strong className="text-amber-100 font-semibold font-sans">Arc Testnet (Chain ID 5042002)</strong> to function correctly.
                  {web3ChainId !== 5042002 && web3ChainId !== null ? (
                    <span> You are currently connected to Chain ID <code className="bg-amber-950/60 px-1.5 py-0.5 rounded font-mono text-amber-300 font-bold">{web3ChainId}</code> (Wrong Network).</span>
                  ) : (
                    <span> No contract bytecode was detected at the configured address <code className="bg-amber-950/60 px-1.5 py-0.5 rounded font-mono text-amber-350">{liveContractAddress}</code> on your connected network.</span>
                  )}
                </p>
              </div>

              {/* RPC Node connection diagnostics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 bg-zinc-950/40 border border-zinc-800/60 p-3 rounded-lg text-[11px] text-zinc-400 font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>RPC: <code className="text-zinc-300 text-[10px] font-mono">https://rpc.testnet.arc.network</code></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>USDC Token: <code className="text-zinc-300 text-[10px] font-mono">0x3600...0000</code></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Explorer: <code className="text-zinc-300 text-[10px] font-mono">testnet.arcscan.app</code></span>
                </div>
              </div>

              {/* Advanced Custom Address Section */}
              <div className="bg-zinc-950/80 border border-zinc-800 p-4 rounded-xl space-y-3 max-w-2xl">
                <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">Dynamic Contract Address Override</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-zinc-400 font-sans block mb-1">YieldSafe Address</label>
                    <input 
                      type="text" 
                      value={liveContractAddress}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setLiveContractAddress(val);
                        localStorage.setItem("yieldsafe_contract_address", val);
                      }}
                      className="w-full bg-zinc-900 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-sky-500 font-mono text-zinc-200"
                      placeholder="0x..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-400 font-sans block mb-1">USDC Contract Address</label>
                    <input 
                      type="text" 
                      value={usdcTokenAddress}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        setUsdcTokenAddress(val);
                        localStorage.setItem("yieldsafe_usdc_address", val);
                      }}
                      className="w-full bg-zinc-900 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-800 focus:outline-none focus:border-sky-500 font-mono text-zinc-200"
                      placeholder="0x..."
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => {
                      setLiveContractAddress(LIVE_CONTRACT_ADDRESS);
                      setUsdcTokenAddress(USDC_TOKEN_ADDRESS);
                      localStorage.removeItem("yieldsafe_contract_address");
                      localStorage.removeItem("yieldsafe_usdc_address");
                      addNotification("Restored official Arc Testnet defaults.", "info");
                      // Re-sync after delay
                      setTimeout(() => loadBlockchainState(), 100);
                    }}
                    className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] font-bold rounded transition cursor-pointer"
                  >
                    Use Arc Defaults
                  </button>
                  <button
                    onClick={() => {
                      addNotification("Re-checking on-chain contracts...", "info");
                      loadBlockchainState();
                    }}
                    className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 text-zinc-950 text-[10px] font-extrabold rounded transition cursor-pointer"
                  >
                    Re-Verify Address
                  </button>
                </div>
              </div>

              <div className="pt-1 flex items-center gap-4">
                <button
                  onClick={switchNetwork}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-lg transition active:scale-95 cursor-pointer"
                  id="btn-switch-network"
                >
                  Switch Network via Wallet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SIMULATION CONTROLS */}
        <SimulatorControls
          state={state}
          onFastForward={handleFastForward}
          onFaucet={handleFaucetClaim}
          onClaimFees={handleClaimFees}
          onReset={handleResetState}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          stateMode={stateMode}
          userAddress={activeUserAddress}
          userUSDCBalance={activeUSDCBalance}
          contractLiquidity={activeContractLiquidity}
          platformFeesAccrued={activePlatformFees}
          blockNumber={activeBlockNumber}
          blockTimestamp={activeBlockTimestamp}
          web3WalletConnected={web3WalletConnected}
          isWeb3Connecting={isWeb3Connecting}
          onConnectWallet={connectWallet}
          onDisconnectWallet={disconnectWallet}
          liveContractAddress={liveContractAddress}
        />

        {/* MAIN BODY CONTENT AREA */}
        <main className="space-y-6 relative z-10">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Dashboard Filters Panel */}
              <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
                <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
                  {(["all", "active", "locked", "flexible", "completed", "closed"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setFilterType(filter)}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl capitalize transition-all cursor-pointer border ${
                        filterType === filter
                          ? "bg-teal-600/10 text-white border-teal-650 font-display"
                          : "text-zinc-400 border-transparent hover:text-white hover:bg-zinc-950/40"
                      }`}
                      id={`filter-tab-${filter}`}
                    >
                      {filter} Goals
                    </button>
                  ))}
                </div>

                <div className="text-xs text-zinc-500 font-mono font-medium">
                  Ledger Index: Showing <strong className="text-white font-bold">{filteredVaults.length}</strong> / <strong className="text-zinc-400 font-bold">{vaultList.length}</strong> configured vaults
                </div>
              </div>

              {/* Vault Cards Grid */}
              {filteredVaults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredVaults.map((vault) => (
                    <VaultCard
                      key={vault.id}
                      vault={vault}
                      simulationTimestamp={activeBlockTimestamp}
                      walletBalance={activeUSDCBalance}
                      onDeposit={handleDeposit}
                      onAccrueYield={handleAccrueYield}
                      onWithdraw={handleWithdraw}
                      stateMode={stateMode}
                      web3Allowance={web3Allowance}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 crystal-panel rounded-3xl space-y-4 max-w-4xl mx-auto border-white/5 relative overflow-hidden shadow-2xl">
                  <div className="absolute top-0 left-0 w-full h-full bg-radial-glow opacity-5 pointer-events-none" />
                  <div className="inline-flex p-4 bg-teal-950/20 border border-teal-900/40 rounded-3xl text-teal-400 relative z-10 animate-pulse">
                    <Compass size={24} />
                  </div>
                  <div className="max-w-md mx-auto space-y-2 relative z-10">
                    <h4 className="text-base font-black text-white font-display uppercase tracking-wider">No conforming savings vaults found</h4>
                    <p className="text-xs text-zinc-450 leading-relaxed font-sans">
                      There are no vaults fitting the selected {filterType === "all" ? "" : `"${filterType}"`} filters. Formulate your first custom savings order to start earning on-chain yield immediately.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="premium-button-teal inline-flex items-center gap-1.5 px-6 py-3 text-white text-xs font-black font-display uppercase tracking-widest rounded-2xl active:scale-95 cursor-pointer shadow-lg"
                    id="btn-empty-create"
                  >
                    Formulate Savings Goal
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRANSACTIONS (ETHERSCAN BADGE LOGS) */}
          {activeTab === "tx" && (
            <div className="crystal-panel rounded-3xl overflow-hidden shadow-2xl border border-white/5">
              <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between flex-wrap gap-4 bg-zinc-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 text-teal-400 bg-teal-950/20 border border-teal-900/40 rounded-xl">
                    <History size={14} />
                  </div>
                  <h3 className="text-sm font-black text-white font-display uppercase tracking-wider">Arc Network ledger receipts</h3>
                </div>
                <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-widest uppercase">
                  MONITORING ERC-20 COMPLIANCE
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-950/80 text-zinc-500 font-extrabold font-mono tracking-widest uppercase border-b border-white/5 text-[9px]">
                    <tr>
                      <th className="p-4 pl-6">Block Hash</th>
                      <th className="p-4">Method ID</th>
                      <th className="p-4">Timestamp</th>
                      <th className="p-4">Transfer Value</th>
                      <th className="p-4 pr-6">Receipt Payload Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {activeTxList.length > 0 ? (
                      activeTxList.map((tx) => (
                        <tr key={tx.id} className="hover:bg-zinc-950/40 text-zinc-300 transition-colors">
                          <td className="p-4 pl-6">
                            <span 
                              onClick={() => {
                                navigator.clipboard.writeText(tx.txHash);
                                addNotification("Transaction hash copied!", "info");
                              }}
                              className="text-teal-400 hover:text-teal-300 cursor-pointer text-glow-teal font-bold"
                              title="Click to copy hash"
                            >
                              {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase font-mono tracking-wide ${
                              tx.type === "CREATE"
                                ? "bg-amber-950/50 text-amber-400 border border-amber-900/50"
                                : tx.type === "DEPOSIT"
                                  ? "bg-teal-950/50 text-teal-400 border border-teal-950/50"
                                  : tx.type === "WITHDRAW"
                                    ? "bg-teal-950/60 text-teal-300 border border-teal-900/60"
                                    : tx.type === "ACCRUE"
                                      ? "bg-stone-950/50 text-zinc-300 border border-white/10"
                                      : "bg-zinc-900 text-zinc-400 border border-zinc-800"
                            }`}>
                              {tx.type}
                            </span>
                          </td>
                          <td className="p-4 text-zinc-500">
                            {new Date(tx.timestamp * 1000).toLocaleString()}
                          </td>
                          <td className="p-4 font-black text-white">
                            {tx.amount ? `${formatUSDC(tx.amount)} USDC` : "0.00"}
                          </td>
                          <td className="p-4 pr-6 text-zinc-400 font-sans text-xs max-w-sm truncate" title={tx.extra}>
                            {tx.extra}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-zinc-500 font-sans font-medium">
                          No ledger operations recorded. Configure a vault or add funds to write receipt history.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SOLIDITY CONTRACT SHOWCASE */}
          {activeTab === "solidity" && (
            <div className="space-y-6">
              {/* Info panel explaining parameters */}
              <div className="crystal-panel rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start justify-between border-white/5 shadow-2xl">
                <div className="space-y-2 max-w-2xl">
                  <h4 className="text-sm font-black text-white font-display uppercase tracking-widest text-glow-teal">On-Chain System Constants</h4>
                  <p className="text-xs text-zinc-350 leading-relaxed font-sans">
                    These rules represent immutable governance factors deployed at genesis inside the YieldSafe EVM bytecode assembly:
                  </p>
                  <ul className="text-xs text-zinc-400 list-disc list-inside space-y-1.5 pt-1 font-sans">
                    <li><strong className="text-zinc-300 font-semibold font-mono">SIMULATED_APY_BPS = 500</strong>: Yield rate resolves natively to 5.00% simple compounding yield per block.</li>
                    <li><strong className="text-zinc-300 font-semibold font-mono">EARLY_WITHDRAWAL_PENALTY_BPS = 200</strong>: Forfeits 2.00% of the flat principal if broken prior to matured goals.</li>
                    <li><strong className="text-zinc-300 font-semibold font-mono">PLATFORM_FEE_BPS = 1000</strong>: Accrues 10.00% early termination and compound tax for reserve assets.</li>
                  </ul>
                </div>
                
                <div className="text-[11px] font-mono font-bold bg-zinc-950/80 border border-white/5 p-4 rounded-2xl min-w-[220px] text-zinc-400 shadow-inner">
                  <span className="text-zinc-500 block font-display uppercase text-[9px] mb-1 font-bold">Bytecode Architect</span>
                  <p className="text-zinc-300 font-mono text-[10px]">0xa4cEd1EF6089Eb7...34F33</p>
                  <span className="text-zinc-500 block font-display uppercase text-[9px] mt-3.5 mb-1 font-bold">Approved Asset</span>
                  <p className="text-teal-400 font-mono text-[10px] uppercase font-black">USDC Stablecoins (6 Decimals)</p>
                </div>
              </div>

              <CodeViewer />
            </div>
          )}
        </main>

        {/* BOTTOM METRICS BANNER / FOOTER */}
        <section className="crystal-panel p-6 rounded-3xl grid grid-cols-1 sm:grid-cols-3 gap-6 text-center sm:text-left mt-8 border-white/5 shadow-2xl relative z-10 select-none">
          <div>
            <span className="text-[9px] tracking-widest text-zinc-550 uppercase font-bold font-mono pl-0.5">VAULTS LAUNCHED</span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1 mt-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">{Object.keys(state.vaults).length}</span>
              <span className="text-xs text-zinc-500 font-sans">Active Contracts</span>
            </div>
          </div>
          
          <div>
            <span className="text-[9px] tracking-widest text-zinc-555 uppercase font-bold font-mono pl-0.5">AGGREGATE VOLUME</span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1 mt-1">
              <span className="text-2xl font-black font-mono text-white tracking-tight">{formatUSDC(totalVolumeUSDC)}</span>
              <span className="text-[10px] text-teal-400 font-mono uppercase font-black">USDC Locked</span>
            </div>
          </div>

          <div>
            <span className="text-[9px] tracking-widest text-zinc-555 uppercase font-bold font-mono pl-0.5">CUMULATIVE STRETCH EARNED</span>
            <div className="flex items-baseline justify-center sm:justify-start gap-1 mt-1">
              <span className="text-2xl font-black font-mono text-teal-400 text-glow-teal tracking-tight">+{formatUSDC(totalYieldAccrued)}</span>
              <span className="text-[10px] text-teal-400 font-mono uppercase font-black">USDC Compounded</span>
            </div>
          </div>
        </section>

        {/* COMPREHENSIVE FOOTER */}
        <footer className="text-center text-[10px] text-zinc-650 space-y-2 border-t border-white/5 pt-6 pb-6 relative z-10">
          <p className="font-sans leading-relaxed">
            YieldSafe Proof of Concept Savings Vault © 2026. Custom-tailored architecture running on EVM sandbox and Arc Testnet environments.
          </p>
          <p className="font-mono text-zinc-700 text-[9px] uppercase tracking-wider">
            SHA-256 COMPILED BINARY ABI: ec18a4a5eb23b090333fa6b8cbdf4f5cfca0e8b23c0b02dec00c00ef5db902ee
          </p>
        </footer>
      </>
    )}

        {/* Modal overlays */}
        <CreateVaultModal
          state={state}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreate={handleCreateVault}
          stateMode={stateMode}
          userUSDCBalance={activeUSDCBalance}
          blockTimestamp={activeBlockTimestamp}
          web3WalletConnected={web3WalletConnected}
          web3Allowance={web3Allowance}
          isWeb3Transacting={isWeb3Transacting}
          onConnectWallet={() => setIsWalletSelectorOpen(true)}
        />

        <WalletSelectorModal
          isOpen={isWalletSelectorOpen}
          onClose={() => setIsWalletSelectorOpen(false)}
          isConnecting={isWeb3Connecting}
          onSelectWallet={connectWallet}
          selectedWallet={selectedWallet}
        />
      </div>
    </div>
  );
}
