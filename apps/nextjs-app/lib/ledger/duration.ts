export function ledgerMinutes(value: number): number {
  return Math.floor(Math.max(0, Math.round(value)) / 60);
}

export function formatLedgerDuration(value: number): string {
  const minutes = ledgerMinutes(value);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}
