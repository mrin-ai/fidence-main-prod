import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const solanaTokenMints: Record<string, { mint: string; decimals: number }> = {
  usdc: {
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
  },
  usdt: {
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
  },
};

function getSolanaRpcUrl() {
  return (
    process.env.FIDENCE_SOLANA_RPC_URL?.trim() ||
    process.env.FIDENCE_RPC_URL?.trim() ||
    "https://api.mainnet-beta.solana.com"
  );
}

function getSolanaToken(tokenId: string) {
  return solanaTokenMints[tokenId.toLowerCase()] ?? null;
}

export function supportsSolanaPayment(tokenId: string) {
  return tokenId.toLowerCase() === "sol" || Boolean(getSolanaToken(tokenId));
}

export async function sendLocalSolanaPayment(input: {
  secretKey: Uint8Array;
  tokenId: string;
  recipientAddress: string;
  amount: number;
}) {
  const connection = new Connection(getSolanaRpcUrl(), "confirmed");
  const payer = Keypair.fromSecretKey(input.secretKey);
  const recipient = new PublicKey(input.recipientAddress);
  const tokenId = input.tokenId.toLowerCase();

  if (tokenId === "sol") {
    const lamports = BigInt(Math.round(input.amount * 1_000_000_000));
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: recipient,
        lamports: Number(lamports),
      }),
    );
    return sendAndConfirmTransaction(connection, transaction, [payer]);
  }

  const token = getSolanaToken(tokenId);
  if (!token) {
    throw new Error(`Token ${tokenId} is not configured on Solana`);
  }

  const mint = new PublicKey(token.mint);
  const amount = BigInt(Math.round(input.amount * 10 ** token.decimals));
  const sourceAta = getAssociatedTokenAddressSync(mint, payer.publicKey);
  const destinationAta = getAssociatedTokenAddressSync(mint, recipient);

  const transaction = new Transaction()
    .add(
      createAssociatedTokenAccountIdempotentInstruction(
        payer.publicKey,
        destinationAta,
        recipient,
        mint,
      ),
    )
    .add(createTransferInstruction(sourceAta, destinationAta, payer.publicKey, amount));

  return sendAndConfirmTransaction(connection, transaction, [payer]);
}
