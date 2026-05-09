/**
 * Score Calculator - Deterministic scoring algorithm
 * 
 * This module implements the scoring algorithm that calculates compatibility scores
 * from diagnostics with weights. The algorithm is deterministic and follows strict
 * rules for bonuses, penalties, and caps.
 * 
 * Algorithm:
 * - Base: 50
 * - Max Bonus: +40
 * - Max Penalty: -70
 * - Final Range: [0, 100]
 * - CapabilityCompat Cap: +12 max per stack
 */

import type { Diagnostic, ScoreBreakdown } from '@/types';

/**
 * Calculate score breakdown from diagnostics
 * 
 * The score breakdown is derived directly from diagnostics:
 * - Bonuses = diagnostics where weight > 0
 * - Penalties = diagnostics where weight < 0
 * 
 * @param diagnostics - Array of diagnostics with weights
 * @returns ScoreBreakdown with base, bonuses, penalties, and total
 */
export function calculateScore(diagnostics: Diagnostic[]): ScoreBreakdown {
  const base = 50;
  
  // Separate bonuses and penalties
  const bonuses = diagnostics.filter(d => (d.weight ?? 0) > 0);
  const penalties = diagnostics.filter(d => (d.weight ?? 0) < 0);
  
  // Calculate totals
  const totalBonuses = bonuses.reduce((sum, d) => sum + (d.weight ?? 0), 0);
  const totalPenalties = penalties.reduce((sum, d) => sum + (d.weight ?? 0), 0);
  
  // Apply caps
  const cappedBonuses = Math.min(totalBonuses, 40);
  const cappedPenalties = Math.max(totalPenalties, -70);
  
  // Calculate final score
  const rawScore = base + cappedBonuses + cappedPenalties;
  const total = Math.max(0, Math.min(100, rawScore));
  
  return {
    base,
    bonuses: bonuses.map(d => ({
      reason: d.message,
      weight: d.weight ?? 0,
    })),
    penalties: penalties.map(d => ({
      reason: d.message,
      weight: d.weight ?? 0,
    })),
    total,
  };
}

/**
 * Apply capabilityCompat cap (+12 max per stack)
 * 
 * This function modifies diagnostics in-place to ensure that the total
 * weight of all capabilityCompat diagnostics does not exceed +12.
 * 
 * If the total exceeds +12, all capabilityCompat weights are scaled down
 * proportionally to meet the cap.
 * 
 * @param diagnostics - Array of diagnostics to modify
 */
export function applyCapabilityCompatCap(diagnostics: Diagnostic[]): void {
  // Find all capabilityCompat diagnostics
  // We identify them by checking if the ruleId contains 'capability-compat'
  const capabilityCompatDiagnostics = diagnostics.filter(
    d => d.ruleId?.includes('capability-compat')
  );
  
  if (capabilityCompatDiagnostics.length === 0) {
    return;
  }
  
  // Calculate total weight
  const totalCapabilityCompatWeight = capabilityCompatDiagnostics.reduce(
    (sum, d) => sum + (d.weight ?? 0),
    0
  );
  
  // If total exceeds cap, scale down proportionally
  if (totalCapabilityCompatWeight > 12) {
    const scaleFactor = 12 / totalCapabilityCompatWeight;
    
    for (const diagnostic of capabilityCompatDiagnostics) {
      if (diagnostic.weight !== undefined) {
        diagnostic.weight = Math.round(diagnostic.weight * scaleFactor);
      }
    }
  }
}

/**
 * Validate score breakdown
 * 
 * This function validates that a score breakdown follows the rules:
 * - Base is 50
 * - Total bonuses <= 40
 * - Total penalties >= -70
 * - Final score is in [0, 100]
 * 
 * @param breakdown - Score breakdown to validate
 * @returns true if valid, false otherwise
 */
export function validateScoreBreakdown(breakdown: ScoreBreakdown): boolean {
  // Check base
  if (breakdown.base !== 50) {
    return false;
  }
  
  // Check total bonuses
  const totalBonuses = breakdown.bonuses.reduce((sum, b) => sum + b.weight, 0);
  if (totalBonuses > 40) {
    return false;
  }
  
  // Check total penalties
  const totalPenalties = breakdown.penalties.reduce((sum, p) => sum + p.weight, 0);
  if (totalPenalties < -70) {
    return false;
  }
  
  // Check final score range
  if (breakdown.total < 0 || breakdown.total > 100) {
    return false;
  }
  
  // Check that total matches calculation
  const expectedTotal = Math.max(0, Math.min(100, breakdown.base + totalBonuses + totalPenalties));
  if (breakdown.total !== expectedTotal) {
    return false;
  }
  
  return true;
}
