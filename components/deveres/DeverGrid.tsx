'use client';

import Link from 'next/link';
import { Plus, CheckCircle2 } from 'lucide-react';
import { ResumoDever } from '@/lib/types';

export function tituloDoDever(d: { titulo: string | null; conteudo_texto: string }): string {
  return d.titulo || d.conteudo_texto.slice(0, 60) || 'Dever sem título';
}

export default function DeverGrid({ deveres }: { deveres: ResumoDever[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {deveres.map((d) => (
        <Link key={d.id} href={`/deveres/${d.id}`}
          className="card block min-w-0 hover:shadow-card-hover transition-shadow">
          <p className="font-extrabold text-ink text-lg truncate mb-2">{tituloDoDever(d)}</p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {d.disciplina && <span className="badge bg-primary-light text-primary-dark">{d.disciplina}</span>}
            <span className="badge bg-secondary-light text-secondary-ink">{d.total_slides} slides</span>
          </div>
          {d.resumo_para_pais && (
            <p className="text-ink/70 text-sm line-clamp-2 mb-3">{d.resumo_para_pais}</p>
          )}
          {d.total_slides > 0 && (
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs text-ink/60 mb-1">
                <span>{d.lido_ate ?? 0} de {d.total_slides}</span>
                {d.concluido && <span className="text-primary font-semibold flex items-center gap-1"><CheckCircle2 size={12} aria-hidden="true" /> Concluído</span>}
              </div>
              <div className="h-2 bg-ink/10 rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${Math.round(((d.lido_ate ?? 0) / d.total_slides) * 100)}%` }} />
              </div>
            </div>
          )}
          <p className="text-sm text-ink/60">{new Date(d.criado_em).toLocaleDateString('pt-BR')}</p>
        </Link>
      ))}
    </div>
  );
}

export function NovoDeverBotao() {
  return (
    <Link href="/deveres/nova" className="btn-primary !w-auto">
      <Plus size={22} aria-hidden="true" /> Novo dever
    </Link>
  );
}
