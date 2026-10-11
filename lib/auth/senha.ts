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
  const [, n, r, p, hashBase64, salBase64] = partes;
  const real = Buffer.from(hashBase64, 'base64');
  const esperado = await scryptAsync(senha, Buffer.from(salBase64, 'base64'), real.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM,
  });
  return esperado.length === real.length && timingSafeEqual(esperado, real);
}
