// @vitest-environment node
// O environment default do projeto é jsdom (transformMode "web"), e nesse modo o
// vite aplica interop de CJS aos imports de node:child_process/node:fs e acessa
// `.default` no mock, o que o vitest 3 reprova ("No "default" export is defined").
// Este teste não usa DOM: roda em node (transformMode "ssr"), onde o mock literal
// funciona. Sem essa linha o arquivo falha ao coletar.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'node:path';

// execFile é mockado na convenção de callback, então o promisify real de
// node:util continua em uso (mockar node:util afetaria todo o processo de teste).
const { execFile, existsSync, readFile, mkdir } = vi.hoisted(() => ({
  execFile: vi.fn(),
  existsSync: vi.fn(() => true),
  readFile: vi.fn(),
  mkdir: vi.fn(async () => {}),
}));

vi.mock('node:child_process', () => ({ execFile }));
vi.mock('node:fs', () => ({ existsSync, promises: { mkdir, readFile } }));

import { caminhoDoAudio, piperDisponivel, sintetizarPassos } from '@/lib/deveres/piper';

// WAV mono 8000 Hz 8 bits: byteRate 8000, 16000 bytes de dados = 2 s.
function wavDe2s(): Buffer {
  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + 16000, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);
  cabecalho.writeUInt16LE(1, 22);
  cabecalho.writeUInt32LE(8000, 24);
  cabecalho.writeUInt32LE(8000, 28);
  cabecalho.writeUInt16LE(1, 32);
  cabecalho.writeUInt16LE(8, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(16000, 40);
  return Buffer.concat([cabecalho, Buffer.alloc(16000, 0x80)]);
}

const sucesso = () => execFile.mockImplementation((_b: string, _a: string[], _o: unknown, cb: (e: null) => void) => cb(null));

beforeEach(() => {
  execFile.mockReset();
  readFile.mockReset();
  mkdir.mockClear();
  existsSync.mockReturnValue(true);
  readFile.mockResolvedValue(wavDe2s());
  process.env.PIPER_BIN = '/opt/piper/piper';
  process.env.PIPER_MODEL = '/opt/piper/pt_BR-faber-medium.onnx';
});

afterEach(() => {
  delete process.env.PIPER_BIN;
  delete process.env.PIPER_MODEL;
});

describe('piperDisponivel', () => {
  it('true com bin e modelo configurados', () => {
    expect(piperDisponivel()).toBe(true);
  });

  it('false sem PIPER_BIN', () => {
    delete process.env.PIPER_BIN;
    expect(piperDisponivel()).toBe(false);
  });

  it('false sem PIPER_MODEL', () => {
    delete process.env.PIPER_MODEL;
    expect(piperDisponivel()).toBe(false);
  });

  it('false quando o binário não existe no disco', () => {
    existsSync.mockReturnValue(false);
    expect(piperDisponivel()).toBe(false);
  });
});

describe('caminhoDoAudio', () => {
  it('fica em uploads/deveres/<id>/<ordem>.wav', () => {
    const p = caminhoDoAudio('abc', 3);
    expect(p.endsWith(path.join('uploads', 'deveres', 'abc', '3.wav'))).toBe(true);
  });
});

describe('sintetizarPassos', () => {
  it('sem Piper configurado devolve passos sem áudio', async () => {
    delete process.env.PIPER_BIN;
    const r = await sintetizarPassos('abc', [{ ordem: 1, narracao: 'oi' }]);
    expect(r).toEqual([{ ordem: 1, caminho: '', duracao_ms: null }]);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('chama o Piper uma vez por passo e devolve a duração lida do WAV', async () => {
    sucesso();
    const r = await sintetizarPassos('abc', [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(execFile).toHaveBeenCalledTimes(2);
    expect(r[0].duracao_ms).toBe(2000);
    expect(r[1].caminho).toContain(path.join('2.wav'));
  });

  it('falha de um passo não derruba os demais', async () => {
    execFile.mockImplementationOnce((_b: string, _a: string[], _o: unknown, cb: (e: Error) => void) =>
      cb(new Error('piper caiu')));
    sucesso();
    const r = await sintetizarPassos('abc', [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(r[0].duracao_ms).toBeNull();
    expect(r[0].caminho).toBe('');
    expect(r[1].duracao_ms).toBe(2000);
    expect(r[1].caminho).toContain(path.join('2.wav'));
  });
});
