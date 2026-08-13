import nacl from "tweetnacl";

export function getBaseUrl() {
  return (
    process.env.FIDENCE_BASE_URL ??
    process.env.PAYAGENT_BASE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function getConfigPath() {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? ".";
  return `${home}/.fidence/config.json`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${getBaseUrl()}${path}`, { ...init, headers });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { response, data };
}

export function generateKeyPair() {
  const pair = nacl.sign.keyPair();
  return {
    publicKey: Buffer.from(pair.publicKey).toString("base64"),
    secretKey: Buffer.from(pair.secretKey).toString("base64"),
  };
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
