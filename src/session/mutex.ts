export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const release = await this.acquire(key);
    try { return await task(); }
    finally { release(); }
  }

  async acquire(key: string): Promise<() => void> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    let release = (): void => undefined;
    const current = new Promise<void>((resolve) => { release = resolve; });
    this.tails.set(key, current);
    await previous;

    return () => {
      release();
      if (this.tails.get(key) === current) this.tails.delete(key);
    };
  }
}
