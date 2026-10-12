const CHAVE = 'estudo_token';

export function guardarToken(token: string): void {
  localStorage.setItem(CHAVE, token);
}

export function lerToken(): string | null {
  return localStorage.getItem(CHAVE);
}

export function limparToken(): void {
  localStorage.removeItem(CHAVE);
}

export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = lerToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    limparToken();
    // assign, não href: href é read-only em jsdom e o teste pode espiá-lo.
    if (typeof window !== 'undefined' && typeof window.location.assign === 'function') {
      window.location.assign('/login');
    }
  }
  return res;
}
