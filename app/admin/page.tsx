'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Copy, Search, Trash2, Undo2 } from 'lucide-react';
import Header from '@/components/Header';
import { apiFetch, lerToken } from '@/lib/client/api';
import { formatarPreco } from '@/lib/client/format';
import { Plano } from '@/lib/types';

interface TokenRow {
  id: string;
  codigo: string;
  plano_codigo: string;
  status: 'disponivel' | 'resgatado' | 'expirado' | 'revogado';
  expira_em: string;
  resgatado_por_email: string | null;
  usados: number;
}

const STATUS_ESTILO: Record<TokenRow['status'], string> = {
  disponivel: 'bg-success-light text-success-ink',
  resgatado: 'bg-primary-light text-primary-dark',
  expirado: 'bg-danger-light text-danger-ink',
  revogado: 'bg-ink/10 text-ink/70',
};

const STATUS_TEXTO: Record<TokenRow['status'], string> = {
  disponivel: 'Disponível',
  resgatado: 'Resgatado',
  expirado: 'Expirado',
  revogado: 'Revogado',
};

// O mesmo limite da rota (`LIMITE_DE_USO_PARA_REVOGAR`, em lib/repos/tokens.ts). O ícone só
// aparece quando a ação é possível, para o admin não clicar em algo que seria recusado.
const LIMITE_DE_USO = 2;

type Acao = 'revogar' | 'excluir';

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
  const [busca, setBusca] = useState('');
  const [pendente, setPendente] = useState<{ codigo: string; acao: Acao } | null>(null);
  const [executando, setExecutando] = useState(false);

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

  async function executar(t: TokenRow, acao: Acao) {
    if (executando) return;
    setExecutando(true);
    setErro('');
    try {
      const res = await apiFetch(`/api/admin/tokens/${t.id}`, {
        method: acao === 'revogar' ? 'POST' : 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? `Não foi possível ${acao === 'revogar' ? 'revogar' : 'excluir'} o código.`);
        return;
      }
      setAviso(acao === 'revogar'
        ? `Código ${t.codigo} revogado. ${data.estornado} revisões voltaram para o saldo de ${t.resgatado_por_email}.`
        : `Código ${t.codigo} excluído.`);
      setPendente(null);
      await carregar();
    } catch {
      setErro('Não foi possível concluir. Verifique sua conexão.');
    } finally {
      setExecutando(false);
    }
  }

  // Busca incremental: filtra o que já está em tela, a cada tecla, sem recarregar a lista.
  const filtrados = tokens.filter((t) => {
    const q = busca.trim().toLowerCase();
    if (!q) return true;
    return t.codigo.toLowerCase().includes(q)
      || t.plano_codigo.toLowerCase().includes(q)
      || (t.resgatado_por_email ?? '').toLowerCase().includes(q);
  });

  // O Free não gera códigos: ele é a concessão do cadastro, não um pacote que se entrega.
  const planosComCodigo = planos.filter((p) => p.codigo !== 'free');

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
                {planosComCodigo.map((p) => (
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
          <p className="mt-3 text-sm text-ink/60">
            O plano Free não gera códigos: ele é concedido no cadastro.
          </p>

          {erro && (
            <div role="alert" className="mt-4 bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger font-semibold">
              {erro}
            </div>
          )}
          {aviso && (
            <div role="status" className="mt-4 bg-success-light border-2 border-success/40 rounded-2xl p-4 text-success-ink font-semibold">
              {aviso}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="tokens-titulo">
          <h2 id="tokens-titulo" className="text-xl font-extrabold text-ink mb-4">
            Códigos gerados ({busca.trim() ? `${filtrados.length} de ${tokens.length}` : tokens.length})
          </h2>

          <div className="relative mb-4">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" aria-hidden="true" />
            <label htmlFor="busca" className="sr-only">Filtrar códigos por código, plano ou email</label>
            <input id="busca" type="search" value={busca} onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por código, plano ou email" className="input pl-10" />
          </div>

          {tokens.length === 0 ? (
            <p className="text-ink/70">Nenhum código gerado ainda.</p>
          ) : filtrados.length === 0 ? (
            <p className="text-ink/70">Nenhum código corresponde ao filtro.</p>
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
                    <th className="pb-2">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((t) => {
                    const acaoPendente = pendente?.codigo === t.codigo ? pendente.acao : null;
                    const podeRevogar = t.status === 'resgatado' && t.usados <= LIMITE_DE_USO;
                    const podeExcluir = t.status === 'disponivel';
                    return (
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
                        <td className="py-2">
                          {t.resgatado_por_email ? (
                            <>
                              {t.resgatado_por_email}
                              <span className="block text-sm text-ink/60">
                                {t.usados} {t.usados === 1 ? 'usada' : 'usadas'}
                              </span>
                            </>
                          ) : '-'}
                        </td>
                        <td className="py-2">
                          {acaoPendente ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-ink/70">
                                {acaoPendente === 'revogar' ? 'Revogar este código?' : 'Excluir este código?'}
                              </span>
                              <button type="button" onClick={() => executar(t, acaoPendente)}
                                disabled={executando} className="font-bold text-primary-dark hover:text-primary">
                                {executando ? '...' : 'Confirmar'}
                              </button>
                              <button type="button" onClick={() => setPendente(null)}
                                disabled={executando} className="text-ink/60">Cancelar</button>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              {podeRevogar && (
                                <button type="button" onClick={() => setPendente({ codigo: t.codigo, acao: 'revogar' })}
                                  aria-label={`Revogar código ${t.codigo}`} title="Revogar"
                                  className="p-2 rounded-lg hover:bg-secondary-light text-secondary-ink">
                                  <Undo2 size={16} aria-hidden="true" />
                                </button>
                              )}
                              {podeExcluir && (
                                <button type="button" onClick={() => setPendente({ codigo: t.codigo, acao: 'excluir' })}
                                  aria-label={`Excluir código ${t.codigo}`} title="Excluir"
                                  className="p-2 rounded-lg hover:bg-danger-light text-danger-ink">
                                  <Trash2 size={16} aria-hidden="true" />
                                </button>
                              )}
                              {!podeRevogar && !podeExcluir && <span className="text-ink/40">—</span>}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
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
