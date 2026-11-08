import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NovaRevisao from '@/app/revisoes/nova/page';
import Home from '@/app/page';

// `replace` entrou no mock porque as páginas chamam router.replace('/login').
// `usePathname` entrou porque o Header marca o link ativo.
// `router` é hoisted para que o teste de retomada afirme o redirect.
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/' }));

// O formulário lista a biblioteca ao montar (SelecionarDaBiblioteca). Sem stub, o
// fetch do jsdom tentaria uma conexão real e o teste dependeria da rede.
// `stubBibliotecaVazia` responde GET /api/arquivos sem registrar nada em requests:
// os testes que espiam o envio só querem ver o POST de criação.
function stubBibliotecaVazia() {
  const original = globalThis.fetch;
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/arquivos') return { ok: true, json: async () => [] } as Response;
    return original(url, options as RequestInit);
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
  vi.unstubAllGlobals();
});

const imagem = (name: string) => new File(['imagem'], name, { type: 'image/jpeg' });
const pdf = new File(['pdf'], 'apostila.pdf', { type: 'application/pdf' });

test('acumula seleções e só envia todo o material ao gerar questões', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    const metodo = options?.method ?? 'GET';
    if (url === '/api/arquivos') return { ok: true, json: async () => [] } as Response;
    // Só o POST de criação entra em requests: o Header também faz fetch (GET
    // /api/conta) no mesmo stub, e um GET sem corpo entraria como undefined.
    if (metodo === 'POST') requests.push(options.body as FormData);
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) };
  });
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Adicionar arquivos novos (opcional)');
  await user.type(screen.getByLabelText('Conteúdo da revisão'), 'Sistema solar');
  await user.upload(input, imagem('pagina-1.jpg'));
  await user.upload(input, [pdf, imagem('pagina-2.jpg')]);
  expect(screen.getByText('pagina-1.jpg')).toBeTruthy();
  expect(screen.getByText('apostila.pdf')).toBeTruthy();
  // Nada enviado antes de clicar em gerar. O filtro é por método porque o Header
  // também faz fetch (GET /api/conta) e esse GET cai no mesmo stub.
  expect(requests).toHaveLength(0);
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].get('texto')).toBe('Sistema solar');
  expect(requests[0].getAll('arquivos').map(file => (file as File).name))
    .toEqual(['pagina-1.jpg', 'apostila.pdf', 'pagina-2.jpg']);
  expect(await screen.findByText('pagina-1.jpg')).toBeTruthy();
});

test('permite remover e selecionar novamente o mesmo arquivo', async () => {
  const user = userEvent.setup();
  stubBibliotecaVazia();
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Adicionar arquivos novos (opcional)');
  const file = imagem('pagina.jpg');
  await user.upload(input, file);
  await user.click(screen.getByRole('button', { name: 'Remover pagina.jpg' }));
  expect(screen.queryByText('pagina.jpg')).toBeNull();
  expect((screen.getByRole('button', { name: /Gerar Questões/ }) as HTMLButtonElement).disabled).toBe(true);
  await user.upload(input, file);
  expect(screen.getByText('pagina.jpg')).toBeTruthy();
});

test('limita o total acumulado de imagens e continua aceitando PDFs', async () => {
  const user = userEvent.setup();
  stubBibliotecaVazia();
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Adicionar arquivos novos (opcional)');
  await user.upload(input, Array.from({ length: 39 }, (_, i) => imagem(`pagina-${i}.jpg`)));
  await user.upload(input, [imagem('ultima.jpg'), imagem('excedente.jpg'), pdf]);
  expect(screen.getAllByRole('button', { name: /^Remover / })).toHaveLength(41);
  expect(screen.queryByText('excedente.jpg')).toBeNull();
  expect(screen.getByText('apostila.pdf')).toBeTruthy();
  expect(screen.getByRole('alert').textContent).toContain('40 imagens');
  await user.click(screen.getByRole('button', { name: 'Remover ultima.jpg' }));
  await user.upload(input, imagem('excedente.jpg'));
  expect(screen.getByText('excedente.jpg')).toBeTruthy();
});

test('a home mostra o link para a área de revisões e o atalho para créditos, sem o formulário de resgate', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/planos') {
      return { ok: true, json: async () => [{ codigo: 'pro', nome: 'Pro', revisoes: 20, preco_cents: 500 }] } as Response;
    }
    return { ok: true, json: async () => [] } as Response;
  });
  render(<Home />);
  expect(screen.getByRole('link', { name: /Ir para as revisões/ })).toBeTruthy();
  expect(screen.getByRole('link', { name: /Ver meus créditos/ })).toBeTruthy();
  // Créditos têm uma área só (/creditos): a home aponta para lá, não replica o resgate.
  expect(screen.queryByLabelText('Código do pacote')).toBeNull();
  // A home não é mais o formulário: o formulário fica na área de revisões.
  expect(screen.queryByLabelText('Conteúdo da revisão')).toBeNull();
});

