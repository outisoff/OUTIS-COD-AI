/**
 * Client-side rate limiting utilities for auth and API calls
 * Provides exponential backoff and attempt tracking
 */

interface RateLimitState {
  attempts: number;
  lastAttempt: number;
  lockedUntil: number;
}

const rateLimitStates: Map<string, RateLimitState> = new Map();

// Configuration
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60000; // 1 minute lockout after max attempts
const BASE_BACKOFF_MS = 1000; // 1 second base backoff
const MAX_BACKOFF_MS = 30000; // 30 seconds max backoff

/**
 * Check if an action is currently rate limited
 * @param key Unique identifier for the rate limit (e.g., 'auth:login', 'auth:signup')
 * @returns Object with isLimited status and remainingTime in seconds
 */
export function isRateLimited(key: string): { isLimited: boolean; remainingTime: number } {
  const state = rateLimitStates.get(key);
  
  if (!state) {
    return { isLimited: false, remainingTime: 0 };
  }
  
  const now = Date.now();
  
  // Check if currently locked out
  if (state.lockedUntil > now) {
    return { 
      isLimited: true, 
      remainingTime: Math.ceil((state.lockedUntil - now) / 1000) 
    };
  }
  
  return { isLimited: false, remainingTime: 0 };
}

/**
 * Record an attempt for rate limiting
 * @param key Unique identifier for the rate limit
 * @param success Whether the attempt was successful
 */
export function recordAttempt(key: string, success: boolean): void {
  const now = Date.now();
  const state = rateLimitStates.get(key) || { attempts: 0, lastAttempt: 0, lockedUntil: 0 };
  
  if (success) {
    // Reset on success
    rateLimitStates.delete(key);
    return;
  }
  
  // Increment failed attempts
  state.attempts += 1;
  state.lastAttempt = now;
  
  // Apply lockout if max attempts reached
  if (state.attempts >= MAX_ATTEMPTS) {
    state.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  
  rateLimitStates.set(key, state);
}

/**
 * Get the delay before the next attempt should be allowed (exponential backoff)
 * @param key Unique identifier for the rate limit
 * @returns Delay in milliseconds
 */
export function getBackoffDelay(key: string): number {
  const state = rateLimitStates.get(key);
  
  if (!state || state.attempts === 0) {
    return 0;
  }
  
  // Exponential backoff: 1s, 2s, 4s, 8s, 16s... capped at 30s
  const delay = Math.min(
    BASE_BACKOFF_MS * Math.pow(2, state.attempts - 1),
    MAX_BACKOFF_MS
  );
  
  return delay;
}

/**
 * Get the number of remaining attempts before lockout
 * @param key Unique identifier for the rate limit
 * @returns Number of remaining attempts
 */
export function getRemainingAttempts(key: string): number {
  const state = rateLimitStates.get(key);
  
  if (!state) {
    return MAX_ATTEMPTS;
  }
  
  return Math.max(0, MAX_ATTEMPTS - state.attempts);
}

/**
 * Clear rate limit state for a key
 * @param key Unique identifier for the rate limit
 */
export function clearRateLimit(key: string): void {
  rateLimitStates.delete(key);
}
