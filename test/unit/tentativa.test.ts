import { beforeEach, expect, test, vi } from 'vitest';
import { guardarTentativa, lerTentativa, limparTentativa } from '../../lib/client/tentativa';
import { guardarToken, lerToken, limparToken } from '../../lib/client/api';

beforeEach(() => { localStorage.clear(); });

test('guardarTentativa e lerTentativa guardam a chave da tentativa no localStorage', () => {
  guardarTentativa('chave-abc');
  expect(lerTentativa()).toBe('chave-abc');
  limparTentativa();
  expect(lerTentativa()).toBeNull();
});

// A tentativa precisa sobreviver à saída: "sair" limpa o token, mas a chave da
// tentativa continua para o lookup de retomada ao voltar.
test('a tentativa sobrevive a limparToken', () => {
  guardarToken('abc');
  guardarTentativa('chave-abc');
  limparToken();
  expect(lerToken()).toBeNull();
  expect(lerTentativa()).toBe('chave-abc');
});

// O Next pré-renderiza a página no servidor, onde localStorage não existe. O
// componente chama lerTentativa nesse caminho, então o helper não pode lançar.
test('lerTentativa devolve null onde localStorage não existe (pré-render)', () => {
  vi.stubGlobal('localStorage', undefined);
  expect(lerTentativa()).toBeNull();
  vi.unstubAllGlobals();
});
