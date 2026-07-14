import type { Credentials } from '../auth/credentials.js';
import { browserAuth } from '../auth/browser.js';
import { NodexError } from '../errors.js';
import type { DiscoveredNotionAgent, NotionTransport, PreflightInfo, TransportRequest, TransportTurn } from './types.js';

export class AutoReauthTransport implements NotionTransport {
  get attachmentCapabilities() { return this.inner.attachmentCapabilities; }
  private reauthPromise: Promise<Credentials> | undefined;
  constructor(private readonly inner: NotionTransport) {}
  preflight(credentials?: Credentials): Promise<PreflightInfo> { return this.inner.preflight(credentials); }
  discoverCustomAgents(): Promise<DiscoveredNotionAgent[]> {
    if (!this.inner.discoverCustomAgents) return Promise.resolve([]);
    return this.inner.discoverCustomAgents();
  }
  async send(request: TransportRequest): Promise<TransportTurn> {
    try { return await this.inner.send(request); }
    catch (error) {
      if (!(error instanceof NodexError) || error.code !== 'auth') throw error;
      this.reauthPromise ??= browserAuth().finally(() => { this.reauthPromise = undefined; });
      const credentials = await this.reauthPromise;
      await this.inner.preflight(credentials);
      return this.inner.send(request);
    }
  }
}
