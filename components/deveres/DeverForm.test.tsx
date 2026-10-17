import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DeverForm from '@/components/deveres/DeverForm';

// Mesmo esqueleto de components/RevisaoForm.test.tsx: router hoisted, usePathname
// mockado (o Header marca link ativo), userEvent em vez de fireEvent.
const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/deveres/nova' }));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  router.push.mockClear();
});

const button = () => screen.getByRole('button', { name: /Explicar o dever/ }) as HTMLButtonElement;

test('botão de enviar está desabilitado sem conteúdo', () => {
  render(<DeverForm />);
  expect(button().disabled).toBe(true);
});

test('texto simples habilita o envio', async () => {
  const user = userEvent.setup();
  render(<DeverForm />);
  await user.type(screen.getByLabelText('Escreva o enunciado (opcional)'), 'Quanto é 12 + 7?');
  expect(button().disabled).toBe(false);
});

test('envio chama a rota, envia o texto e limpa a tentativa pendente', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: true, status: 200, json: async () => ({ id: 'dever-1', saldo: 2 }) } as Response;
  });

  render(<DeverForm />);
  await user.type(screen.getByLabelText('Escreva o enunciado (opcional)'), 'dever de matemática');
  await user.click(button());

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].get('texto')).toBe('dever de matemática');
  await waitFor(() => expect(router.push).toHaveBeenCalledWith('/deveres/dever-1'));
  expect(localStorage.getItem('estudo_tentativa_dever')).toBeNull();
});

test('402 mostra a mensagem de crédito esgotado', async () => {
  const user = userEvent.setup();
  vi.stubGlobal('fetch', async () => ({
    ok: false, status: 402,
    json: async () => ({ error: 'Você usou suas revisões. Resgate um token para continuar.' }),
  }) as Response);

  render(<DeverForm />);
  await user.type(screen.getByLabelText('Escreva o enunciado (opcional)'), 'dever');
  await user.click(button());

  // O repo nao tem @testing-library/jest-dom (sem setup file), entao nao existe
  // toHaveTextContent: mesma assercao de RevisaoForm.test.tsx via textContent.
  expect((await screen.findByRole('alert')).textContent).toContain('Resgate um token');
});

test('acumula fotos e PDFs e envia tudo junto', async () => {
  const user = userEvent.setup();
  const requests: FormData[] = [];
  vi.stubGlobal('fetch', async (_url: string, options: RequestInit) => {
    requests.push(options.body as FormData);
    return { ok: false, status: 500, json: async () => ({ error: 'Tente novamente.' }) } as Response;
  });

  render(<DeverForm />);
  const input = screen.getByLabelText('Fotos e PDFs do dever');
  await user.upload(input, new File(['a'], 'pagina-1.jpg', { type: 'image/jpeg' }));
  await user.upload(input, [
    new File(['b'], 'atividade.pdf', { type: 'application/pdf' }),
    new File(['c'], 'pagina-2.jpg', { type: 'image/jpeg' }),
  ]);
  expect(button().disabled).toBe(false);
  await user.click(button());

  await waitFor(() => expect(requests).toHaveLength(1));
  expect(requests[0].getAll('arquivos').map((f) => (f as File).name))
    .toEqual(['pagina-1.jpg', 'atividade.pdf', 'pagina-2.jpg']);
});
