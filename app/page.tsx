"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getEscrowContract } from "@/lib/escrow";

/* ---------------- TYPES ---------------- */

type Escrow = {
  id: number;
  buyer: string;
  seller: string;
  amount: bigint;
  status: number;
  currentMilestone: bigint;
};

type Milestone = {
  amount: bigint;
  released: boolean;
};

/* ---------------- PAGE ---------------- */

export default function EscrowPage() {
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("0");
  const [escrows, setEscrows] = useState<Escrow[]>([]);
  const [selected, setSelected] = useState<Escrow | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);

  /* ---- Create Escrow Form ---- */
  const [seller, setSeller] = useState("");
  const [milestoneCount, setMilestoneCount] = useState(1);
  const [deposit, setDeposit] = useState("0.02");

  /* ---------------- WALLET ---------------- */

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask required");
      return;
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);

    const network = await provider.getNetwork();
    if (network.chainId !== 11155111n) {
      alert("Please switch to Sepolia network");
      return;
    }

    const signer = await provider.getSigner();
    const addr = await signer.getAddress();
    const bal = await provider.getBalance(addr);

    setAccount(addr);
    setBalance(Number(ethers.formatEther(bal)).toFixed(4));
  }

  /* ---------------- LOAD ESCROWS ---------------- */

  async function loadEscrows() {
    if (!account) return;

    const contract = await getEscrowContract();
    const total = Number(await contract.escrowCounter());
    const owner = await contract.owner();

    setIsAdmin(owner.toLowerCase() === account.toLowerCase());

    const list: Escrow[] = [];

    for (let i = 0; i < total; i++) {
      const e = await contract.escrows(i);

      if (
        e.buyer.toLowerCase() === account.toLowerCase() ||
        e.seller.toLowerCase() === account.toLowerCase()
      ) {
        list.push({
          id: i,
          buyer: e.buyer,
          seller: e.seller,
          amount: e.amount,
          status: e.status,
          currentMilestone: e.currentMilestone
        });
      }
    }

    setEscrows(list);
    if (list.length > 0) selectEscrow(list[0]);
  }

  /* ---------------- SELECT ESCROW ---------------- */

  async function selectEscrow(e: Escrow) {
    setSelected(e);
    const contract = await getEscrowContract();

    const ms: Milestone[] = [];
    let i = 0;

    while (true) {
      try {
        ms.push(await contract.milestones(e.id, i));
        i++;
      } catch {
        break;
      }
    }

    setMilestones(ms);
  }

  /* ---------------- CREATE ESCROW ---------------- */

  async function createEscrow() {
    if (!ethers.isAddress(seller)) {
      alert("Invalid seller address");
      return;
    }

    if (Number(deposit) < 0.02) {
      alert("Minimum escrow is 0.02 ETH");
      return;
    }

    try {
      setLoading(true);
      const contract = await getEscrowContract();

      const tx = await contract.createEscrow(
        seller,
        milestoneCount,
        { value: ethers.parseEther(deposit) }
      );

      await tx.wait();
      setSeller("");
      setMilestoneCount(1);
      setDeposit("0.02");
      await loadEscrows();
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- ACTIONS ---------------- */

  async function sellerComplete() {
    if (!selected) return;
    setLoading(true);
    const c = await getEscrowContract();
    await (await c.markMilestoneComplete(selected.id)).wait();
    await loadEscrows();
    setLoading(false);
  }

  async function buyerApprove() {
    if (!selected) return;
    setLoading(true);
    const c = await getEscrowContract();
    await (await c.approveMilestone(selected.id)).wait();
    await loadEscrows();
    setLoading(false);
  }

  async function raiseDispute() {
    if (!selected) return;
    setLoading(true);
    const c = await getEscrowContract();
    await (await c.raiseDispute(selected.id)).wait();
    await loadEscrows();
    setLoading(false);
  }

  async function resolveDispute(paySeller: boolean) {
    if (!selected) return;
    setLoading(true);
    const c = await getEscrowContract();
    await (await c.resolveDispute(selected.id, paySeller)).wait();
    await loadEscrows();
    setLoading(false);
  }

  /* ---------------- EFFECTS ---------------- */

  useEffect(() => {
    if (account) loadEscrows();
  }, [account]);

  const isBuyer = selected?.buyer.toLowerCase() === account.toLowerCase();
  const isSeller = selected?.seller.toLowerCase() === account.toLowerCase();

  /* ---------------- UI ---------------- */

  return (
    <main className="min-h-screen bg-blue-50 p-8">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="bg-white p-6 rounded-xl shadow">
          <h1 className="text-3xl font-bold text-blue-700">
            Decentralized Escrow
          </h1>
          <p className="text-slate-500">
            Milestone-based escrow · Sepolia
          </p>
        </div>

        {/* WALLET */}
        <div className="bg-white p-6 rounded-xl shadow flex justify-between">
          {!account ? (
            <button
              onClick={connectWallet}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Connect Wallet
            </button>
          ) : (
            <div>
              <p><b>Wallet:</b> {account.slice(0, 6)}…{account.slice(-4)}</p>
              <p className="text-sm text-slate-500">
                Balance: {balance} ETH
              </p>
            </div>
          )}
        </div>

        {/* CREATE ESCROW */}
        {account && (
          <div className="bg-white p-6 rounded-xl shadow space-y-4">
            <h2 className="text-xl font-semibold text-blue-700">
              Create New Escrow
            </h2>

            <input
              placeholder="Seller address"
              value={seller}
              onChange={e => setSeller(e.target.value)}
              className="w-full border p-2 rounded"
            />

            <input
              type="number"
              min={1}
              value={milestoneCount}
              onChange={e => setMilestoneCount(Number(e.target.value))}
              className="w-full border p-2 rounded"
            />

            <input
              value={deposit}
              onChange={e => setDeposit(e.target.value)}
              className="w-full border p-2 rounded"
            />

            <button
              onClick={createEscrow}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded"
            >
              Create Escrow
            </button>
          </div>
        )}

        {/* ESCROWS LIST */}
        {escrows.length > 0 && (
          <div className="bg-white p-6 rounded-xl shadow">
            <h2 className="font-semibold mb-4">Your Escrows</h2>
            {escrows.map(e => (
              <button
                key={e.id}
                onClick={() => selectEscrow(e)}
                className={`w-full p-4 mb-2 border rounded text-left ${
                  selected?.id === e.id
                    ? "border-blue-600 bg-blue-100"
                    : "border-slate-200"
                }`}
              >
                <p><b>Escrow #{e.id}</b></p>
                <p className="text-sm text-slate-500">
                  Seller: {e.seller}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* MILESTONES */}
        {selected && (
          <div className="bg-white p-6 rounded-xl shadow space-y-2">
            <h2 className="font-semibold">Milestones</h2>
            {milestones.map((m, i) => (
              <div key={i} className="flex justify-between border p-3 rounded">
                <span>
                  Milestone {i + 1} — {ethers.formatEther(m.amount)} ETH
                </span>
                <span className={m.released ? "text-green-600" : "text-orange-500"}>
                  {m.released ? "Paid" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ACTIONS */}
        {selected && (
          <div className="bg-white p-6 rounded-xl shadow space-y-2">
            {isSeller && (
              <button
                onClick={sellerComplete}
                className="w-full bg-orange-500 text-white py-2 rounded"
              >
                Seller: Mark Milestone Complete
              </button>
            )}

            {isBuyer && (
              <button
                onClick={buyerApprove}
                className="w-full bg-green-600 text-white py-2 rounded"
              >
                Buyer: Release Funds
              </button>
            )}

            {(isBuyer || isSeller) && (
              <button
                onClick={raiseDispute}
                className="w-full bg-red-600 text-white py-2 rounded"
              >
                Raise Dispute
              </button>
            )}

            {isAdmin && (
              <div className="border-t pt-3 space-y-2">
                <p className="font-semibold text-blue-700">
                  Admin Resolution
                </p>
                <button
                  onClick={() => resolveDispute(true)}
                  className="w-full bg-green-700 text-white py-2 rounded"
                >
                  Pay Seller
                </button>
                <button
                  onClick={() => resolveDispute(false)}
                  className="w-full bg-red-700 text-white py-2 rounded"
                >
                  Refund Buyer
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
