/** Sepolia and other testnets — enabled in dev or via NEXT_PUBLIC_ENABLE_TESTNETS=true */
export function testnetsEnabled() {
  return (
    process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "true" ||
    process.env.NODE_ENV === "development"
  );
}
