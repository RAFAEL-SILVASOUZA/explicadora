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

test('mostra só o ícone da marca, sem texto, mesmo logado', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => ({ conta: { id: '1', role: 'user', saldo_revisoes: 3, nome: 'Ana', sobrenome: 'Souza' } }),
  }) as Response);
  render(<Header />);
  await waitFor(() => expect(screen.getByRole('link', { name: 'EXPLICADORA — Página inicial' })).toBeTruthy());
  // Só o ícone: sem o nome da pessoa nem o texto da marca no header.
  expect(screen.queryByText('Ana Souza')).toBeNull();
  expect(screen.queryByText('EXPLICADORA')).toBeNull();
});

test('mostra só o ícone da marca quando não há sessão', async () => {
  render(<Header />);
  expect(screen.getByRole('link', { name: 'EXPLICADORA — Página inicial' })).toBeTruthy();
  expect(screen.queryByText('EXPLICADORA')).toBeNull();
});

// A gaveta fica num invólucro aria-hidden quando fechada (não cria rolagem horizontal),
// então os links só aparecem para getByRole depois de abrir o menu hamburguer.
async function abrirMenu() {
  render(<Header />);
  await userEvent.click(screen.getByRole('button', { name: /abrir menu/i }));
}

test('tem o link Dever de Casa na navegação', async () => {
  await abrirMenu();
  expect(screen.getByRole('link', { name: /dever de casa/i })).toBeTruthy();
});

test('tem o link Arquivos na navegação', async () => {
  await abrirMenu();
  expect(screen.getByRole('link', { name: /arquivos/i })).toBeTruthy();
});
