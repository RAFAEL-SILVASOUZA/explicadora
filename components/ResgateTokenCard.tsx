'use client';

import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { notificarSaldo } from '@/lib/client/saldo';

interface ResgateResultado {
  plano: string;
  revisoes: number;
  novoSaldo: number;
}

export default function ResgateTokenCard({ onResgate }: { onResgate?: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState<ResgateResultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function resgatar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro('');
    setOk(null);
    try {
      const res = await apiFetch('/api/tokens/resgate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ codigo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Não foi possível resgatar o código.');
        setEnviando(false);
        return;
      }
      setOk(data);
      setCodigo('');
      notificarSaldo();
      onResgate?.();
    } catch {
      setErro('Não foi possível resgatar o código. Verifique sua conexão.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card" aria-labelledby="resgate-titulo">
      <h2 id="resgate-titulo" className="text-2xl font-extrabold text-primary mb-2 flex items-center gap-2">
        <KeyRound size={24} aria-hidden="true" /> Resgatar o código do pacote
      </h2>
      <p className="text-ink/70 mb-4">
        Você contratou um pacote, recebeu um código (ex. <span className="font-mono">PRO-7K4M-9XQ2</span>) e cola aqui.
        O código soma as revisões do pacote ao seu saldo. Cada código vale uma única vez.
      </p>

      <form onSubmit={resgatar} className="space-y-3" noValidate>
        <label htmlFor="codigo" className="block text-lg font-semibold">Código do pacote</label>
        <input id="codigo" name="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)}
          placeholder="PRO-XXXX-XXXX" autoComplete="off" spellCheck={false}
          className="input font-mono uppercase" />
        <button type="submit" disabled={enviando || !codigo.trim()} className="btn-primary">
          {enviando ? <Loader2 size={22} className="animate-spin" aria-hidden="true" /> : <KeyRound size={22} aria-hidden="true" />}
          {enviando ? 'Resgatando...' : 'Resgatar código'}
        </button>
      </form>

      {erro && (
        <div role="alert" className="mt-4 bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger font-semibold">
          {erro}
        </div>
      )}

      {ok && (
        <div role="status" className="mt-4 bg-success-light border-2 border-success/40 rounded-2xl p-4 text-success font-semibold">
          Pacote {ok.plano} resgatado: +{ok.revisoes} revisões. Novo saldo: {ok.novoSaldo}.
        </div>
      )}
    </section>
  );
}
