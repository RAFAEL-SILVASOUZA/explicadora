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

  it('avança corretamente sobre chunk de tamanho ímpar (padding para par)', () => {
    // chunk NOTE com size 7 (ímpar) + 1 byte de padding = 16 bytes no total.
    const base = wavMono(8000, 1, 8, 8000);
    const chunk = Buffer.alloc(16);
    chunk.write('NOTE', 0);
    chunk.writeUInt32LE(7, 4);
    chunk.write('abcdefg', 8); // 7 bytes de payload; o 16º byte é padding zero
    const comChunk = Buffer.concat([base.subarray(0, 36), chunk, base.subarray(36)]);
    expect(duracaoMsDoWav(comChunk)).toBe(1000);
  });

  it('lê fmt depois de data (ordem arbitrária de chunks)', () => {
    const cabecalho = Buffer.alloc(12);
    cabecalho.write('RIFF', 0);
    cabecalho.writeUInt32LE(8 + 8000 + 8 + 16, 4);
    cabecalho.write('WAVE', 8);
    const data = Buffer.alloc(8 + 8000);
    data.write('data', 0);
    data.writeUInt32LE(8000, 4);
    data.fill(0x80, 8);
    const fmt = Buffer.alloc(8 + 16);
    fmt.write('fmt ', 0);
    fmt.writeUInt32LE(16, 4);
    fmt.writeUInt16LE(1, 8); // PCM
    fmt.writeUInt16LE(1, 10); // canais
    fmt.writeUInt32LE(8000, 12); // sampleRate
    fmt.writeUInt32LE(8000, 16); // byteRate
    fmt.writeUInt16LE(1, 20); // blockAlign
    fmt.writeUInt16LE(8, 22); // bits
    const wav = Buffer.concat([cabecalho, data, fmt]);
    expect(duracaoMsDoWav(wav)).toBe(1000);
  });

  it('devolve null (sem lançar) quando fmt é truncado no fim do buffer', () => {
    // Reprodução do revisor: LIST size 20 empurra fmt para o offset 40 de um
    // buffer de 48 bytes; ler byteRate em pos+16 leria fora do buffer.
    const b = Buffer.alloc(48);
    b.write('RIFF', 0);
    b.writeUInt32LE(44, 4);
    b.write('WAVE', 8);
    b.write('LIST', 12);
    b.writeUInt32LE(20, 16);
    b.write('fmt ', 40);
    b.writeUInt32LE(16, 44);
    expect(duracaoMsDoWav(b)).toBeNull();
  });

  it('limita dataSize ao buffer real quando o cabeçalho mente (WAV truncado)', () => {
    // Cabeçalho de 44 bytes declarando 1.000.000 bytes de data, sem payload.
    const b = Buffer.alloc(44);
    b.write('RIFF', 0);
    b.writeUInt32LE(36 + 1_000_000, 4);
    b.write('WAVE', 8);
    b.write('fmt ', 12);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(8000, 24);
    b.writeUInt32LE(8000, 28); // byteRate
    b.writeUInt16LE(1, 32);
    b.writeUInt16LE(8, 34);
    b.write('data', 36);
    b.writeUInt32LE(1_000_000, 40);
    expect(duracaoMsDoWav(b)).toBe(0);
  });

  it('limita dataSize ao buffer real em truncamento parcial', () => {
    // Cabeçalho diz 16000 bytes (2 s) mas só há 8000 bytes de payload (1 s).
    const completo = wavMono(8000, 1, 8, 16000);
    const truncado = completo.subarray(0, 44 + 8000);
    expect(duracaoMsDoWav(truncado)).toBe(1000);
  });

  it('arredonda a duração quando a divisão tem resto', () => {
    // 1005 bytes / byteRate 8000 = 125,625 ms → Math.round → 126.
    expect(duracaoMsDoWav(wavMono(8000, 1, 8, 1005))).toBe(126);
  });
});
