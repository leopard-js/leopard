/**
 * Utility type for a generator function that yields nothing until eventually
 * resolving to a value. Used extensively in Leopard and defined here so we
 * don't have to type out the full definition each time (and also so I don't
 * have to go back and change it everywhere if this type turns out to be wrong).
 */
export type Yielding<T> = Generator<void, T, void>;
