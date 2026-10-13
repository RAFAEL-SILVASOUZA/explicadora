import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import Cadastro from '@/app/cadastro/page';

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/' }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  router.replace.mockClear();
  vi.unstubAllGlobals();
});

const preencher = async (user: UserEvent, campos: Record<string, string>) => {
  for (const [label, valor] of Object.entries(campos)) {
    await user.type(screen.getByLabelText(label), valor);
  }
};

test('mostra erro quando a confirmação de email não casa com o email', async () => {
  const user = userEvent.setup();
  const chamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    chamadas.push(url);
    return { ok: false, json: async () => ({}) } as Response;
  });
  render(<Cadastro />);
  await preencher(user, {
    Nome: 'Ana',
    Sobrenome: 'Souza',
    Email: 'ana@example.com',
    'Confirmação de email': 'outra@example.com',
    Senha: 'abc123',
    'Confirmação de senha': 'abc123',
  });
  await user.click(screen.getByRole('button', { name: /Cadastrar/ }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(chamadas).toHaveLength(0);
});

test('mostra erro quando a confirmação de senha não casa com a senha', async () => {
  const user = userEvent.setup();
  const chamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string) => {
    chamadas.push(url);
    return { ok: false, json: async () => ({}) } as Response;
  });
  render(<Cadastro />);
  await preencher(user, {
    Nome: 'Ana',
    Sobrenome: 'Souza',
    Email: 'ana@example.com',
    'Confirmação de email': 'ana@example.com',
    Senha: 'abc123',
    'Confirmação de senha': 'outra-senha',
  });
  await user.click(screen.getByRole('button', { name: /Cadastrar/ }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(chamadas).toHaveLength(0);
});

test('cadastra quando todos os campos casam, guarda o token e envia os campos', async () => {
  const user = userEvent.setup();
  const bodies: Record<string, string>[] = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    bodies.push(JSON.parse(options.body as string));
    return { ok: true, status: 201, json: async () => ({ token: 'token-novo', conta: { role: 'user' } }) } as Response;
  });
  render(<Cadastro />);
  await preencher(user, {
    Nome: 'Ana',
    Sobrenome: 'Souza',
    Email: 'ana@example.com',
    'Confirmação de email': 'ana@example.com',
    Senha: 'abc123',
    'Confirmação de senha': 'abc123',
  });
  await user.click(screen.getByRole('button', { name: /Cadastrar/ }));
  await waitFor(() => expect(bodies).toHaveLength(1));
  expect(bodies[0]).toMatchObject({
    nome: 'Ana',
    sobrenome: 'Souza',
    email: 'ana@example.com',
    email_confirmacao: 'ana@example.com',
    senha: 'abc123',
    senha_confirmacao: 'abc123',
  });
  expect(localStorage.getItem('estudo_token')).toBe('token-novo');
  expect(router.replace).toHaveBeenCalledWith('/');
});
