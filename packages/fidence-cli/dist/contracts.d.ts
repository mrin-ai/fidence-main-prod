declare const erc20TransferAbi: readonly [{
    readonly type: "function";
    readonly name: "transfer";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "bool";
    }];
}];
export declare function getTokenContract(networkId: string, tokenId: string): {
    address: `0x${string}`;
    decimals: number;
} | null;
export declare function supportsOnChainPayment(networkId: string, tokenId: string): boolean;
export { erc20TransferAbi };
