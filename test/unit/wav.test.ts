import { describe, expect, it } from 'vitest';
import { duracaoMsDoWav } from '@/lib/deveres/wav';

// WAV mono 8000 Hz, 8 bits: byteRate 8000. 16000 bytes de dados = 2 s.
function wavMono(sampleRate: number, canais: number, bits: number, bytesDeDados: number): Buffer {
  const byteRate = (sampleRate * canais * bits) / 8;
  const cabecalho = Buffer.alloc(44);
  cabecalho.write('RIFF', 0);
  cabecalho.writeUInt32LE(36 + bytesDeDados, 4);
  cabecalho.write('WAVE', 8);
  cabecalho.write('fmt ', 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);            // PCM
  cabecalho.writeUInt16LE(canais, 22);
  cabecalho.writeUInt32LE(sampleRate, 24);
  cabecalho.writeUInt32LE(byteRate, 28);
  cabecalho.writeUInt16LE((canais * bits) / 8, 32);
  cabecalho.writeUInt16LE(bits, 34);
  cabecalho.write('data', 36);
  cabecalho.writeUInt32LE(bytesDeDados, 40);
  return Buffer.concat([cabecalho, Buffer.alloc(bytesDeDados, 0x80)]);
}

describe('duracaoMsDoWav', () => {
  it('calcula a duração de um WAV mono', () => {
    expect(duracaoMsDoWav(wavMono(8000, 1, 8, 16000))).toBe(2000);
  });

  it('calcula a duração de um WAV estéreo 22050 Hz 16 bits', () => {
    const byteRate = 22050 * 2 * 2; // 88200
    expect(duracaoMsDoWav(wavMono(22050, 2, 16, byteRate))).toBe(1000);
  });

  it('devolve null para buffer que não é WAV', () => {
    expect(duracaoMsDoWav(Buffer.from('não é um wav'))).toBeNull();
  });

  it('devolve null para buffer curto demais', () => {
    expect(duracaoMsDoWav(Buffer.alloc(10))).toBeNull();
  });

  it('ignora chunks extras antes de data', () => {
    const base = wavMono(8000, 1, 8, 8000);
    const chunk = Buffer.alloc(16);
    chunk.write('LIST', 0);
    chunk.writeUInt32LE(8, 4);
    chunk.write('INFO', 8);
    const comChunk = Buffer.concat([base.subarray(0, 36), chunk, base.subarray(36)]);
    expect(duracaoMsDoWav(comChunk)).toBe(1000);
  });
});