test('mostra a contagem de arquivos no singular e no plural ao adicionar e remover', async () => {
  const user = userEvent.setup();
  stubBibliotecaVazia();
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Adicionar arquivos novos (opcional)');
  expect(screen.getByRole('status').textContent).toBe('Nenhum arquivo adicionado ainda.');
  await user.upload(input, imagem('pagina-1.jpg'));
  expect(screen.getByRole('status').textContent).toBe('1 arquivo adicionado');
  await user.upload(input, imagem('pagina-2.jpg'));
  expect(screen.getByRole('status').textContent).toBe('2 arquivos adicionados');
  await user.click(screen.getByRole('button', { name: 'Remover pagina-1.jpg' }));
  expect(screen.getByRole('status').textContent).toBe('1 arquivo adicionado');
  await user.click(screen.getByRole('button', { name: 'Remover pagina-2.jpg' }));
  expect(screen.getByRole('status').textContent).toBe('Nenhum arquivo adicionado ainda.');
});

test('mostra o aviso de saldo esgotado (402) em vez do spinner após o envio', async () => {
  const user = userEvent.setup();
  const mensagem = 'Você usou suas revisões. Resgate um token para continuar.';
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/arquivos') return { ok: true, json: async () => [] } as Response;
    return { ok: false, status: 402, json: async () => ({ error: mensagem }) };
  });
  render(<NovaRevisao />);
  await user.type(screen.getByLabelText('Conteúdo da revisão'), 'Sistema solar');
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));
  const alerta = await screen.findByRole('alert');
  expect(alerta.textContent).toBe(mensagem);
  expect(screen.queryByText('A Lia está preparando as questões...')).toBeNull();
});

test('remove espaços das bordas do texto sem alterar espaços internos ao enviar', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    if (url === '/api/arquivos') return { ok: true, json: async () => [] } as Response;
    requests.push(options.body as FormData);
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) };
  });
  render(<NovaRevisao />);
  await user.type(screen.getByLabelText('Conteúdo da revisão'), '  Sistema  solar  ');
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].get('texto')).toBe('Sistema  solar');
});

test('envia a chave de idempotência da tentativa no header e a limpa no 200', async () => {
  const user = userEvent.setup();
  const headers: Headers[] = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    if (url === '/api/arquivos') return { ok: true, json: async () => [] } as Response;
    headers.push(new Headers(options.headers));
    return { ok: true, json: async () => ({ id: 'rev-1', saldo: 2 }) } as Response;
  });
  render(<NovaRevisao />);
  await user.type(screen.getByLabelText('Conteúdo da revisão'), 'Sistema solar');
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));
  await waitFor(() => expect(headers).toHaveLength(1));
  expect(headers[0].get('x-idempotency-key')).toMatch(/[0-9a-f-]{36}/);
  // No 200 confirmado a tentativa deixa de estar pendente.
  expect(localStorage.getItem('estudo_tentativa')).toBeNull();
});

test('ao montar com tentativa pendente, redireciona para a revisão já gerada', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  localStorage.setItem('estudo_tentativa', 'chave-abc');
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/revisoes') {
      return { ok: true, json: async () => [{ id: 'rev-1', chave_idempotencia: 'chave-abc' }] } as Response;
    }
    return { ok: true, json: async () => [] } as Response;
  });
  render(<NovaRevisao />);
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/estudar/rev-1'));
  expect(localStorage.getItem('estudo_tentativa')).toBeNull();
});

// ---------- Biblioteca no formulário ----------

const bibliotecaCom = (arquivos: Array<{ id: string; nome: string; mime: string }>) => {
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/arquivos') {
      return { ok: true, json: async () => arquivos.map((a) => ({ ...a, tamanho: 2048, origem: 'biblioteca', criado_em: '2026-11-08T00:00:00Z' })) } as Response;
    }
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) } as Response;
  });
};

test('lista os arquivos da biblioteca e envia o marcado como arquivoIds', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (url: string, options: RequestInit) => {
    if (url === '/api/arquivos' && (options?.method ?? 'GET') === 'GET') {
      return {
        ok: true,
        json: async () => [
          { id: 'aaa-1', nome: 'caderno.png', mime: 'image/png', tamanho: 2048, origem: 'revisao', criado_em: '2026-11-08T00:00:00Z' },
          { id: 'bbb-2', nome: 'apostila.pdf', mime: 'application/pdf', tamanho: 4096, origem: 'biblioteca', criado_em: '2026-11-08T00:00:00Z' },
        ],
      } as Response;
    }
    requests.push(options.body as FormData);
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) } as Response;
  });

  render(<NovaRevisao />);
  const checkbox = await screen.findByRole('checkbox', { name: /caderno\.png/ });
  await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));

  await waitFor(() => expect(requests).toHaveLength(1));
  // O arquivo da biblioteca sobe só pelo id: nenhum byte é reenviado.
  expect(requests[0].getAll('arquivoIds')).toEqual(['aaa-1']);
  expect(requests[0].getAll('arquivos')).toHaveLength(0);
});

test('marcar um arquivo da biblioteca habilita o envio sem texto nem arquivo novo', async () => {
  const user = userEvent.setup();
  bibliotecaCom([{ id: 'aaa-1', nome: 'caderno.png', mime: 'image/png' }]);
  render(<NovaRevisao />);
  const botao = screen.getByRole('button', { name: /Gerar Questões/ }) as HTMLButtonElement;
  expect(botao.disabled).toBe(true);
  await user.click(await screen.findByRole('checkbox', { name: /caderno\.png/ }));
  expect(botao.disabled).toBe(false);
});
