export type LocalWallet = {
    privateKey: `0x${string}`;
    address: `0x${string}`;
};
export declare function loadLocalWallet(): LocalWallet | null;
export declare function saveLocalWallet(privateKeyInput: string): `0x${string}`;
export declare function hasLocalWallet(): boolean;
