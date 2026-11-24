'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ResumoRevisao } from '@/lib/types';
import { revisaoFinalizada } from '@/lib/resumo';

// A regra de "finalizada" vem do mesmo lugar do placar da home: uma única definição
// para não divergir entre telas.
function statusDaRevisao(r: ResumoRevisao): { texto: string; classe: string } {
  if (r.total_questoes === 0) return { texto: 'Vazia', classe: 'bg-primary-light text-primary-dark' };
  if (r.total_respostas === 0) return { texto: 'Não iniciada', classe: 'bg-secondary-light text-secondary-ink' };
  if (revisaoFinalizada(r)) return { texto: 'Finalizada', classe: 'bg-success-light text-success-ink' };
  return { texto: 'Em andamento', classe: 'bg-secondary-light text-secondary-ink' };
}

export function tituloDaRevisao(r: { titulo: string | null; conteudo_texto: string }): string {
  return r.titulo || r.conteudo_texto.slice(0, 60) || 'Revisão sem título';
}

export default function RevisaoGrid({ revisoes }: { revisoes: ResumoRevisao[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {revisoes.map((r) => {
        const status = statusDaRevisao(r);
        return (
          <Link key={r.id} href={`/revisoes/${r.id}`}
            className="card block min-w-0 overflow-hidden hover:shadow-card-hover transition-shadow">
            <p className="font-extrabold text-ink text-lg mb-2 line-clamp-2 break-words">{tituloDaRevisao(r)}</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className={`badge ${status.classe}`}>{status.texto}</span>
              <span className="badge bg-primary-light text-primary-dark">
                {r.total_respostas}/{r.total_questoes} respondidas
              </span>
              {r.total_respostas > 0 && (
                <span className="badge bg-success-light text-success-ink">{r.acertos} acertos</span>
              )}
            </div>
            <p className="text-sm text-ink/60">{new Date(r.criado_em).toLocaleDateString('pt-BR')}</p>
          </Link>
        );
      })}
    </div>
  );
}

export function NovaRevisaoBotao() {
  return (
    <Link href="/revisoes/nova" className="btn-primary !w-full sm:!w-auto">
      <Plus size={22} aria-hidden="true" /> Nova revisão
    </Link>
  );
}
