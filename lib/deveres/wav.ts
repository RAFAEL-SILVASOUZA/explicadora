// Lê o cabeçalho RIFF para obter a duração real do áudio. A duração real é o que
// sincroniza o desenho com a voz; estimar por palavras só no fallback.
export function duracaoMsDoWav(buffer: Buffer): number | null {
  if (buffer.length < 44) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return null;

  let byteRate: number | null = null;
  let dataSize: number | null = null;

  // Chunks têm tamanho variável e podem vir em qualquer ordem (Piper emite
  // "LIST" antes de "data"). Percorrer em vez de assumir offset fixo.
  let pos = 12;
  while (pos + 8 <= buffer.length) {
    const id = buffer.toString('ascii', pos, pos + 4);
    const size = buffer.readUInt32LE(pos + 4);
    if (id === 'fmt ') {
      // fmt: formato(2) canais(2) amostragem(4) byteRate(4) → byteRate em pos+16.
      // Só ler quando o chunk tem tamanho e espaço no buffer; fmt truncado leva
      // a byteRate continuar null (retorno null), nunca a RangeError.
      if (size >= 16 && pos + 20 <= buffer.length) {
        byteRate = buffer.readUInt32LE(pos + 16);
      }
    }
    if (id === 'data') {
      // Confiar no cabeçalho cega o parser para WAV truncado: limitar ao que o
      // buffer realmente contém (-8 desconta o cabeçalho do próprio chunk data).
      dataSize = Math.min(size, buffer.length - pos - 8);
    }
    // Chunks têm padding para par.
    pos += 8 + size + (size % 2);
  }

  if (!byteRate || dataSize === null) return null;
  return Math.round((dataSize / byteRate) * 1000);
}
