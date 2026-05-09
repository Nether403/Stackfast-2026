/**
 * Rules Engine Web Worker
 * 
 * This worker runs the rules engine in a separate thread for better performance.
 * It uses an RPC pattern with request IDs to handle multiple concurrent evaluations.
 */

import { evaluateRulesSync } from './rules-engine';
import type { WorkerReq, WorkerRes } from '@/types';

/**
 * Handle incoming messages from the main thread
 */
self.onmessage = (event: MessageEvent<WorkerReq>) => {
  const req = event.data;
  
  try {
    // Validate request structure
    if (!req || typeof req.id !== 'number' || req.type !== 'evaluate') {
      const errorRes: WorkerRes = {
        id: req?.id ?? -1,
        ok: false,
        error: 'Invalid request format',
      };
      self.postMessage(errorRes);
      return;
    }
    
    // Extract payload
    const { selections, rules } = req.payload;
    
    // Evaluate rules
    const result = evaluateRulesSync(selections, rules);
    
    // Send success response
    const successRes: WorkerRes = {
      id: req.id,
      ok: true,
      result,
    };
    self.postMessage(successRes);
    
  } catch (error) {
    // Send error response
    const errorRes: WorkerRes = {
      id: req.id,
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(errorRes);
  }
};

// Export empty object to make this a module
export {};
