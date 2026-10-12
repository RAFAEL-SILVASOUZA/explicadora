import { randomBytes, scrypt, timingSafeEqual, type BinaryLike, type ScryptOptions } from 'node:crypto';
import { promisify } from 'node:util';

// promisify(scrypt) resolve a sobrecarga sem options; o tipo é anotado
// explicitamente para poder passar os parâmetros.
type ScryptAsync = (
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

const scryptAsync = promisify(scrypt) as ScryptAsync;

const N = 65536;
const R = 8;
const P = 4;
const TAMANHO_HASH = 32;

// maxmem padrão do Node (32 MiB) é menor que a memória exigida por scrypt com
// N=65536 e R=8 (128*N*R = 64 MiB): sem maxmem explícito o hash falha.
const MAXMEM = 256 * N * R;

// Base64 sem padding: '=' é reservado como separador dos campos do hash.
function base64SemPadding(dados: Buffer): string {
  return dados.toString('base64').replace(/=+$/, '');
}

export async function hashSenha(senha: string): Promise<string> {
  const sal = randomBytes(16);
  const hash = await scryptAsync(senha, sal, TAMANHO_HASH, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${base64SemPadding(hash)}$${base64SemPadding(sal)}`;
}

export async function verificarSenha(senha: string, armazenado: string): Promise<boolean> {
  const partes = armazenado.split('$');
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false;
  const [, campoN, campoR, campoP, hashBase64, salBase64] = partes;
  // Parâmetros vêm do banco: um valor inválido não pode virar exceção (500).
  const n = Number(campoN);
  const r = Number(campoR);
  const p = Number(campoP);
  if (!Number.isInteger(n) || n <= 1) return false;
  if (!Number.isInteger(r) || r <= 0) return false;
  if (!Number.isInteger(p) || p <= 0) return false;
  const real = Buffer.from(hashBase64, 'base64');
  // keylen fixo: sem isso, um campo de hash vazio deriva 0 bytes e
  // timingSafeEqual(empty, empty) aceitaria qualquer senha.
  if (real.length !== TAMANHO_HASH) return false;
  const esperado = await scryptAsync(senha, Buffer.from(salBase64, 'base64'), TAMANHO_HASH, {
    N: n, r, p, maxmem: MAXMEM,
  });
  return timingSafeEqual(esperado, real);
}
