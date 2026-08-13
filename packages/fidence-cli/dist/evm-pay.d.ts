import type { LocalWallet } from "./wallet.js";
export declare function sendLocalEvmPayment(input: {
    wallet: LocalWallet;
    networkId: string;
    tokenId: string;
    recipientAddress: string;
    amount: number;
}): Promise<`0x${string}`>;
