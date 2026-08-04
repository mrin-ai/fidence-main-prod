/**
 * LCX Token 2.0 (ERC-20)
 * @see https://chain.lcx.com/token
 */
export const LCX_TOKEN_V2_ADDRESS =
  "0x8CD41041505885EF0aD3858181D66f17BE8aae7E" as const;

export const LCX_TOKEN_DECIMALS = 18;

export function getLcxTokenContractAddress(
  networkId: string,
): `0x${string}` | null {
  if (networkId === "ethereum" || networkId === "base" || networkId === "sepolia") {
    if (networkId === "sepolia") {
      const configured =
        process.env.NEXT_PUBLIC_LCX_TOKEN_ADDRESS_SEPOLIA?.trim();
      if (configured?.startsWith("0x")) {
        return configured as `0x${string}`;
      }
    }

    return LCX_TOKEN_V2_ADDRESS;
  }

  return null;
}
