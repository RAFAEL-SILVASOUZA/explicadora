// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { MIME_POR_TIPO, detectarTipo } from '../../lib/uploads/tipos';
import { JPEG_MINIMO, PDF_FAKE, PNG_1X1, WEBP_MINIMO, EXECUTAVEL_DISFARCADO } from '../fixtures/arquivos';

describe('detectarTipo', () => {
  test('reconhece os quatro tipos pelo conteúdo', () => {
    expect(detectarTipo(PNG_1X1)).toBe('png');
    expect(detectarTipo(JPEG_MINIMO)).toBe('jpg');
    expect(detectarTipo(WEBP_MINIMO)).toBe('webp');
    expect(detectarTipo(PDF_FAKE)).toBe('pdf');
  });

  // O teste que discrimina a defesa: um binário qualquer renomeado para .png é
  // recusado. Se a extensão mandasse, isto retornaria 'png'.
  test('recusa executável disfarçado de PNG', () => {
    expect(detectarTipo(EXECUTAVEL_DISFARCADO)).toBeNull();
  });

  test('recusa buffer vazio e curto demais', () => {
    expect(detectarTipo(Buffer.alloc(0))).toBeNull();
    expect(detectarTipo(Buffer.from([0x89, 0x50]))).toBeNull();
  });

  test('mime declarado bate com o tipo detectado', () => {
    expect(MIME_POR_TIPO[detectarTipo(PNG_1X1)!]).toBe('image/png');
    expect(MIME_POR_TIPO.pdf).toBe('application/pdf');
  });
});
