import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Creditos from '@/app/creditos/page';

const { router } = vi.hoisted(() => ({ router: { push: vi.fn(), replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router, usePathname: () => '/creditos' }));
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const contaResposta = {
  conta: { id: '1', role: 'user', nome: 'Ana', sobrenome: 'Souza', email: 'ana@ex.com', criado_em: '2026-10-01T12:00:00Z' },
  plano: 'pro',
  saldo: 20,
  movimentos: [
    { tipo: 'resgate', quantidade: 20, plano_codigo: 'pro', criado_em: '2026-10-10T12:00:00Z' },
    { tipo: 'consumo', quantidade: -1, plano_codigo: null, criado_em: '2026-10-11T12:00:00Z' },
  ],
};

function stubConte() {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/planos') {
      return { ok: true, json: async () => [{ codigo: 'pro', nome: 'Pro', revisoes: 20, preco_cents: 500 }] } as Response;
    }
    if (url === '/api/conta') return { ok: true, json: async () => contaResposta } as Response;
    return { ok: true, json: async () => ({}) } as Response;
  });
}

test('a área de créditos reúne saldo, planos, resgate e extrato numa tela só', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  stubConte();
  render(<Creditos />);
  // Intl usa espaço insensível a quebra de linha entre "R$" e o número, então o teste
  // compara o número, não a string inteira.
  await waitFor(() => expect(screen.getByText(/5,00/)).toBeTruthy());
  // "20 revisões" também aparece no card do plano Pro, então o saldo é lido dentro
  // da própria seção de plano e saldo.
  const saldoCard = screen.getByText('Plano e saldo').closest('section');
  expect(within(saldoCard as HTMLElement).getByText('20 revisões')).toBeTruthy();
  expect(screen.getByLabelText('Código do pacote')).toBeTruthy();
  expect(screen.getByText('Revisão gerada')).toBeTruthy();
});

test('extrato distingue consumo de dever explicado de consumo de revisão', async () => {
  localStorage.setItem('estudo_token', 'token-de-teste');
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/planos') {
      return { ok: true, json: async () => [{ codigo: 'pro', nome: 'Pro', revisoes: 20, preco_cents: 500 }] } as Response;
    }
    if (url === '/api/conta') {
      return {
        ok: true,
        json: async () => ({
          ...contaResposta,
          movimentos: [
            { tipo: 'consumo', quantidade: -1, plano_codigo: null, dever_id: 'dever-1', revisao_id: null, criado_em: '2026-10-12T12:00:00Z' },
            { tipo: 'consumo', quantidade: -1, plano_codigo: null, dever_id: null, revisao_id: 'rev-1', criado_em: '2026-10-13T12:00:00Z' },
          ],
        }),
      } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  render(<Creditos />);
  const extrato = screen.getByText('Extrato dos créditos').closest('section');
  await waitFor(() => expect(within(extrato as HTMLElement).getByText('Dever explicado')).toBeTruthy());
  expect(within(extrato as HTMLElement).getByText('Revisão gerada')).toBeTruthy();
});

test('resgatar envia o código e mostra o novo saldo', async () => {
  const user = userEvent.setup();
  localStorage.setItem('estudo_token', 'token-de-teste');
  stubConte();
  vi.stubGlobal('fetch', async (url: string, options?: RequestInit) => {
    if (url === '/api/planos') {
      return { ok: true, json: async () => [{ codigo: 'pro', nome: 'Pro', revisoes: 20, preco_cents: 500 }] } as Response;
    }
    if (url === '/api/conta') return { ok: true, json: async () => contaResposta } as Response;
    if (url === '/api/tokens/resgate') {
      const corpo = JSON.parse(String(options?.body));
      expect(corpo.codigo).toBe('PRO-7K4M-9XQ2');
      return { ok: true, json: async () => ({ plano: 'pro', revisoes: 20, novoSaldo: 40 }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  });
  render(<Creditos />);
  await user.type(screen.getByLabelText('Código do pacote'), 'PRO-7K4M-9XQ2');
  await user.click(screen.getByRole('button', { name: /Resgatar código/ }));
  expect(await screen.findByText(/Novo saldo: 40/)).toBeTruthy();
});
