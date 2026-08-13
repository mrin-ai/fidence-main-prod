import { getAddress } from "viem";
const tokenContracts = {
    base: {
        usdc: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
        usdt: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    },
    ethereum: {
        usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
        usdt: { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    },
    sepolia: {
        usdc: { address: "0x3402d41AA8e34e0DF605c12109de2f8F4FF33A87", decimals: 6 },
        usdt: { address: "0xF9E0643Ba46eeaf4e1059775567f67F5c867bbfc", decimals: 6 },
    },
};
const erc20TransferAbi = [
    {
        type: "function",
        name: "transfer",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
];
export function getTokenContract(networkId, tokenId) {
    const contract = tokenContracts[networkId]?.[tokenId.toLowerCase()];
    if (!contract)
        return null;
    return { ...contract, address: getAddress(contract.address) };
}
export function supportsOnChainPayment(networkId, tokenId) {
    if (networkId === "solana")
        return false;
    if (tokenId.toLowerCase() === "eth")
        return networkId !== "solana";
    return Boolean(getTokenContract(networkId, tokenId));
}
export { erc20TransferAbi };
