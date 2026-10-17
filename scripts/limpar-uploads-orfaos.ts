import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPool } from '../lib/db/pool';

// O sistema de arquivos não entra na transação do Postgres. Se a criação do dever
// falhar depois da síntese, sobra pasta de WAV sem dono. Isto a remove.
//
// Guarda de idade: em POST /api/dever a linha do dever é inserida dentro da
// transação, mas o commit só acontece depois de sintetizarPassos (dezenas de
// segundos de latência do Piper). Sob READ COMMITTED, o SELECT id FROM deveres
// deste script, em outra conexão, não vê a linha ainda não-commiteada: a pasta
// de WAV de um dever VIVO (ainda em criação) pareceria órfã. Por isso pastas
// modificadas nos últimos IDADE_MINIMA_MS são puladas, o que cobre a janela
// entre síntese e commit sem mudar o contrato do operador.
const IDADE_MINIMA_MS = 10 * 60 * 1000;

export function pastasOrfas(pastasNoDisco: string[], idsNoBanco: string[]): string[] {
  const vivos = new Set(idsNoBanco);
  return pastasNoDisco.filter((p) => !vivos.has(p));
}

async function main(): Promise<void> {
  const raiz = path.join(process.cwd(), 'uploads', 'deveres');
  let pastas: string[] = [];
  try {
    pastas = (await fs.readdir(raiz, { withFileTypes: true }))
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    console.log('Sem uploads/deveres: nada a limpar.');
    return;
  }

  const { rows } = await getPool().query('SELECT id::text AS id FROM deveres');
  const vivos = rows.map((r) => r.id as string);
  const orfas = pastasOrfas(pastas, vivos);

  let removidas = 0;
  for (const pasta of orfas) {
    const caminho = path.join(raiz, pasta);
    const stat = await fs.stat(caminho);
    if (Date.now() - stat.mtimeMs < IDADE_MINIMA_MS) {
      console.log(`Pulada (recente): ${pasta}`);
      continue;
    }
    await fs.rm(caminho, { recursive: true, force: true });
    removidas += 1;
    console.log(`Removida pasta órfã: ${pasta}`);
  }
  console.log(removidas ? `${removidas} pasta(s) removida(s).` : 'Nenhuma pasta órfã.');
}

if (process.argv[1] && process.argv[1].endsWith('limpar-uploads-orfaos.ts')) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
