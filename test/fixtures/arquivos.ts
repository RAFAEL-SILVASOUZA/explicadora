// Bytes reais de cada tipo aceito, para os testes de biblioteca provarem a detecção
// por conteúdo com arquivos que passam pelos processadores de verdade (o PNG abaixo é
// um 1x1 válido, lido pelo sharp). Mora num módulo próprio porque a suíte unit e a
// suíte db precisam dos mesmos bytes: importar de um arquivo de teste faria aquele
// arquivo rodar duas vezes.
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const JPEG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

export const WEBP_MINIMO = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x10, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);

export const PDF_FAKE = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n', 'latin1');

// Binário qualquer: o caso que discrimina a detecção por conteúdo. Renomeado para
// .png, teria de ser recusado.
export const EXECUTAVEL_DISFARCADO = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0x41)]);
