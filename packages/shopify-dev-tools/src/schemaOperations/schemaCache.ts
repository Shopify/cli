/**
 * Simple in-memory cache for GraphQL schemas to avoid repeated file reads and decompression
 */
class SchemaCache {
  private cache: Map<string, string> = new Map();

  get(path: string): string | undefined {
    return this.cache.get(path);
  }

  set(path: string, content: string): void {
    this.cache.set(path, content);
  }
}

// Export a singleton instance
export const schemaCache = new SchemaCache();
