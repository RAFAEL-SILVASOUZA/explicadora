// @vitest-environment node
import { expect, test } from 'vitest';
import { NextRequest } from 'next/server';
import { assinarToken, verificarToken } from '../../lib/auth/jwt';
import { autenticar } from '../../lib/auth/guard';

process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';

test('token assinado é aceito e carrega sub e role', () => {
  const token = assinarToken('conta-1', 'admin');
  const payload = verificarToken(token);
  expect(payload).toEqual({ sub: 'conta-1', role: 'admin' });
});

test('token inválido é recusado', () => {
  expect(verificarToken('nao-e-um-jwt')).toBeNull();
});

test('token assinado com outro segredo é recusado', () => {
  const token = assinarToken('conta-1', 'user');
  process.env.JWT_SECRET = 'outro-segredo-com-pelo-menos-32-caracteres!!';
  expect(verificarToken(token)).toBeNull();
  process.env.JWT_SECRET = 'segredo-de-teste-com-pelo-menos-32-caracteres';
});

test('token expirado é recusado', () => {
  const token = assinarToken('conta-1', 'user', -10);
  expect(verificarToken(token)).toBeNull();
});

test('autenticar lê o header Bearer', async () => {
  const token = assinarToken('conta-2', 'user');
  const req = new NextRequest('http://localhost/api/conta', {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(await autenticar(req)).toEqual({ contaId: 'conta-2', role: 'user' });
});

test('autenticar devolve null sem header', async () => {
  const req = new NextRequest('http://localhost/api/conta');
  expect(await autenticar(req)).toBeNull();
});

test('autenticar devolve null com header malformado', async () => {
  const req = new NextRequest('http://localhost/api/conta', {
    headers: { Authorization: 'Basic abc' },
  });
  expect(await autenticar(req)).toBeNull();
});
