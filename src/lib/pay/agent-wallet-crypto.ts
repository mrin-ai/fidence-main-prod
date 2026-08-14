import nacl from "tweetnacl";

export function sealSpendingWalletSecret(input: {
  recipientPublicKeyB64: string;
  secretBytes: Uint8Array;
}): {
  sealedSecret: string;
  nonce: string;
  ephemeralPublicKey: string;
} {
  const recipientPublicKey = decodeBase64(input.recipientPublicKeyB64);
  if (recipientPublicKey.length !== nacl.box.publicKeyLength) {
    throw new Error("Invalid recipient public key length");
  }

  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const ciphertext = nacl.box(
    input.secretBytes,
    nonce,
    recipientPublicKey,
    ephemeral.secretKey,
  );

  return {
    sealedSecret: encodeBase64(ciphertext),
    nonce: encodeBase64(nonce),
    ephemeralPublicKey: encodeBase64(ephemeral.publicKey),
  };
}

export function openSpendingWalletSecret(input: {
  secretKeyB64: string;
  sealedSecretB64: string;
  nonceB64: string;
  ephemeralPublicKeyB64: string;
}): Uint8Array {
  const secretKey = decodeBase64(input.secretKeyB64);
  if (secretKey.length !== nacl.box.secretKeyLength) {
    throw new Error("Invalid secret key length");
  }

  const opened = nacl.box.open(
    decodeBase64(input.sealedSecretB64),
    decodeBase64(input.nonceB64),
    decodeBase64(input.ephemeralPublicKeyB64),
    secretKey,
  );

  if (!opened) {
    throw new Error("Failed to decrypt spending wallet secret");
  }

  return opened;
}

function encodeBase64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
