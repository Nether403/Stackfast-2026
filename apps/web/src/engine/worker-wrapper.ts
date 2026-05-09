/**
 * Web Worker Wrapper
 * 
 * Provides a typed interface for communicating with the rules engine worker.
 * Uses request ID tracking to handle concurrent evaluations without race conditions.
 */

import type { Tool, Rule, EvaluationResult, WorkerReq, WorkerRes } from '@/types';

/**
 * Rules engine worker interface
 */
export interface RulesEngineWorker {
  evaluate(selections: Tool[], rules: Rule[]): Promise<EvaluationResult>;
  terminate(): void;
}

/**
 * Error thrown when worker operations fail
 */
export class WorkerError extends Error {
  constructor(message: string) {
    super(`Rules engine error: ${message}`);
    this.name = 'WorkerError';
  }
}

/**
 * Create a rules engine worker with request ID tracking
 * 
 * Guards Worker creation to avoid SSR/runtime errors:
 * - Only creates Worker if window is defined and Worker is available
 * - Returns null if Worker is not supported
 */
export function makeRulesWorker(): RulesEngineWorker | null {
  // Guard Worker creation
  if (typeof window === 'undefined' || !('Worker' in window)) {
    return null;
  }
  
  // Create worker
  const worker = new Worker(
    new URL('./rules-engine.worker.ts', import.meta.url),
    { type: 'module' }
  );
  
  // Request ID tracking
  let nextId = 1;
  const inflight = new Map<number, {
    resolve: (result: EvaluationResult) => void;
    reject: (error: Error) => void;
    timeout: number;
  }>();
  
  // Handle messages from worker
  worker.onmessage = (event: MessageEvent<WorkerRes>) => {
    const res = event.data;
    const handler = inflight.get(res.id);
    
    if (!handler) {
      return; // Stale response, ignore
    }
    
    // Clear timeout and remove from inflight
    clearTimeout(handler.timeout);
    inflight.delete(res.id);
    
    // Handle response
    if (res.ok) {
      handler.resolve(res.result);
    } else {
      handler.reject(new WorkerError(res.error));
    }
  };
  
  // Handle worker errors
  worker.onerror = (error) => {
    console.error('Worker error:', error);
    
    // Reject all inflight requests
    for (const [id, handler] of inflight.entries()) {
      clearTimeout(handler.timeout);
      handler.reject(new WorkerError('Worker crashed'));
      inflight.delete(id);
    }
  };
  
  /**
   * Evaluate rules with timeout handling
   */
  function evaluate(selections: Tool[], rules: Rule[]): Promise<EvaluationResult> {
    return new Promise((resolve, reject) => {
      const id = nextId++;
      
      // Set up timeout (1000ms)
      const timeout = setTimeout(() => {
        inflight.delete(id);
        reject(new WorkerError('Evaluation timeout'));
      }, 1000) as unknown as number;
      
      // Track request
      inflight.set(id, { resolve, reject, timeout });
      
      // Send request
      const req: WorkerReq = {
        id,
        type: 'evaluate',
        payload: { selections, rules },
      };
      worker.postMessage(req);
    });
  }
  
  /**
   * Terminate the worker
   */
  function terminate(): void {
    // Reject all inflight requests
    for (const [id, handler] of inflight.entries()) {
      clearTimeout(handler.timeout);
      handler.reject(new WorkerError('Worker terminated'));
      inflight.delete(id);
    }
    
    worker.terminate();
  }
  
  // Warm up worker on idle (with Safari fallback)
  const scheduleWarmup = typeof requestIdleCallback !== 'undefined'
    ? requestIdleCallback
    : (cb: () => void) => setTimeout(cb, 1);
  
  scheduleWarmup(() => {
    // Send dummy evaluation to warm up worker
    evaluate([], []).catch(() => {
      // Ignore warm-up errors
    });
  });
  
  return { evaluate, terminate };
}
