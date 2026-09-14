import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RevisaoPage from '@/app/revisao/page';
import Home from '@/app/page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const imagem = (name: string) => new File(['imagem'], name, { type: 'image/jpeg' });
const pdf = new File(['pdf'], 'apostila.pdf', { type: 'application/pdf' });

test('acumula seleções e só envia todo o material ao gerar questões', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: false, json: async () => ({ error: 'Tente novamente.' }) };
  });
  render(<RevisaoPage />);
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
  render(<RevisaoPage />);
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
  render(<RevisaoPage />);
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

test('disponibiliza o formulário diretamente na tela principal', async () => {
  vi.stubGlobal('fetch', async () => ({ json: async () => [] }));
  render(<Home />);
  expect(screen.getByLabelText('Imagens e PDFs (opcional)')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Gerar Questões/ })).toBeTruthy();
});
