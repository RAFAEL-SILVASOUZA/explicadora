import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NovaRevisao from '@/app/revisoes/nova/page';
import Home from '@/app/page';

// `replace` entrou no mock porque as páginas chamam router.replace('/login').
vi.mock('next/navigation', () => {
  const router = { push: vi.fn(), replace: vi.fn() };
  return { useRouter: () => router };
});
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

const imagem = (name: string) => new File(['imagem'], name, { type: 'image/jpeg' });
const pdf = new File(['pdf'], 'apostila.pdf', { type: 'application/pdf' });

test('acumula seleções e só envia todo o material ao gerar questões', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) };
  });
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Imagens e PDFs (opcional)');
  await user.type(screen.getByLabelText('Conteúdo da revisão'), 'Sistema solar');
  await user.upload(input, imagem('pagina-1.jpg'));
  await user.upload(input, [pdf, imagem('pagina-2.jpg')]);
  expect(screen.getByText('pagina-1.jpg')).toBeTruthy();
  expect(screen.getByText('apostila.pdf')).toBeTruthy();
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
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Imagens e PDFs (opcional)');
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
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Imagens e PDFs (opcional)');
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

test('a home mostra os planos, o resgate e o link para a área de revisões', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/planos') {
      return { ok: true, json: async () => [{ codigo: 'pro', nome: 'Pro', revisoes: 20, preco_cents: 500 }] } as Response;
    }
    return { ok: true, json: async () => [] } as Response;
  });
  render(<Home />);
  // Intl usa espaço insensível a quebra de linha entre "R$" e o número, então o teste
  // compara o número, não a string inteira.
  await waitFor(() => expect(screen.getByText(/5,00/)).toBeTruthy());
  expect(screen.getByLabelText('Código do pacote')).toBeTruthy();
  expect(screen.getByRole('link', { name: /Ir para as revisões/ })).toBeTruthy();
  // A home não é mais o formulário: o formulário fica na área de revisões.
  expect(screen.queryByLabelText('Conteúdo da revisão')).toBeNull();
});

test('mostra a contagem de arquivos no singular e no plural ao adicionar e remover', async () => {
  const user = userEvent.setup();
  render(<NovaRevisao />);
  const input = screen.getByLabelText('Imagens e PDFs (opcional)');
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
  vi.stubGlobal('fetch', async () => ({
    ok: false,
    status: 402,
    json: async () => ({ error: mensagem }),
  }));
  render(<NovaRevisao />);
  await user.type(screen.getByLabelText('Conteúdo da revisão'), 'Sistema solar');
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));
  const alerta = await screen.findByRole('alert');
  expect(alerta.textContent).toBe(mensagem);
  expect(screen.queryByText('O professor está preparando as questões...')).toBeNull();
});

test('remove espaços das bordas do texto sem alterar espaços internos ao enviar', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) };
  });
  render(<NovaRevisao />);
  await user.type(screen.getByLabelText('Conteúdo da revisão'), '  Sistema  solar  ');
  await user.click(screen.getByRole('button', { name: /Gerar Questões/ }));
  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].get('texto')).toBe('Sistema  solar');
});
