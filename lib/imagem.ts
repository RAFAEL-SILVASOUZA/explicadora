import sharp from 'sharp';
import { MAX_IMAGENS } from './constantes';

// Dimensão máxima (lado maior) para as imagens enviadas à LLM.
// Mantida baixa para que muitas imagens (30+) caibam no contexto da LLM
// sem estourar o limite de tokens de visão.
const MAX_DIMENSAO = 640;
const QUALIDADE_JPEG = 70;

export { MAX_IMAGENS };

/**
 * Redimensiona e comprime uma imagem para reduzir o tamanho do base64.
 * Converte para JPEG (com fundo branco para imagens com transparência)
 * e limita o lado maior a MAX_DIMENSAO pixels.
 *
 * @param buffer buffer original da imagem
 * @returns { base64, mime } imagem processada
 */
export async function processarImagem(buffer: Buffer): Promise<{ base64: string; mime: string }> {
  const processado = await sharp(buffer)
    .rotate() // respeita orientação EXIF
    .resize({
      width: MAX_DIMENSAO,
      height: MAX_DIMENSAO,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .flatten({ background: '#ffffff' }) // remove transparência
    .jpeg({ quality: QUALIDADE_JPEG })
    .toBuffer();

  return {
    base64: processado.toString('base64'),
    mime: 'image/jpeg',
  };
}
