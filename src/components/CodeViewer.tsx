/**
 * @license
 * SPDX-License-Identifier: MIT
 */

import React, { useState } from "react";
import { Copy, Check, Terminal, Shield, Code, Cpu } from "lucide-react";

const CODE_SNIPPETS = {
  contract: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title YieldSafe
 * @notice Goal-based USDC savings vault with simulated yield — Arc Testnet
 * @dev USDC on Arc: 0x3600000000000000000000000000000000000000 (6 decimals)
 */
contract YieldSafe {
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    uint256 public constant SIMULATED_APY_BPS = 500; // 5% APY
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant EARLY_WITHDRAWAL_PENALTY_BPS = 200; // 2%
    uint256 public constant PLATFORM_FEE_BPS = 1_000; // 10% on yield

    struct Vault {
        uint256 id;
        address owner;
        string  goalName;
        uint256 targetAmount;   // in USDC (6 decimals)
        uint256 targetDate;     // unix timestamp (0 = amount only)
        uint256 principal;      // total deposited
        uint256 depositedAt;
        uint256 lastYieldClaim;
        uint256 yieldAccrued;
        bool    locked;
        bool    closed;
    }

    mapping(uint256 => Vault) public vaults;
    // ...
}`,
  create: `function createVault(
    string calldata goalName,
    uint256 targetAmount,
    uint256 targetDate,
    bool locked,
    uint256 initialDeposit
) external returns (uint256 vaultId) {
    require(bytes(goalName).length > 0, "Goal name required");
    require(targetAmount >= 1_000_000, "Min target: 1 USDC");
    require(targetDate == 0 || targetDate > block.timestamp, "Target date must be future");

    _vaultCounter++;
    vaultId = _vaultCounter;

    vaults[vaultId] = Vault({
        id: vaultId,
        owner: msg.sender,
        goalName: goalName,
        targetAmount: targetAmount,
        targetDate: targetDate,
        principal: 0,
        depositedAt: 0,
        lastYieldClaim: 0,
        yieldAccrued: 0,
        locked: locked,
        closed: false
    });

    _userVaults[msg.sender].push(vaultId);

    emit VaultCreated(vaultId, msg.sender, goalName, targetAmount, targetDate);

    if (initialDeposit > 0) {
        _deposit(vaultId, initialDeposit);
    }
}`,
  accrue: `function _accrueYield(uint256 vaultId) internal {
    Vault storage v = vaults[vaultId];
    if (v.principal == 0) return;

    uint256 elapsed = block.timestamp - v.lastYieldClaim;
    if (elapsed == 0) return;

    // Simple interest: principal * APY * elapsed / year
    uint256 newYield = (v.principal * SIMULATED_APY_BPS * elapsed) /
                       (BPS_DENOMINATOR * SECONDS_PER_YEAR);

    v.yieldAccrued += newYield;
    v.lastYieldClaim = block.timestamp;

    emit YieldUpdated(vaultId, v.yieldAccrued);
}`,
  withdraw: `function withdraw(uint256 vaultId)
    external
    onlyVaultOwner(vaultId)
    vaultExists(vaultId)
    notClosed(vaultId)
{
    Vault storage v = vaults[vaultId];
    require(v.principal > 0, "Nothing to withdraw");

    _accrueYield(vaultId);

    bool goalMet = _isGoalMet(vaultId);
    bool earlyExit = v.locked && !goalMet;

    uint256 penalty = 0;
    uint256 yieldPayout = v.yieldAccrued;

    if (earlyExit) {
        // Penalty on principal: 2%
        penalty = (v.principal * EARLY_WITHDRAWAL_PENALTY_BPS) / BPS_DENOMINATOR;
        yieldPayout = 0;
        platformFeesAccrued += penalty + v.yieldAccrued;
    } else {
        // Platform takes 10% platform fee on yield
        uint256 platformCut = (yieldPayout * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
        platformFeesAccrued += platformCut;
        yieldPayout -= platformCut;
    }

    uint256 payout = v.principal - penalty + yieldPayout;
    v.principal = 0;
    v.yieldAccrued = 0;
    v.closed = true;

    require(
        IERC20(USDC).transfer(msg.sender, payout),
        "USDC transfer failed"
    );

    emit Withdrawn(vaultId, msg.sender, v.principal, yieldPayout, penalty);
    emit VaultClosed(vaultId);
}`
};

export default function CodeViewer() {
  const [activeTab, setActiveTab] = useState<keyof typeof CODE_SNIPPETS>("contract");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(CODE_SNIPPETS[activeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-teal-950 text-teal-400 rounded-lg">
            <Code size={18} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 font-sans tracking-tight">YieldSafe.sol</h3>
            <p className="text-xs text-zinc-500 font-sans">Verification & execution logic in Solidity</p>
          </div>
        </div>

        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition"
          id="btn-copy-code"
        >
          {copied ? (
            <>
              <Check size={14} className="text-teal-400" />
              <span className="text-teal-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy Segment</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800/50 bg-zinc-950/40 p-1 gap-1">
        {(Object.keys(CODE_SNIPPETS) as Array<keyof typeof CODE_SNIPPETS>).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-xs font-mono rounded-md transition capitalize ${
              activeTab === tab
                ? "bg-zinc-800 text-teal-400 border border-zinc-700/50 font-medium"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
            }`}
            id={`tab-code-${tab}`}
          >
            {tab === "contract" ? "contract interface" : `${tab}()`}
          </button>
        ))}
      </div>

      {/* Code Area */}
      <div className="relative font-mono text-[11px] sm:text-xs text-zinc-300 overflow-x-auto p-5 bg-zinc-950 max-h-[420px] leading-relaxed">
        <pre className="text-left select-all whitespace-pre">
          <code>{CODE_SNIPPETS[activeTab]}</code>
        </pre>
      </div>

      {/* Description Summary footer */}
      <div className="px-5 py-3.5 bg-zinc-900/60 border-t border-zinc-800/60 flex items-start gap-3">
        <Cpu size={16} className="text-zinc-500 mt-1 flex-shrink-0" />
        <p className="text-[11px] sm:text-xs text-zinc-400 leading-normal font-sans">
          {activeTab === "contract" && (
            <span>
              This defines the smart contract constants. Notice how the APY is Hardcoded at <strong>5.00% APY</strong> (500 BPS), platform takes a <strong>10% fee</strong> on yields, and early withdrawal penalty burns <strong>2.00% matching BPS</strong> of principal.
            </span>
          )}
          {activeTab === "create" && (
            <span>
              Allows users to initiate a lock state and provides optional immediate staking on genesis. Requires active targets above 1 USDC to satisfy decimals protection check.
            </span>
          )}
          {activeTab === "accrue" && (
            <span>
              Computes time difference using block timetamping: <code>(principal * APY * elapsed) / (10000 * 365 Days)</code> and saves the accumulated rewards on-chain.
            </span>
          )}
          {activeTab === "withdraw" && (
            <span>
              Verifies goal compliance. Intercepts non-compliant lock vaults to deduct 2% penalty, which gets funneled into contract administrative reserves вместе with unaccrued interest.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
