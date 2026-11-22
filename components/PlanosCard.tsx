'use client';

import { useState } from 'react';
import { CircleDollarSign, CreditCard } from 'lucide-react';
import { formatarPreco } from '@/lib/client/format';
import { Plano } from '@/lib/types';
import { SkeletonBloco } from '@/components/Skeleton';
import Spinner from '@/components/Spinner';
import { apiFetch } from '@/lib/client/api';

// `carregando` separa a espera do vazio real: sem ele, uma falha em /api/planos
// prendia a tela em "Carregando os planos..." para sempre.
export default function PlanosCard({ planos, carregando = false }: { planos: Plano[]; carregando?: boolean }) {
  const [comprando, setComprando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function comprarPlano(planoCodigo: string) {
    setComprando(planoCodigo);
    setErro(null);
    try {
      const res = await apiFetch('/api/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano_codigo: planoCodigo }),
      });

      if (!res.ok) {
        const dados = await res.json().catch(() => ({}));
        setErro(dados.error || 'Não foi possível iniciar o pagamento. Tente novamente.');
        return;
      }

      const { checkout_url } = await res.json();
      if (checkout_url) {
        if (typeof window !== 'undefined' && typeof window.location.assign === 'function') {
          window.location.assign(checkout_url);
        }
      }
    } catch {
      setErro('Erro de conexão ao iniciar o pagamento.');
    } finally {
      setComprando(null);
    }
  }

  return (
    <section className="card" aria-labelledby="planos-titulo">
      <h2 id="planos-titulo" className="text-2xl font-extrabold text-primary mb-2 flex items-center gap-2">
        <CircleDollarSign size={24} aria-hidden="true" /> Planos
      </h2>
      <p className="text-ink/70 mb-5">
        Contrate um pacote com PIX ou Cartão para liberar mais revisões, ou resgate um código abaixo.
      </p>

      {erro && (
        <div role="alert" className="mb-4 rounded-xl bg-danger-light p-3 text-sm font-semibold text-danger-ink">
          {erro}
        </div>
      )}

      {carregando && planos.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Carregando planos…">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border-2 border-primary/10 bg-primary-light/30 p-5">
              <SkeletonBloco className="h-6 w-24 mb-3" />
              <SkeletonBloco className="h-8 w-32 mb-2" />
              <SkeletonBloco className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : planos.length === 0 ? (
        <p className="text-ink/70">Não foi possível carregar os planos agora. Recarregue a página para tentar de novo.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {planos.map((p) => (
            <li key={p.codigo} className="flex flex-col justify-between rounded-2xl border-2 border-primary/20 bg-primary-light/40 p-4 sm:p-5 min-w-0">
              <div>
                <p className="text-xl font-extrabold text-ink">{p.nome}</p>
                <p className="text-2xl lg:text-3xl font-extrabold text-primary mt-1 break-words">{formatarPreco(p.preco_cents)}</p>
                <p className="text-ink/70 mt-1">{p.revisoes} revisões</p>
              </div>

              {p.preco_cents > 0 ? (
                <button
                  type="button"
                  disabled={comprando !== null}
                  onClick={() => comprarPlano(p.codigo)}
                  className="btn-primary mt-4 w-full flex items-center justify-center gap-2 !py-2.5 text-base"
                >
                  {comprando === p.codigo ? (
                    <>
                      <Spinner /> Redirecionando...
                    </>
                  ) : (
                    <>
                      <CreditCard size={18} aria-hidden="true" /> Pagar com PIX ou Cartão
                    </>
                  )}
                </button>
              ) : (
                <div className="mt-4 py-2 text-center text-sm font-semibold text-ink/50">
                  Plano inicial gratuito
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
