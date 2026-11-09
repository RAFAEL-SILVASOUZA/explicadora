import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Arquivos from '@/app/arquivos/page';

// Página client-side com Header (usa useRouter/usePathname) e upload via fetch.
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/arquivos' }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const arquivo = (id: string, nome: string, mime = 'image/png') => ({
  id, nome, mime, tamanho: 2048, origem: 'biblioteca', criado_em: '2026-11-08T00:00:00Z',
});

test('mostra a mensagem de biblioteca vazia quando não há arquivos', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => [] }) as Response);
  render(<Arquivos />);
  expect(await screen.findByText('Sua biblioteca está vazia.')).toBeTruthy();
});

test('lista os arquivos enviados com nome e tamanho', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async () => ({
    ok: true,
    json: async () => [arquivo('a1', 'caderno.png'), arquivo('a2', 'apostila.pdf', 'application/pdf')],
  }) as Response);
  render(<Arquivos />);
  expect(await screen.findByText('caderno.png')).toBeTruthy();
  expect(screen.getByText('apostila.pdf')).toBeTruthy();
  // 2048 bytes apresentados em KB legível, não em número cru (a linha traz também a
  // data, por isso o match parcial).
  const linhas = screen.getAllByText((content, element) =>
    element?.tagName === 'P' && content.includes('2 KB') && /\d{2}\/\d{2}\/\d{4}/.test(content));
  expect(linhas).toHaveLength(2);
});

test('enviar um arquivo chama a rota de upload e recarrega a lista', async () => {
  const user = userEvent.setup();
  localStorage.setItem('estudo_token', 'token-de-teste');
  const metodos: string[] = [];
  let listagens = 0;
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    const metodo = options?.method ?? 'GET';
    metodos.push(`${metodo} ${url}`);
    if (url === '/api/arquivos' && metodo === 'POST') {
      return { ok: true, status: 201, json: async () => ({ criados: [arquivo('a1', 'novo.png')], duplicados: [], recusados: [] }) } as Response;
    }
    listagens++;
    return { ok: true, json: async () => [arquivo('a1', 'novo.png')] } as Response;
  });

  render(<Arquivos />);
  await screen.findByRole('button', { name: /Adicionar arquivos/ });
  const input = screen.getByLabelText('Enviar fotos, imagens e PDFs');
  await user.upload(input, new File(['x'], 'novo.png', { type: 'image/png' }));

  await waitFor(() => expect(metodos).toContain('POST /api/arquivos'));
  // Confirmar para o aluno o que entrou (e a lista foi recarregada depois).
  expect(await screen.findByText(/1 arquivo guardado/)).toBeTruthy();
  expect(listagens).toBeGreaterThanOrEqual(2);
  expect(await screen.findByText('novo.png')).toBeTruthy();
});

test('arquivo grande demais é bloqueado no cliente antes do envio', async () => {
  const user = userEvent.setup();
  localStorage.setItem('estudo_token', 'token-de-teste');
  const chamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    chamadas.push(`${options?.method ?? 'GET'} ${url}`);
    return { ok: true, json: async () => [] } as Response;
  });

  render(<Arquivos />);
  await screen.findByRole('button', { name: /Adicionar arquivos/ });
  const input = screen.getByLabelText('Enviar fotos, imagens e PDFs');
  const gigante = new File([new Uint8Array(11 * 1024 * 1024)], 'gigante.png', { type: 'image/png' });
  await user.upload(input, gigante);

  expect((await screen.findByRole('alert')).textContent).toContain('10 MB');
  // Nada foi enviado ao servidor: o corte aconteceu no cliente.
  expect(chamadas).not.toContain('POST /api/arquivos');
});

test('remover chama DELETE na rota do arquivo e some da lista', async () => {
  const user = userEvent.setup();
  localStorage.setItem('estudo_token', 'token-de-teste');
  const chamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    const metodo = options?.method ?? 'GET';
    chamadas.push(`${metodo} ${url}`);
    if (metodo === 'DELETE') return { ok: true, json: async () => ({ id: 'a1' }) } as Response;
    return { ok: true, json: async () => [arquivo('a1', 'caderno.png')] } as Response;
  });

  render(<Arquivos />);
  await screen.findByText('caderno.png');
  await user.click(screen.getByRole('button', { name: 'Remover caderno.png' }));

  await waitFor(() => expect(chamadas).toContain('DELETE /api/arquivos/a1'));
  expect(screen.queryByText('caderno.png')).toBeNull();
});

test('renomear abre o editor, envia PATCH e troca o nome na lista', async () => {
  const user = userEvent.setup();
  localStorage.setItem('estudo_token', 'token-de-teste');
  const chamadas: string[] = [];
  let corpoPatch = '';
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    const metodo = options?.method ?? 'GET';
    chamadas.push(`${metodo} ${url}`);
    if (metodo === 'PATCH') {
      corpoPatch = String(options?.body);
      return { ok: true, json: async () => arquivo('a1', 'prova-logica.png') } as Response;
    }
    return { ok: true, json: async () => [arquivo('a1', 'caderno.png')] } as Response;
  });

  render(<Arquivos />);
  await screen.findByText('caderno.png');
  await user.click(screen.getByRole('button', { name: 'Renomear caderno.png' }));

  // O editor vem pré-cheio com o radical, sem a extensão (que é fixa na tela).
  const campo = await screen.findByLabelText(/Novo nome de caderno.png/);
  expect((campo as HTMLInputElement).value).toBe('caderno');
  await user.clear(campo);
  await user.type(campo, 'prova logica'); // o espaço digitado é descartado no cliente
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  await waitFor(() => expect(chamadas).toContain('PATCH /api/arquivos/a1'));
  expect(JSON.parse(corpoPatch)).toEqual({ nome: 'provalogica' });
  expect(await screen.findByText('prova-logica.png')).toBeTruthy();
});

test('renomear não salva com nome vazio', async () => {
  const user = userEvent.setup();
  localStorage.setItem('estudo_token', 'token-de-teste');
  const chamadas: string[] = [];
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    chamadas.push(`${options?.method ?? 'GET'} ${url}`);
    return { ok: true, json: async () => [arquivo('a1', 'caderno.png')] } as Response;
  });

  render(<Arquivos />);
  await screen.findByText('caderno.png');
  await user.click(screen.getByRole('button', { name: 'Renomear caderno.png' }));
  const campo = await screen.findByLabelText(/Novo nome de caderno.png/);
  await user.clear(campo);
  await user.click(screen.getByRole('button', { name: 'Salvar' }));

  expect(chamadas).not.toContain('PATCH /api/arquivos/a1');
  // O editor continua aberto: o aluno não perde o lugar onde estava.
  expect(screen.queryByLabelText(/Novo nome de caderno.png/)).toBeTruthy();
});
