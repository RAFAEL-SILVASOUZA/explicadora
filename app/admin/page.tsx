'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Copy } from 'lucide-react';
import Header from '@/components/Header';
import { apiFetch, lerToken } from '@/lib/client/api';
import { formatarPreco } from '@/lib/client/format';
import { Plano } from '@/lib/types';

interface TokenRow {
  codigo: string;
  plano_codigo: string;
  status: 'disponivel' | 'resgatado' | 'expirado';
  expira_em: string;
  resgatado_por_email: string | null;
}

const STATUS_ESTILO: Record<TokenRow['status'], string> = {
  disponivel: 'bg-success-light text-success',
  resgatado: 'bg-primary-light text-primary-dark',
  expirado: 'bg-danger-light text-danger',
};

const STATUS_TEXTO: Record<TokenRow['status'], string> = {
  disponivel: 'Disponível',
  resgatado: 'Resgatado',
  expirado: 'Expirado',
};

export default function Admin() {
  const router = useRouter();
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [plano, setPlano] = useState('pro');
  const [quantidade, setQuantidade] = useState(10);
  const [dias, setDias] = useState(30);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [gerando, setGerando] = useState(false);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    apiFetch('/api/conta')
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!data?.conta) return;
        // Admin entra direto na área admin; conta comum volta para a home.
        if (data.conta.role !== 'admin') router.replace('/');
      })
      .catch(() => {});
  }, [router]);

  const carregar = useCallback(() => {
    apiFetch('/api/admin/tokens').then(async (res) => {
      if (res.status === 403) {
        setErro('Essa área é só do administrador.');
        return;
      }
      if (!res.ok) return;
      setErro('');
      setTokens(await res.json());
    }).catch(() => {});
    apiFetch('/api/planos').then(async (res) => {
      if (!res.ok) return;
      setPlanos(await res.json());
    }).catch(() => {});
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    if (gerando) return;
    setGerando(true);
    setErro('');
    setAviso('');
    try {
      const res = await apiFetch('/api/admin/tokens', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plano_codigo: plano, quantidade, expira_em_dias: dias }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Não foi possível gerar o lote.');
        setGerando(false);
        return;
      }
      setAviso(`${data.lote} códigos de ${plano} gerados.`);
      await carregar();
    } catch {
      setErro('Não foi possível gerar o lote. Verifique sua conexão.');
    } finally {
      setGerando(false);
    }
  }

  async function copiar(codigo: string) {
    try {
      await navigator.clipboard.writeText(codigo);
      setAviso(`Código ${codigo} copiado.`);
    } catch {
      setErro('Não foi possível copiar. Selecione o código manualmente.');
    }
  }

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
          <ShieldCheck size={28} aria-hidden="true" /> Área do administrador
        </h1>

        <section className="card" aria-labelledby="lote-titulo">
          <h2 id="lote-titulo" className="text-xl font-extrabold text-ink mb-4">Gerar lote de códigos</h2>
          <form onSubmit={gerar} className="flex flex-wrap gap-3 items-end" noValidate>
            <div>
              <label htmlFor="plano" className="block text-sm font-semibold mb-1">Plano</label>
              <select id="plano" value={plano} onChange={(e) => setPlano(e.target.value)}
                className="input !w-auto">
                {planos.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.nome} ({p.revisoes} revisões · {formatarPreco(p.preco_cents)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="quantidade" className="block text-sm font-semibold mb-1">Quantidade</label>
              <input id="quantidade" type="number" min="1" max="100" value={quantidade}
                onChange={(e) => setQuantidade(Number(e.target.value))}
                className="input !w-28" />
            </div>
            <div>
              <label htmlFor="dias" className="block text-sm font-semibold mb-1">Validade (dias)</label>
              <input id="dias" type="number" min="1" max="365" value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                className="input !w-28" />
            </div>
            <button type="submit" disabled={gerando} className="btn-primary !w-auto !text-lg !py-3">
              {gerando && <Loader2 size={20} className="animate-spin" aria-hidden="true" />}
              {gerando ? 'Gerando...' : 'Gerar lote'}
            </button>
          </form>

          {erro && (
            <div role="alert" className="mt-4 bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger font-semibold">
              {erro}
            </div>
          )}
          {aviso && (
            <div role="status" className="mt-4 bg-success-light border-2 border-success/40 rounded-2xl p-4 text-success font-semibold">
              {aviso}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="tokens-titulo">
          <h2 id="tokens-titulo" className="text-xl font-extrabold text-ink mb-4">
            Códigos gerados ({tokens.length})
          </h2>
          {tokens.length === 0 ? (
            <p className="text-ink/70">Nenhum código gerado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-ink/60 text-sm">
                    <th className="pb-2">Código</th>
                    <th className="pb-2">Plano</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Validade</th>
                    <th className="pb-2">Resgatado por</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.codigo} className="border-t border-gray-100">
                      <td className="py-2 font-mono flex items-center gap-2">
                        {t.codigo}
                        <button type="button" onClick={() => copiar(t.codigo)}
                          aria-label={`Copiar código ${t.codigo}`}
                          className="p-2 rounded-lg hover:bg-primary-light text-primary">
                          <Copy size={16} aria-hidden="true" />
                        </button>
                      </td>
                      <td className="py-2">{t.plano_codigo}</td>
                      <td className="py-2">
                        <span className={`badge ${STATUS_ESTILO[t.status]}`}>{STATUS_TEXTO[t.status]}</span>
                      </td>
                      <td className="py-2">{new Date(t.expira_em).toLocaleDateString('pt-BR')}</td>
                      <td className="py-2">{t.resgatado_por_email ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-ink/70">
          <Link href="/" className="font-bold text-primary hover:text-primary-dark">Voltar para a home</Link>
        </p>
      </main>
    </>
  );
}
