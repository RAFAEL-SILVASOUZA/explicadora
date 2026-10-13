'use client';

import { CircleDollarSign } from 'lucide-react';
import { formatarPreco } from '@/lib/client/format';
import { Plano } from '@/lib/types';

export default function PlanosCard({ planos }: { planos: Plano[] }) {
  return (
    <section className="card" aria-labelledby="planos-titulo">
      <h2 id="planos-titulo" className="text-2xl font-extrabold text-primary mb-2 flex items-center gap-2">
        <CircleDollarSign size={24} aria-hidden="true" /> Planos
      </h2>
      <p className="text-ink/70 mb-5">
        Contrate um plano, receba o código e resgate aqui para receber as revisões.
      </p>

      {planos.length === 0 ? (
        <p className="text-ink/70">Carregando os planos...</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-3">
          {planos.map((p) => (
            <li key={p.codigo} className="rounded-2xl border-2 border-primary/20 bg-primary-light/40 p-5">
              <p className="text-xl font-extrabold text-ink">{p.nome}</p>
              <p className="text-3xl font-extrabold text-primary mt-1">{formatarPreco(p.preco_cents)}</p>
              <p className="text-ink/70 mt-1">{p.revisoes} revisões</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
