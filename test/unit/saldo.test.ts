import { afterEach, expect, test, vi } from 'vitest';
import { assinarSaldo, notificarSaldo } from '../../lib/client/saldo';

afterEach(() => { vi.useRealTimers(); });

test('notificarSaldo chama o assinante registrado', () => {
  const callback = vi.fn();
  const desinscrever = assinarSaldo(callback);
  notificarSaldo();
  expect(callback).toHaveBeenCalledTimes(1);
  desinscrever();
});

test('desinscrever para o callback de avisos seguintes', () => {
  const callback = vi.fn();
  const desinscrever = assinarSaldo(callback);
  desinscrever();
  notificarSaldo();
  expect(callback).not.toHaveBeenCalled();
});
