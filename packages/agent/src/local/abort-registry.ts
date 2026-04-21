/**
 * 0xNIMBUS — Abort Registry
 *
 * Manages per-request AbortControllers, mirroring AIChatAgent's _abortRegistry.
 * Used to cancel in-progress chat requests when a new one arrives
 * (messageConcurrency: "latest") or when the client requests cancellation.
 */

export class AbortRegistry {
  private controllers = new Map<string, AbortController>();

  /** Register a new AbortController for a request ID */
  add(requestId: string): AbortController {
    const controller = new AbortController();
    this.controllers.set(requestId, controller);
    return controller;
  }

  /** Get the AbortController for a request ID */
  get(requestId: string): AbortController | undefined {
    return this.controllers.get(requestId);
  }

  /** Abort and remove the controller for a request ID */
  abort(requestId: string, reason?: string): void {
    const controller = this.controllers.get(requestId);
    if (controller) {
      controller.abort(reason);
      this.controllers.delete(requestId);
    }
  }

  /** Abort all in-progress requests */
  abortAll(reason?: string): void {
    for (const [id, controller] of this.controllers) {
      controller.abort(reason);
      this.controllers.delete(id);
    }
  }

  /** Remove a completed request from the registry */
  remove(requestId: string): void {
    this.controllers.delete(requestId);
  }

  /** Check if a request is in progress */
  has(requestId: string): boolean {
    return this.controllers.has(requestId);
  }

  /** Number of in-progress requests */
  get size(): number {
    return this.controllers.size;
  }
}