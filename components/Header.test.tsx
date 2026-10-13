import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import Header from '@/components/Header';

// O Header usa useRouter e usePathname; sem mock, o render explode em jsdom.
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/' }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('mostra o nome do usuário logado no lugar de "Estudo Divertido"', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ conta: { id: '1', role: 'user', saldo_revisoes: 3, nome: 'Ana', sobrenome: 'Souza' } }),
  }) as Response);
  render(<Header />);
  await waitFor(() => expect(screen.getByText('Ana Souza')).toBeTruthy());
  expect(screen.queryByText('Estudo Divertido')).toBeNull();
});

test('mostra "Estudo Divertido" quando não há sessão', async () => {
  render(<Header />);
  expect(screen.getByText('Estudo Divertido')).toBeTruthy();
});
