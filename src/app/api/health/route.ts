import { isCacheAvailable } from "@/lib/cache/redis";
import { getDb } from "@/lib/db/client";
import { createPublicClient, http } from "viem";
import { sepolia, mainnet, base } from "viem/chains";
import { getEvmRpcUrl } from "@/lib/evm-rpc";
import { getSolanaRpcUrl } from "@/lib/solana-config";
import { Connection } from "@solana/web3.js";

async function probeChain(name: string, probe: () => Promise<unknown>) {
  try {
    await probe();
    return "ok" as const;
  } catch {
    return "error" as const;
  }
}

export async function GET() {
  const health: Record<string, string> = {
    redis: isCacheAvailable() ? "ok" : "unconfigured",
  };

  try {
    const db = await getDb();
    await db.command({ ping: 1 });
    health.db = "ok";
  } catch {
    health.db = "error";
    return Response.json(health, { status: 503 });
  }

  const [sepoliaStatus, ethereumStatus, baseStatus, solanaStatus] = await Promise.all([
    probeChain("sepolia", async () => {
      const client = createPublicClient({ chain: sepolia, transport: http(getEvmRpcUrl("sepolia")) });
      await client.getBlockNumber();
    }),
    probeChain("ethereum", async () => {
      const client = createPublicClient({ chain: mainnet, transport: http(getEvmRpcUrl("ethereum")) });
      await client.getBlockNumber();
    }),
    probeChain("base", async () => {
      const client = createPublicClient({ chain: base, transport: http(getEvmRpcUrl("base")) });
      await client.getBlockNumber();
    }),
    probeChain("solana", async () => {
      const connection = new Connection(getSolanaRpcUrl(), "confirmed");
      await connection.getSlot();
    }),
  ]);

  health.settlement_sepolia = sepoliaStatus;
  health.settlement_ethereum = ethereumStatus;
  health.settlement_base = baseStatus;
  health.settlement_solana = solanaStatus;

  return Response.json(health);
}
