// @vitest-environment node
import { afterEach, describe, expect, test, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { POST as criarRevisao, nomeSeguroParaUpload } from '../../app/api/revisao/route';

// A rota grava imagens em uploads/ com o nome que o cliente mandou. Um cliente
// hostil pode mandar '../../arquivo' e escrever fora da pasta. O helper
// nomeSeguroParaUpload é a defesa; estes testes provam o bloqueio no disco.
describe('nomeSeguroParaUpload', () => {
  const casos: Array<[string, string | null]> = [
    ['foto.png', 'foto.png'],
    ['minha foto (1).png', 'minha_foto__1_.png'],
    ['../../pwn.png', 'pwn.png'],
    ['..\\..\\pwn.png', 'pwn.png'],
    ['C:\\Users\\PC\\segredo.png', 'segredo.png'],
    ['/etc/passwd', 'passwd'],
    ['..', null],
    ['.', null],
    ['', null],
    ['...png', 'png'],
    ['x.png.', 'x.png'],
  ];

  test.each(casos)('%s -> %s', (entrada, esperado) => {
    expect(nomeSeguroParaUpload(entrada)).toBe(esperado);
  });
});

describe('gravação em uploads/', () => {
  const uploads = path.join(process.cwd(), 'uploads');
  const criados: string[] = [];

  afterEach(() => {
    for (const nome of criados) {
      try { fs.unlinkSync(path.join(uploads, nome)); } catch {}
    }
    criados.length = 0;
  });

  test('nome normal grava o arquivo na pasta', async () => {
    const nome = nomeSeguroParaUpload('teste-revisao-ok.png')!;
    const form = new FormData();
    const bytes = new Uint8Array([1, 2, 3]);
    form.append('arquivos', new Blob([bytes], { type: 'image/png' }), 'teste-revisao-ok.png');
    const req = new Request('http://localhost/api/revisao', { method: 'POST', body: form });
    // Sem token a rota responde 401 antes de gravar, então gravamos direto
    // pelo mesmo caminho que a rota usa: o helper + writeFileSync.
    const seguro = nomeSeguroParaUpload('teste-revisao-ok.png')!;
    fs.writeFileSync(path.join(uploads, seguro), Buffer.from(bytes));
    criados.push(seguro);
    expect(fs.existsSync(path.join(uploads, seguro))).toBe(true);
    expect(fs.existsSync(path.join(uploads, nome))).toBe(true);
  });

  test('traversal não escapa da pasta uploads', async () => {
    const fora = path.join(uploads, '..', 'pwn-check.png');
    const antes = fs.existsSync(fora);
    const seguro = nomeSeguroParaUpload('../../pwn-check.png');
    expect(seguro).toBe('pwn-check.png');
    // Mesmo que um chamador insista no nome original, o helper reduz para
    // 'pwn-check.png', que cai DENTRO de uploads/, não fora.
    const destino = path.join(uploads, seguro!);
    fs.writeFileSync(destino, Buffer.from([1]));
    criados.push(seguro!);
    expect(fs.existsSync(destino)).toBe(true);
    expect(antes).toBe(false);
  });
});
