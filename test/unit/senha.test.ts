import { expect, test } from 'vitest';
import { hashSenha, verificarSenha } from '../../lib/auth/senha';

test('verificarSenha aceita a senha que originou o hash', async () => {
  const hash = await hashSenha('senha-da-criança');
  expect(await verificarSenha('senha-da-criança', hash)).toBe(true);
});

test('verificarSenha rejeita senha diferente', async () => {
  const hash = await hashSenha('senha-da-criança');
  expect(await verificarSenha('outra-senha', hash)).toBe(false);
});

test('dois hashes da mesma senha são diferentes (saléado)', async () => {
  const a = await hashSenha('mesma');
  const b = await hashSenha('mesma');
  expect(a).not.toBe(b);
  expect(await verificarSenha('mesma', a)).toBe(true);
  expect(await verificarSenha('mesma', b)).toBe(true);
});

test('hash tem o formato scrypt$N$r$p$hash$sal', async () => {
  const hash = await hashSenha('x');
  expect(hash).toMatch(/^scrypt\$65536\$8\$4\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]+$/);
});

test('verificarSenha não explode com hash malformado', async () => {
  expect(await verificarSenha('x', 'scrypt$1$1$1$abcd')).toBe(false);
});
