import { Agent, ProxyAgent, fetch } from 'undici';

// Explicit dispatchers keep global HTTP(S)_PROXY settings out of application requests.
export function createHttpClient(proxy?: string): typeof fetch {
  const dispatcher = proxy ? new ProxyAgent(proxy) : new Agent();
  return (input, init) => fetch(input, { ...init, dispatcher });
}

export const directFetch = createHttpClient();
