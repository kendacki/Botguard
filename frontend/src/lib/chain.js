/** BOT Chain Testnet (bohr.life) — primary network for BOTGUARD. */
export const BOT_CHAIN = {
  chainId: 968,
  chainIdHex: "0x3c8",
  name: "BOT Chain Testnet",
  rpcUrl: "https://rpc.bohr.life",
  explorer: "https://scan.bohr.life",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
};

export function explorerTxUrl(txHash) {
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) return null;
  return `${BOT_CHAIN.explorer}/tx/${txHash}`;
}

export function explorerAddressUrl(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  return `${BOT_CHAIN.explorer}/address/${address}`;
}

/** Switch wallet to BOT Chain Testnet; add the network if missing. */
export async function ensureBotChain(ethereum = window.ethereum) {
  if (!ethereum?.request) {
    throw new Error("No injected wallet found.");
  }
  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BOT_CHAIN.chainIdHex }],
    });
  } catch (err) {
    // 4902 = unrecognized chain
    if (err?.code === 4902 || /unrecognized chain/i.test(err?.message || "")) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: BOT_CHAIN.chainIdHex,
            chainName: BOT_CHAIN.name,
            rpcUrls: [BOT_CHAIN.rpcUrl],
            nativeCurrency: BOT_CHAIN.nativeCurrency,
            blockExplorerUrls: [BOT_CHAIN.explorer],
          },
        ],
      });
      return;
    }
    throw err;
  }
}
