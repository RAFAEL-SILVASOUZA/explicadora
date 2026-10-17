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
//
// O promisify real só devolve `child` porque child_process.execFile tem uma
// implementação em Symbol.for('nodejs.util.promisify.custom'). O mock precisa
// reproduzir isso, senão piper.ts recebe uma promessa sem child e o envio da
// narração pelo stdin fica sem cobertura (e o guard de child ausente dispara).
// O symbol é lido no momento do promisify (import do módulo), então a
// implementação já vem no mock hoisted.
const { execFile, existsSync, readFile, mkdir, stdins, estado } = vi.hoisted(() => {
  const PROMISIFY_CUSTOM = Symbol.for('nodejs.util.promisify.custom');
  const execFile = vi.fn();
  // stdins: um entry por chamada, para asserir que a narração foi escrita no stdin.
  const stdins: { on: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> }[] = [];
  // estado.semChild: simula o execFile devolver um processo sem stdin (finding 2).
  const estado = { semChild: false };
  (execFile as unknown as Record<string | symbol, unknown>)[PROMISIFY_CUSTOM] = (
    bin: unknown,
    args: unknown,
    options: unknown,
  ) => {
    const p = new Promise<void>((resolve, reject) => {
      execFile(bin, args, options, (err: Error | null) => (err ? reject(err) : resolve()));
    });
    if (!estado.semChild) {
      const stdin = { on: vi.fn(), end: vi.fn() };
      stdins.push(stdin);
      (p as Promise<void> & { child?: { stdin: typeof stdin } }).child = { stdin };
    }
    return p;
  };
  return {
    execFile,
    existsSync: vi.fn(() => true),
    readFile: vi.fn(),
    mkdir: vi.fn(async () => {}),
    stdins,
    estado,
  };
});

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

// sintetizarPassos exige uuid (defesa de path traversal): os testes usam um id válido.
const ID = '3f2b7c1a-9d4e-4a6b-8c3f-1e2d5a6b7c8d';

beforeEach(() => {
  execFile.mockReset();
  readFile.mockReset();
  mkdir.mockClear();
  stdins.length = 0;
  estado.semChild = false;
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
    const r = await sintetizarPassos(ID, [{ ordem: 1, narracao: 'oi' }]);
    expect(r).toEqual([{ ordem: 1, caminho: '', duracao_ms: null }]);
    expect(execFile).not.toHaveBeenCalled();
  });

  it('chama o Piper uma vez por passo e devolve a duração lida do WAV', async () => {
    sucesso();
    const r = await sintetizarPassos(ID, [
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
    const r = await sintetizarPassos(ID, [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(r[0].duracao_ms).toBeNull();
    expect(r[0].caminho).toBe('');
    expect(r[1].duracao_ms).toBe(2000);
    expect(r[1].caminho).toContain(path.join('2.wav'));
  });

  it('escreve a narração no stdin do processo do Piper (execFile não tem opção input)', async () => {
    sucesso();
    await sintetizarPassos(ID, [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(stdins).toHaveLength(2);
    expect(stdins[0].end).toHaveBeenCalledWith('primeiro');
    expect(stdins[1].end).toHaveBeenCalledWith('segundo');
    // o guard de erro do stdin precisa estar registrado antes do end
    expect(stdins[0].on).toHaveBeenCalledWith('error', expect.any(Function));
  });

  it('child sem stdin degrada o passo em vez de esperar o timeout do Piper', async () => {
    sucesso();
    estado.semChild = true;
    const r = await sintetizarPassos(ID, [{ ordem: 1, narracao: 'primeiro' }]);
    expect(r).toEqual([{ ordem: 1, caminho: '', duracao_ms: null }]);
    // o passo falhou antes de escrever: nenhum stdin foi exposto ao chamador
    expect(stdins).toHaveLength(0);
  });

  it('deverId que não é uuid não monta caminho fora de uploads/deveres', async () => {
    sucesso();
    const r = await sintetizarPassos('../../etc/passwd', [
      { ordem: 1, narracao: 'primeiro' },
      { ordem: 2, narracao: 'segundo' },
    ]);
    expect(r).toEqual([
      { ordem: 1, caminho: '', duracao_ms: null },
      { ordem: 2, caminho: '', duracao_ms: null },
    ]);
    // nada foi executado nem criado fora da pasta do dever
    expect(execFile).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
  });

  it('WAV ilegível deixa o passo com caminho preenchido e duracao_ms null', async () => {
    sucesso();
    // bytes que não são um RIFF/WAVE válido: duracaoMsDoWav devolve null
    readFile.mockResolvedValue(Buffer.from('não é um wav'));
    const r = await sintetizarPassos(ID, [{ ordem: 1, narracao: 'primeiro' }]);
    expect(r[0].caminho).toContain(path.join('1.wav'));
    expect(r[0].duracao_ms).toBeNull();
  });
});
