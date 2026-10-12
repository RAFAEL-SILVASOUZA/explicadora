import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { apiFetch, guardarToken, lerToken, limparToken } from '../../lib/client/api';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

// `visto` é escrito dentro do closure do fetch: o fluxo de controle do tsc não
// acompanha a atribuição e estreita a variável para `null` (e depois `never`),
// então o acesso ao header precisa do cast explícito para `npx tsc --noEmit` ficar limpo.
type Visto = Headers | null;

test('guardarToken e lerToken guardam o token no localStorage', () => {
  guardarToken('abc');
  expect(lerToken()).toBe('abc');
  limparToken();
  expect(lerToken()).toBeNull();
});

test('apiFetch envia o header Bearer', async () => {
  guardarToken('abc');
  let visto: Visto = null;
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    visto = new Headers(options.headers);
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  await apiFetch('/api/conta');
  expect((visto as Visto)?.get('authorization')).toBe('Bearer abc');
});

test('apiFetch sem token não envia header', async () => {
  let visto: Visto = null;
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    visto = new Headers(options.headers);
    return { ok: true, status: 200, json: async () => ({}) } as Response;
  });
  await apiFetch('/api/conta');
  expect((visto as Visto)?.get('authorization')).toBeNull();
});

test('401 limpa o token e pede o redirect', async () => {
  guardarToken('abc');
  const assign = vi.fn();
  Object.defineProperty(window, 'location', { value: { assign }, configurable: true });
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 401, json: async () => ({}) }) as Response);
  await apiFetch('/api/conta');
  expect(lerToken()).toBeNull();
  expect(assign).toHaveBeenCalledWith('/login');
});
