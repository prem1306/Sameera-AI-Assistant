import { desktopSessionToken } from './DesktopSession';
/** Shared local session transport. Capability-specific behavior stays in its tool module. */
export class LocalActionClient {
  private token = '';
  constructor(private readonly transport: typeof fetch = (...args) => fetch(...args), private readonly session = desktopSessionToken) {}

  async request(url: string, init: RequestInit): Promise<Response> {
    if (!this.token) this.token = await this.session();
    const headers = new Headers(init.headers);
    headers.set('X-Sameera-Token', this.token);
    const response = await this.transport(url, { ...init, headers });
    if (response.status === 403) this.token = '';
    return response;
  }
}
