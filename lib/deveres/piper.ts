import { execFile } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { duracaoMsDoWav } from './wav';

const executar = promisify(execFile);

export interface AudioPasso {
  ordem: number;
  caminho: string;
  duracao_ms: number | null;
}

// O id do dever vem do banco (uuid), mas o caminho é montado a partir dele: um id
// forjado ('../../etc') escreveria fora de uploads/deveres/. Validar antes de
// montar qualquer caminho (defesa em profundidade, o custo é uma regex).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Relativo a process.cwd(), o mesmo critério de uploads/ em app/api/revisao/route.ts.
// Fica fora de public/ de propósito: public/ é servido sem autenticação.
// A validação do deverId acontece em sintetizarPassos, antes de montar o caminho.
export function caminhoDoAudio(deverId: string, ordem: number): string {
  return path.join('uploads', 'deveres', deverId, `${ordem}.wav`);
}

export function piperDisponivel(): boolean {
  const bin = process.env.PIPER_BIN;
  const modelo = process.env.PIPER_MODEL;
  if (!bin || !modelo) return false;
  return existsSync(bin) && existsSync(modelo);
}

// Piper escreve no CWD quando --output_file é relativo: usar caminho absoluto.
// execFile não tem opção `input` (é de execSync/spawnSync): a narração entra
// pelo stdin do processo, que é como o CLI do Piper recebe o texto.
async function sintetizarUm(narracao: string, destinoAbsoluto: string): Promise<void> {
  const p = executar(process.env.PIPER_BIN as string, [
    '--model', process.env.PIPER_MODEL as string,
    '--output_file', destinoAbsoluto,
  ], { timeout: 60_000, maxBuffer: 16 * 1024 * 1024 });
  // Engolir EPIPE do stdin não mascara nada: a falha do Piper chega pela rejeição
  // da promessa (código de saída != 0). Mas child/stdin ausentes não podem ser
  // tolerados com ?.: o Piper esperaria texto no stdin até o timeout de 60s em
  // silêncio. Sem stdin o passo é tratado como falha (cai no catch do chamador).
  const stdin = p.child?.stdin;
  if (!stdin) {
    throw new Error('Piper: processo filho sem stdin disponível (falha ao iniciar)');
  }
  stdin.on('error', () => {});
  stdin.end(narracao);
  await p;
}

// Áudio é gerado na criação, uma vez (spec §3.3): a animação usa a duração real e
// o replay é instantâneo. Piper ausente não bloqueia a feature: o passo fica sem
// áudio e o cliente cai no fallback de duração por palavras.
export async function sintetizarPassos(
  deverId: string,
  passos: { ordem: number; narracao: string }[],
): Promise<AudioPasso[]> {
  if (!piperDisponivel()) {
    console.warn('[deveres] Piper não configurado (PIPER_BIN/PIPER_MODEL): dever criado sem áudio.');
    return passos.map((p) => ({ ordem: p.ordem, caminho: '', duracao_ms: null }));
  }

  if (!UUID_RE.test(deverId)) {
    // deverId fora do formato uuid: não montar caminho (risco de path traversal).
    // Todos os passos ficam sem áudio, como na degradação por passo.
    console.error(`[deveres] deverId inválido (não é uuid): nenhum áudio gerado.`);
    return passos.map((p) => ({ ordem: p.ordem, caminho: '', duracao_ms: null }));
  }

  const pasta = path.join(process.cwd(), 'uploads', 'deveres', deverId);
  await fs.mkdir(pasta, { recursive: true });

  const resultados: AudioPasso[] = [];
  for (const passo of passos) {
    const relativo = caminhoDoAudio(deverId, passo.ordem);
    const absoluto = path.join(process.cwd(), relativo);
    try {
      await sintetizarUm(passo.narracao, absoluto);
      const wav = await fs.readFile(absoluto);
      resultados.push({ ordem: passo.ordem, caminho: relativo, duracao_ms: duracaoMsDoWav(wav) });
    } catch (err) {
      // caminho '' marca o passo como sem áudio: a rota grava audio_path nulo e o
      // cliente cai no fallback de duração por palavras. Um passo sem voz não
      // invalida o dever inteiro.
      console.error(`[deveres] áudio do passo ${passo.ordem} falhou:`, (err as Error).message);
      resultados.push({ ordem: passo.ordem, caminho: '', duracao_ms: null });
    }
  }
  return resultados;
}
