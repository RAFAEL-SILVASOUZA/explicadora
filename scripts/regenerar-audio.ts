import { getPool } from '../lib/db/pool';
import { getPassos } from '../lib/repos/deveres';
import { piperDisponivel, sintetizarPassos } from '../lib/deveres/piper';

// Regenera o áudio de um dever JÁ existente. A síntese acontece na criação
// (spec §3.3), então um dever criado sem Piper fica mudo para sempre: isto fecha
// essa lacuna sem gastar crédito, porque a narração já está em dever_passos.
// Idempotente: re-sintetiza e sobrescreve audio_path/duracao_ms.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function main(): Promise<void> {
  const deverId = process.argv[2];
  if (!deverId) {
    console.error('Uso: npm run regenerar-audio -- <deverId>');
    process.exit(1);
  }
  if (!UUID_RE.test(deverId)) {
    console.error('deverId precisa ser um uuid.');
    process.exit(1);
  }
  if (!piperDisponivel()) {
    console.error('Piper indisponível: defina PIPER_BIN e PIPER_MODEL no .env.');
    process.exit(1);
  }

  const pool = getPool();
  try {
    const { rows } = await pool.query('SELECT id, titulo FROM deveres WHERE id = $1', [deverId]);
    if (!rows.length) {
      console.error(`Dever ${deverId} não existe no banco.`);
      process.exit(1);
    }
    console.log(`Dever: ${rows[0].titulo ?? '(sem título)'}`);

    const passos = await getPassos(deverId);
    if (!passos.length) {
      console.error('Dever sem passos: nada a sintetizar.');
      process.exit(1);
    }

    const audio = await sintetizarPassos(
      deverId,
      passos.map((p) => ({ ordem: p.ordem, narracao: p.narracao })),
    );

    let comAudio = 0;
    for (const a of audio) {
      await pool.query(
        `UPDATE dever_passos SET audio_path = $1, duracao_ms = $2
         WHERE dever_id = $3 AND ordem = $4`,
        [a.caminho || null, a.duracao_ms, deverId, a.ordem],
      );
      if (a.caminho) comAudio += 1;
      console.log(`Passo ${a.ordem}: ${a.caminho || 'SEM ÁUDIO'} (${a.duracao_ms ?? '?'} ms)`);
    }
    console.log(`${comAudio}/${audio.length} passo(s) com áudio.`);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('regenerar-audio.ts')) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
