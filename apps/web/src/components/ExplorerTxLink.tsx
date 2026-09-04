import type { Hex } from "viem";

export function ExplorerTxLink({ hash }: { hash?: Hex }) {
  if (!hash) return null;
  return (
    <a
      className="font-mono text-[0.8rem] text-ember underline decoration-ember/40 underline-offset-4"
      href={`https://sepolia.etherscan.io/tx/${hash}`}
      target="_blank"
      rel="noreferrer"
    >
      View transaction on Etherscan
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
