export declare function openSpendingWalletSecret(input: {
    secretKeyB64: string;
    sealedSecretB64: string;
    nonceB64: string;
    ephemeralPublicKeyB64: string;
}): Uint8Array;
export declare function bytesToHex(bytes: Uint8Array): `0x${string}`;
