export class AsyncQueue<T> implements AsyncIterable<T> {
  private readonly values: T[] = [];
  private readonly waiters: Array<() => void> = [];
  private ended = false;
  private failure?: Error;

  push(value: T): void {
    if (this.ended) {
      return;
    }

    this.values.push(value);
    this.wake();
  }

  end(): void {
    this.ended = true;
    this.wake();
  }

  fail(error: unknown): void {
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.ended = true;
    this.wake();
  }

  private wake(): void {
    for (const waiter of this.waiters.splice(0)) {
      waiter();
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    while (!this.ended || this.values.length) {
      const value = this.values.shift();

      if (value !== undefined) {
        yield value;
        continue;
      }

      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }

    if (this.failure) {
      throw this.failure;
    }
  }
}