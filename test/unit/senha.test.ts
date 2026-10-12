import { scrypt, type ScryptOptions } from 'node:crypto';
import { expect, test } from 'vitest';
import { hashSenha, verificarSenha } from '../../lib/auth/senha';

// Derivação independente, pela API de callback, para comparar com o hash serializado.
function derivar(senha: string, sal: Buffer, keylen: number, opcoes: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(senha, sal, keylen, opcoes, (erro, resultado) => (erro ? reject(erro) : resolve(resultado)));
  });
}

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

test('campo de hash vazio é rejeitado (não aceita qualquer senha)', async () => {
  expect(await verificarSenha('qualquer-senha', 'scrypt$1024$8$4$$efgh')).toBe(false);
});

test('parâmetros inválidos retornam false em vez de lançar', async () => {
  // Number('abc') => NaN => RangeError; N=1 => Invalid scrypt params.
  expect(await verificarSenha('x', 'scrypt$abc$8$4$abcd$efgh')).toBe(false);
  expect(await verificarSenha('x', 'scrypt$1$1$1$abcd$efgh')).toBe(false);
  expect(await verificarSenha('x', 'scrypt$65536$0$4$abcd$efgh')).toBe(false);
  expect(await verificarSenha('x', 'scrypt$65536$8$0$abcd$efgh')).toBe(false);
  expect(await verificarSenha('x', 'scrypt$65536.5$8$4$abcd$efgh')).toBe(false);
});

test('os parâmetros escritos no hash são os usados na derivação', async () => {
  // Deriva independentemente com r/p minúsculos. Se hashSenha usasse os
  // defaults do Node (N=16384, r=8, p=1) o campo não bateria e o teste falha.
  const hash = await hashSenha('parâmetros');
  const [, n, r, p, hashBase64, salBase64] = hash.split('$');
  const esperado = await derivar('parâmetros', Buffer.from(salBase64, 'base64'), 32, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 256 * 65536 * 8,
  });
  expect(Buffer.from(hashBase64, 'base64').toString('base64')).toBe(esperado.toString('base64'));
  // Um hash que declara parâmetros diferentes dos da derivação é rejeitado.
  const outro = `scrypt$16384$8$1$${hashBase64}$${salBase64}`;
  expect(await verificarSenha('parâmetros', outro)).toBe(false);
});
