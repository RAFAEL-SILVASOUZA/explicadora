// Tipo real do arquivo, decidido pelo conteúdo (magic number), não pela extensão que
// o navegador recebeu. Um cliente hostil pode renomear qualquer binário para '.png';
// se a extensão mandasse, gravaríamos lixo (ou um executável) como imagem e o
// sharp/extrator receberia bytes inesperados.
//
// A extensão GRAVADA vem daqui, nunca do nome do cliente: o caminho em disco é sempre
// '<uuid>.<ext-saneada>', então traversal por nome é impossível por construção.

export type TipoArquivo = 'png' | 'jpg' | 'webp' | 'pdf';

export const MIME_POR_TIPO: Record<TipoArquivo, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
};

// Cabeçalhos mínimos conhecidos: PNG assinado (\x89PNG\r\n\x1a\n), JPEG (FF D8 FF),
// WEBP (RIFF<??>WEBP, os dois bytes do tamanho entre eles variam) e PDF (%PDF).
export function detectarTipo(buffer: Buffer): TipoArquivo | null {
  if (buffer.length >= 8
    && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (buffer.length >= 12
    && buffer.toString('latin1', 0, 4) === 'RIFF'
    && buffer.toString('latin1', 8, 12) === 'WEBP') {
    return 'webp';
  }
  if (buffer.length >= 4 && buffer.toString('latin1', 0, 4) === '%PDF') {
    return 'pdf';
  }
  return null;
}
