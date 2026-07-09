// Pure utility: parse a simulation ID like "sim-alice-a1b2c3d4" → "alice"
export function extractUserLabel(simulationId: string): string {
  const parts = simulationId.split('-');
  // Expected format: sim-{userId}-{hash}
  if (parts.length >= 3 && parts[0] === 'sim') {
    return parts[1] ?? 'Unknown';
  }
  return 'Unknown';
}
