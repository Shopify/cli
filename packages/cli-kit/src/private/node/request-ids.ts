/**
 * Manages collection of request IDs during command execution
 */
export class RequestIDCollection {
  private static instance: RequestIDCollection

  static getInstance(): RequestIDCollection {
    if (!RequestIDCollection.instance) {
      RequestIDCollection.instance = new RequestIDCollection()
    }
    return RequestIDCollection.instance
  }

  // We only report the last 1000 request IDs.
  private readonly maxRequestIds = 1000
  private requestIds: string[] = []

  private constructor() {}

  /**
   * Add a request ID to the collection
   */
  addRequestId(requestId: string | undefined | null) {
    if (requestId) {
      this.requestIds.push(requestId)
    }
  }

  /**
   * Get all collected request IDs as a comma-separated string
   */
  getRequestIds(): string[] {
    return this.requestIds.slice(-this.maxRequestIds)
  }

  /**
   * Clear all stored request IDs
   */
  clear() {
    this.requestIds = []
  }
}

export const requestIdsCollection = RequestIDCollection.getInstance()
