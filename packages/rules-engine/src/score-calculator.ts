import type { Diagnostic, ScoreBreakdown } from "@stackfast/schemas";

export function calculateScore(diagnostics: Diagnostic[]): ScoreBreakdown {
  const base = 50;
  const bonuses = diagnostics.filter((diagnostic) => (diagnostic.weight ?? 0) > 0);
  const penalties = diagnostics.filter((diagnostic) => (diagnostic.weight ?? 0) < 0);
  const totalBonuses = bonuses.reduce((sum, diagnostic) => sum + (diagnostic.weight ?? 0), 0);
  const totalPenalties = penalties.reduce((sum, diagnostic) => sum + (diagnostic.weight ?? 0), 0);
  const cappedBonuses = Math.min(totalBonuses, 40);
  const cappedPenalties = Math.max(totalPenalties, -70);
  const total = Math.max(0, Math.min(100, base + cappedBonuses + cappedPenalties));

  return {
    base,
    bonuses: bonuses.map((diagnostic) => ({
      reason: diagnostic.message,
      weight: diagnostic.weight ?? 0,
    })),
    penalties: penalties.map((diagnostic) => ({
      reason: diagnostic.message,
      weight: diagnostic.weight ?? 0,
    })),
    total,
  };
}

export function applyCapabilityCompatCap(diagnostics: Diagnostic[]): void {
  const capabilityDiagnostics = diagnostics.filter((diagnostic) =>
    diagnostic.ruleId?.includes("capability-compat"),
  );

  const totalCapabilityWeight = capabilityDiagnostics.reduce(
    (sum, diagnostic) => sum + (diagnostic.weight ?? 0),
    0,
  );

  if (totalCapabilityWeight <= 12) {
    return;
  }

  const scaleFactor = 12 / totalCapabilityWeight;
  for (const diagnostic of capabilityDiagnostics) {
    if (diagnostic.weight !== undefined) {
      diagnostic.weight = Math.round(diagnostic.weight * scaleFactor);
    }
  }
}

export function validateScoreBreakdown(breakdown: ScoreBreakdown): boolean {
  if (breakdown.base !== 50) {
    return false;
  }

  const totalBonuses = breakdown.bonuses.reduce((sum, bonus) => sum + bonus.weight, 0);
  if (totalBonuses > 40) {
    return false;
  }

  const totalPenalties = breakdown.penalties.reduce((sum, penalty) => sum + penalty.weight, 0);
  if (totalPenalties < -70) {
    return false;
  }

  if (breakdown.total < 0 || breakdown.total > 100) {
    return false;
  }

  const expectedTotal = Math.max(0, Math.min(100, breakdown.base + totalBonuses + totalPenalties));
  return breakdown.total === expectedTotal;
}
