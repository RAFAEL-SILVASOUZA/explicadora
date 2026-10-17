'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ResumoDever } from '@/lib/types';

export function tituloDoDever(d: { titulo: string | null; conteudo_texto: string }): string {
  return d.titulo || d.conteudo_texto.slice(0, 60) || 'Dever sem título';
}

export default function DeverGrid({ deveres }: { deveres: ResumoDever[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {deveres.map((d) => (
        <Link key={d.id} href={`/deveres/${d.id}`}
          className="card block hover:shadow-card-hover transition-shadow">
          <p className="font-extrabold text-ink text-lg truncate mb-2">{tituloDoDever(d)}</p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {d.disciplina && <span className="badge bg-primary-light text-primary-dark">{d.disciplina}</span>}
            <span className="badge bg-secondary-light text-secondary-ink">{d.total_passos} passos</span>
          </div>
          {d.resumo_para_pais && (
            <p className="text-ink/70 text-sm line-clamp-2 mb-3">{d.resumo_para_pais}</p>
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
