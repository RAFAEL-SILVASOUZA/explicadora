import { afterEach, describe, expect, it, vi } from 'vitest';
import { carregarAudioDever } from '@/lib/client/audio';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('carregarAudioDever', () => {
  it('devolve object URL quando o áudio existe', async () => {
    // jsdom não implementa URL.createObjectURL: sem o stub o helper cai no catch
    // e devolve null, e a asserção /^blob:/ não tem como passar. stubGlobal para
    // que o vi.unstubAllGlobals() do afterEach restaure o URL original.
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:fake' });
    localStorage.setItem('estudo_token', 'token');
    vi.stubGlobal('fetch', async () => ({ ok: true, status: 200, blob: async () => new Blob(['x']) }) as Response);
    const url = await carregarAudioDever('abc', 2);
    expect(url).toMatch(/^blob:/);
  });

  it('devolve null quando a rota responde 404', async () => {
    localStorage.setItem('estudo_token', 'token');
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 404, blob: async () => new Blob() }) as Response);
    expect(await carregarAudioDever('abc', 2)).toBeNull();
  });

  it('devolve null se a rede falhar', async () => {
    localStorage.setItem('estudo_token', 'token');
    vi.stubGlobal('fetch', async () => { throw new Error('offline'); });
    expect(await carregarAudioDever('abc', 2)).toBeNull();
  });
});
