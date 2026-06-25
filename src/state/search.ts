import { signal } from '@preact/signals';

/**
 * The live search query, shared across islands on a page (the hero SearchField
 * writes it; CapabilityResults reads it). Module-singleton, so both islands see
 * the same value once hydrated.
 */
export const query = signal('');
