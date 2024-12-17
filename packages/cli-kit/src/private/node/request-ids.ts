const MAX_REQUEST_IDS = 100

/**
 * Manages collection of request IDs during command execution
 */
class RequestIDCollection {
  private static instance: RequestIDCollection

  static getInstance(): RequestIDCollection {
    if (!RequestIDCollection.instance) {
      RequestIDCollection.instance = new RequestIDCollection()
    }
    return RequestIDCollection.instance
  }

  private requestIds: string[] = []

  /**
   * Add a request ID to the collection
   * We only report the first MAX_REQUEST_IDS request IDs.
   */
  addRequestId(requestId: string | undefined | null) {
    if (requestId && this.requestIds.length < MAX_REQUEST_IDS) {
      this.requestIds.push(requestId)
    }
  }

  /**
   * Get all collected request IDs
   */
  getRequestIds(): string[] {
    return this.requestIds
  }

  /**
   * Clear all stored request IDs
   */
  clear() {
    this.requestIds = []
  }
}

export const requestIdsCollection = RequestIDCollection.getInstance()
