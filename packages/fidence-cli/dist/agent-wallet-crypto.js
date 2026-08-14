import nacl from "tweetnacl";
export function openSpendingWalletSecret(input) {
    const secretKey = Buffer.from(input.secretKeyB64, "base64");
    if (secretKey.length !== nacl.box.secretKeyLength) {
        throw new Error("Invalid link secret key length");
    }
    const opened = nacl.box.open(Buffer.from(input.sealedSecretB64, "base64"), Buffer.from(input.nonceB64, "base64"), Buffer.from(input.ephemeralPublicKeyB64, "base64"), secretKey);
    if (!opened) {
        throw new Error("Failed to decrypt spending wallet secret");
    }
    return opened;
}
export function bytesToHex(bytes) {
    return `0x${Buffer.from(bytes).toString("hex")}`;
}
