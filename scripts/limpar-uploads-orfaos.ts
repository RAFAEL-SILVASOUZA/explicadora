import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getPool } from '../lib/db/pool';

// O sistema de arquivos não entra na transação do Postgres. Se a criação do dever
// falhar depois da síntese, sobra pasta de WAV sem dono. Isto a remove.
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

  for (const pasta of orfas) {
    await fs.rm(path.join(raiz, pasta), { recursive: true, force: true });
    console.log(`Removida pasta órfã: ${pasta}`);
  }
  console.log(orfas.length ? `${orfas.length} pasta(s) removida(s).` : 'Nenhuma pasta órfã.');
}

if (process.argv[1] && process.argv[1].endsWith('limpar-uploads-orfaos.ts')) {
  main()
    .then(() => process.exit(0))
    .catch((err) => { console.error(err); process.exit(1); });
}
