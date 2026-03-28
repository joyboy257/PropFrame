/**
 * Circuit breaker wrapper using opossum.
 * Prevents cascading failures when an external API (Runway) is degraded.
 *
 * When the circuit is OPEN (failure threshold exceeded):
 * - Requests fail fast with a descriptive error
 * - Downstream services get immediate failure rather than hanging
 * - Recovery is attempted after the reset timeout
 */

import CircuitBreaker from 'opossum';

export type CircuitBreakerOptions = {
  /** Number of failures before opening circuit */
  failureThreshold?: number;
  /** Time in ms before attempting recovery */
  resetTimeout?: number;
  /** Number of calls to attempt when half-open */
  volumeThreshold?: number;
  /** Timeout for individual requests in ms */
  timeout?: number;
};

const DEFAULT_OPTIONS: Required<CircuitBreakerOptions> = {
  failureThreshold: 5,      // Open after 5 failures
  resetTimeout: 30_000,      // Try again after 30 seconds
  volumeThreshold: 3,          // Need 3 successful calls to close
  timeout: 120_000,           // 2 minute timeout per call
};

/**
 * Create a circuit breaker for a given async function.
 */
export function createCircuitBreaker<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  options: CircuitBreakerOptions = {}
): T {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const breaker = new CircuitBreaker(fn, {
    errorThresholdPercentage: 50, // Open when 50%+ of calls fail
    timeout: opts.timeout,
    resetTimeout: opts.resetTimeout,
    volumeThreshold: opts.volumeThreshold,
  });

  // Log state transitions for observability
  breaker.on('open', () => {
    console.warn(`[circuitBreaker] Circuit OPENED for ${fn.name || 'anonymous function'}`);
  });

  breaker.on('close', () => {
    console.log(`[circuitBreaker] Circuit CLOSED for ${fn.name || 'anonymous function'}`);
  });

  breaker.on('halfOpen', () => {
    console.log(`[circuitBreaker] Circuit HALF-OPEN for ${fn.name || 'anonymous function'}`);
  });

  // Return a wrapped function that propagates circuit breaker errors
  const wrapped = (...args: Parameters<T>): ReturnType<T> => {
    return breaker.fire(...args) as ReturnType<T>;
  };

  // Preserve fn name for logging
  Object.defineProperty(wrapped, 'name', { value: `circuitBreaker(${fn.name || 'anonymous'})` });

  return wrapped;
}

/**
 * Check if a circuit breaker is currently open for a given function.
 * Useful for health checks and monitoring.
 */
export function isCircuitOpen(breaker: CircuitBreaker<unknown>): boolean {
  return breaker.status?.name === 'open';
}
