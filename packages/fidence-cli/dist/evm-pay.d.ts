import type { LoadedAgentWallet } from "./agent-wallets.js";
export declare function sendLocalEvmPayment(input: {
    wallet: Extract<LoadedAgentWallet, {
        keyType: "evm";
    }>;
    networkId: string;
    tokenId: string;
    recipientAddress: string;
    amount: number;
}): Promise<`0x${string}`>;
