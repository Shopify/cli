/**
 * Ensures bounded arrays stay within reasonable memory limits.
 */
const MAX_ARRAY_SIZE = 1000

/**
 * Estimated ~500KB total across timing, error, retry, and event entries.
 */
const MAX_MAP_KEYS = 1000

/**
 * A bounded array that automatically maintains a maximum size by removing
 * the oldest entries when new items are added beyond the limit.
 *
 * Extends the native Array class to provide all standard array methods
 * while enforcing a fixed maximum size of MAX_ARRAY_SIZE (1000 entries).
 *
 * When the size limit is exceeded, the oldest entries (at the beginning
 * of the array) are automatically removed to make room for new ones.
 *
 * @example
 *   const commands = new BArray()
 *   commands.push(entry) // Automatically removes oldest if over 1000
 */
export class BArray<T> extends Array<T> {
  push(...items: T[]): number {
    const result = super.push(...items)
    this.enforceLimit()
    return result
  }

  clear(): void {
    this.length = 0
  }

  toArray(): T[] {
    return [...this]
  }

  private enforceLimit(): void {
    while (this.length > MAX_ARRAY_SIZE) {
      this.shift()
    }
  }
}

/**
 * A bounded map that automatically maintains a maximum number of keys by
 * removing the oldest entries when new keys are added beyond the limit.
 *
 * Extends the native Map class to provide all standard map methods while
 * enforcing a fixed maximum size of MAX_MAP_KEYS (1000 entries).
 *
 * Tracks insertion order to ensure the oldest keys are removed first when
 * the limit is exceeded. This provides LRU-like behavior based on insertion
 * time rather than access time.
 *
 * @example
 *   const events = new BMap()
 *   events.set('event', 1) // Automatically removes oldest if over 1000
 */
export class BMap<TKey, TValue> extends Map<TKey, TValue> {
  private insertionOrder: TKey[] = []

  set(key: TKey, value: TValue): this {
    if (!this.has(key)) {
      this.insertionOrder.push(key)
    }
    super.set(key, value)
    this.enforceLimit()
    return this
  }

  delete(key: TKey): boolean {
    const index = this.insertionOrder.indexOf(key)
    if (index > -1) {
      this.insertionOrder.splice(index, 1)
    }
    return super.delete(key)
  }

  clear(): void {
    this.insertionOrder = []
    super.clear()
  }

  toObject(): {[key: string]: TValue} {
    return Object.fromEntries(this)
  }

  private enforceLimit(): void {
    while (this.size > MAX_MAP_KEYS && this.insertionOrder.length > 0) {
      const oldestKey = this.insertionOrder.shift()
      if (oldestKey !== undefined) {
        super.delete(oldestKey)
      }
    }
  }
}
