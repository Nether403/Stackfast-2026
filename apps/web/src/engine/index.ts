/**
 * Rules Engine - Main exports
 * 
 * Provides a unified interface for rule evaluation with automatic Worker fallback.
 */

export {
  evaluateRulesWithFallback,
  evaluateRulesSync,
  terminateWorker,
} from './evaluate-with-fallback';

export { makeRulesWorker, WorkerError } from './worker-wrapper';

export type { RulesEngineWorker } from './worker-wrapper';

export {
  calculateScore,
  applyCapabilityCompatCap,
  validateScoreBreakdown,
} from './score-calculator';
