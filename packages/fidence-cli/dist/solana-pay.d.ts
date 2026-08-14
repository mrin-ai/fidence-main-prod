export declare function supportsSolanaPayment(tokenId: string): boolean;
export declare function sendLocalSolanaPayment(input: {
    secretKey: Uint8Array;
    tokenId: string;
    recipientAddress: string;
    amount: number;
}): Promise<string>;
