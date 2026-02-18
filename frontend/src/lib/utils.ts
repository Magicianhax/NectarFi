import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Validate a tx hash is a valid hex string (prevents XSS in href attributes) */
export function isValidTxHash(hash: unknown): hash is string {
  return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/** Safe BscScan tx URL — returns undefined if hash is invalid */
export function bscscanTxUrl(hash: unknown): string | undefined {
  if (!isValidTxHash(hash)) return undefined;
  return `https://bscscan.com/tx/${hash}`;
}
