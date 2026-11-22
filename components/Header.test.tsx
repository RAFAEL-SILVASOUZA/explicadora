import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// A gaveta fica num invólucro aria-hidden quando fechada (não cria rolagem horizontal),
// então os links só aparecem para getByRole depois de abrir o menu hamburguer.
async function abrirMenu() {
  render(<Header />);
  await userEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
}

test('tem o link Deveres na navegação', async () => {
  await abrirMenu();
  expect(screen.getByRole('link', { name: /deveres/i })).toBeTruthy();
});

test('tem o link Arquivos na navegação', async () => {
  await abrirMenu();
  expect(screen.getByRole('link', { name: /arquivos/i })).toBeTruthy();
});
