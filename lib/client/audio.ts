import { apiFetch } from './api';

// O elemento <audio> não envia cabeçalho Authorization. A única forma de manter a
// rota autenticada é baixar o WAV via apiFetch e tocar pela object URL.
export async function carregarAudioDever(deverId: string, ordem: number): Promise<string | null> {
  try {
    const res = await apiFetch(`/api/dever/${deverId}/audio/${ordem}`);
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob());
  } catch {
    return null;
  }
}
