import nacl from "tweetnacl";

export function openSpendingWalletSecret(input: {
  secretKeyB64: string;
  sealedSecretB64: string;
  nonceB64: string;
  ephemeralPublicKeyB64: string;
}): Uint8Array {
  const secretKey = Buffer.from(input.secretKeyB64, "base64");
  if (secretKey.length !== nacl.box.secretKeyLength) {
    throw new Error("Invalid link secret key length");
  }

  const opened = nacl.box.open(
    Buffer.from(input.sealedSecretB64, "base64"),
    Buffer.from(input.nonceB64, "base64"),
    Buffer.from(input.ephemeralPublicKeyB64, "base64"),
    secretKey,
  );

  if (!opened) {
    throw new Error("Failed to decrypt spending wallet secret");
  }

  return opened;
}

export function bytesToHex(bytes: Uint8Array): `0x${string}` {
  return `0x${Buffer.from(bytes).toString("hex")}` as `0x${string}`;
}
