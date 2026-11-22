'use client';

import { CircleDollarSign } from 'lucide-react';
import { formatarPreco } from '@/lib/client/format';
import { Plano } from '@/lib/types';
import { SkeletonBloco } from '@/components/Skeleton';

// `carregando` separa a espera do vazio real: sem ele, uma falha em /api/planos
// prendia a tela em "Carregando os planos..." para sempre.
export default function PlanosCard({ planos, carregando = false }: { planos: Plano[]; carregando?: boolean }) {
  return (
    <section className="card" aria-labelledby="planos-titulo">
      <h2 id="planos-titulo" className="text-2xl font-extrabold text-primary mb-2 flex items-center gap-2">
        <CircleDollarSign size={24} aria-hidden="true" /> Planos
      </h2>
      <p className="text-ink/70 mb-5">
        Contrate um plano, receba o código e resgate aqui para receber as revisões.
      </p>

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
            <li key={p.codigo} className="rounded-2xl border-2 border-primary/20 bg-primary-light/40 p-4 sm:p-5 min-w-0">
              <p className="text-xl font-extrabold text-ink">{p.nome}</p>
              <p className="text-2xl lg:text-3xl font-extrabold text-primary mt-1 break-words">{formatarPreco(p.preco_cents)}</p>
              <p className="text-ink/70 mt-1">{p.revisoes} revisões</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
