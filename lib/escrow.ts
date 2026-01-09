import artifact from "./abi.json";

declare global {
  interface Window {
    ethereum?: any;
  }
}

const ESCROW_ABI = artifact.abi;


import { ethers } from "ethers";

export async function getEscrowContract() {
  if (!window.ethereum) throw new Error("MetaMask not found");

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();

  return new ethers.Contract(process.env.NEXT_PUBLIC_ESCROW_ADDRESS as string, ESCROW_ABI, signer);
}
