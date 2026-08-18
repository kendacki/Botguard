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
  const hash = String(txHash || "").trim().toLowerCase();
  if (!/^0x[a-f0-9]{64}$/.test(hash)) return null;
  return `${BOT_CHAIN.explorer}/tx/${hash}`;
}

export function explorerAddressUrl(address) {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) return null;
  return `${BOT_CHAIN.explorer}/address/${address.toLowerCase()}`;
}

export function explorerNftUrl(address) {
  return explorerAddressUrl(address);
}

export const VERIFICATION_PASS_ADDRESS =
  import.meta.env.VITE_VERIFICATION_PASS_ADDRESS || "0x3e01dC32E7c3dCC9D43bEe186A73575004cd818E";

export function getInjectedProvider() {
  const eth = typeof window !== "undefined" ? window.ethereum : null;
  if (!eth) return null;
  if (Array.isArray(eth.providers) && eth.providers.length) {
    return eth.providers.find((provider) => provider.isMetaMask) || eth.providers[0];
  }
  return eth;
}

/** Switch wallet to BOT Chain Testnet; add the network if missing. */
export async function ensureBotChain(ethereum = getInjectedProvider()) {
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

export async function waitForBotChain(ethereum = getInjectedProvider(), timeoutMs = 10000) {
  await ensureBotChain(ethereum);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const hexId = await ethereum.request({ method: "eth_chainId" });
    if (Number.parseInt(String(hexId), 16) === BOT_CHAIN.chainId) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Switch your wallet to ${BOT_CHAIN.name} (chain ${BOT_CHAIN.chainId}).`);
}

/** Add/switch BOT Chain and pin rpc.bohr.life so NFT ownership checks hit the right RPC. */
export async function pinBotChain(ethereum = getInjectedProvider()) {
  if (!ethereum?.request) {
    throw new Error("No injected wallet found.");
  }
  try {
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
  } catch (err) {
    if (err?.code === 4001) throw err;
    await ensureBotChain(ethereum);
  }
  await waitForBotChain(ethereum);
}
