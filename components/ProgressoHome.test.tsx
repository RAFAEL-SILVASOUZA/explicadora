import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import ProgressoHome from '@/components/ProgressoHome';

// O placar vem de /api/resumo; o teste garante que os quatro cartões listetados
// mostram os mesmos números do JSON (nenhum cartão calcula nada por conta).
function resumoDeTeste() {
  return {
    revisoes: 3, revisoesFinalizadas: 2, revisoesEstaSemana: 2,
    totalQuestoes: 20, totalRespostas: 18, acertos: 12, percentualAcertos: 60,
    deveres: 2, deveresConcluidos: 1, deveresEstaSemana: 1,
    slidesLidos: 9, slidesTotal: 12, percentualLeitura: 75,
  };
}

function stubFetchOk(resumo: unknown) {
  vi.stubGlobal('fetch', async () => ({
    ok: true, status: 200, json: async () => resumo,
  }) as Response);
}

beforeEach(() => { localStorage.setItem('estudo_token', 'token-de-teste'); });

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('mostra os quatro cartões a partir do /api/resumo', async () => {
  stubFetchOk(resumoDeTeste());
  render(<ProgressoHome />);

  await waitFor(() => expect(screen.getByText('Revisões feitas')).toBeTruthy());

  expect(screen.getByText('3')).toBeTruthy();
  expect(screen.getByText('2 de 3 finalizadas')).toBeTruthy();
  expect(screen.getByText('+2 esta semana')).toBeTruthy();

  expect(screen.getByText('60%')).toBeTruthy();
  expect(screen.getByText('12 de 20 perguntas certas')).toBeTruthy();

  expect(screen.getByText('Deveres feitos')).toBeTruthy();
  expect(screen.getByText('1 de 2 concluídos')).toBeTruthy();
  expect(screen.getByText('+1 esta semana')).toBeTruthy();

  expect(screen.getByText('Leitura de deveres')).toBeTruthy();
  expect(screen.getByText('75%')).toBeTruthy();
  expect(screen.getByText('9 de 12 slides lidos')).toBeTruthy();
});

test('os cartões são links para a área dona do número', async () => {
  stubFetchOk(resumoDeTeste());
  render(<ProgressoHome />);
  await waitFor(() => expect(screen.getByText('Revisões feitas')).toBeTruthy());

  const links = screen.getAllByRole('link');
  expect(links.filter((l) => l.getAttribute('href') === '/revisoes')).toHaveLength(2);
  expect(links.filter((l) => l.getAttribute('href') === '/deveres')).toHaveLength(2);
});

test('sem perguntas/slides: percentual vira travessão e a copy é honesta', async () => {
  stubFetchOk({
    revisoes: 0, revisoesFinalizadas: 0, revisoesEstaSemana: 0,
    totalQuestoes: 0, totalRespostas: 0, acertos: 0, percentualAcertos: null,
    deveres: 0, deveresConcluidos: 0, deveresEstaSemana: 0,
    slidesLidos: 0, slidesTotal: 0, percentualLeitura: null,
  });
  render(<ProgressoHome />);

  await waitFor(() => expect(screen.getByText('Taxa de acertos')).toBeTruthy());

  expect(screen.getAllByText('—')).toHaveLength(2);
  expect(screen.getByText('Responda uma revisão para ver sua nota')).toBeTruthy();
  expect(screen.getByText('Leia um dever para ver sua leitura')).toBeTruthy();
});

test('falha de carregamento mostra estado de erro com botão de tentar de novo', async () => {
  vi.stubGlobal('fetch', async () => ({ ok: false, status: 500, json: async () => ({}) }) as Response);
  render(<ProgressoHome />);

  await waitFor(() => expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeTruthy());
  expect(screen.getByText('Não foi possível carregar seu progresso.')).toBeTruthy();
});

test('enquanto carrega, a silhueta é escondida e o status de espera é acessível', () => {
  vi.stubGlobal('fetch', () => new Promise<Response>(() => {}));
  render(<ProgressoHome />);

  // O estado de espera não pode mostrar um resultado (mesmo princípio da barra de /estudar).
  expect(screen.getByText('Carregando seu progresso…')).toBeTruthy();
  expect(screen.queryByText('Revisões feitas')).toBeNull();
});
