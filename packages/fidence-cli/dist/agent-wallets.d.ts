export type StoredAgentWallet = {
    networkId: string;
    address: string;
    keyType: "evm" | "solana";
    ciphertext: string;
    iv: string;
    tag: string;
};
export type LoadedAgentWallet = {
    keyType: "evm";
    networkId: string;
    address: `0x${string}`;
    privateKey: `0x${string}`;
} | {
    keyType: "solana";
    networkId: "solana";
    address: string;
    secretKey: Uint8Array;
};
export declare function saveAgentWalletsFromPoll(input: {
    agentId: string;
    linkSecretKeyB64: string;
    spendingWallets: Array<{
        networkId: string;
        address: string;
        sealedSecret: string;
        nonce: string;
        ephemeralPublicKey: string;
    }>;
}): void;
export declare function loadAgentWallet(input: {
    agentId: string;
    networkId: string;
    linkSecretKeyB64: string;
}): LoadedAgentWallet | null;
export declare function removeAgentWallets(agentId: string): void;
export declare function listAgentWalletAddresses(agentId: string): {
    networkId: string;
    address: string;
}[];
export declare function hasAgentWallets(agentId: string): boolean;
