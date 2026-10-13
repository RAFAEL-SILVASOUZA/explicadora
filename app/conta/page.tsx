'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { List } from 'lucide-react';
import Header from '@/components/Header';
import PlanosCard from '@/components/PlanosCard';
import ResgateTokenCard from '@/components/ResgateTokenCard';
import { apiFetch, lerToken } from '@/lib/client/api';
import { Plano } from '@/lib/types';

interface Movimento {
  tipo: 'registro' | 'resgate' | 'consumo' | 'revogacao';
  quantidade: number;
  plano_codigo: string | null;
  criado_em: string;
}

interface DadosConta {
  plano: string;
  saldo: number;
  movimentos: Movimento[];
  conta: { role: 'user' | 'admin' };
}

const TIPO_TEXTO: Record<Movimento['tipo'], string> = {
  registro: 'Cadastro',
  resgate: 'Resgate',
  consumo: 'Revisão gerada',
  revogacao: 'Código revogado',
};

export default function Conta() {
  const router = useRouter();
  const [dados, setDados] = useState<DadosConta | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);

  const carregar = useCallback(async () => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    const res = await apiFetch('/api/conta');
    if (!res.ok) return;
    setDados(await res.json());
    const planosRes = await apiFetch('/api/planos');
    if (planosRes.ok) setPlanos(await planosRes.json());
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary">Minha conta</h1>

        <section className="card" aria-labelledby="saldo-titulo">
          <h2 id="saldo-titulo" className="text-xl font-extrabold text-ink mb-4">Plano e saldo</h2>
          {dados ? (
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-primary-light p-4 flex-1 min-w-[12rem]">
                <p className="text-sm font-semibold text-ink/60">Plano atual</p>
                <p className="text-2xl font-extrabold text-primary-dark">{dados.plano}</p>
              </div>
              <div className="rounded-2xl bg-success-light p-4 flex-1 min-w-[12rem]">
                <p className="text-sm font-semibold text-ink/60">Saldo</p>
                <p className="text-2xl font-extrabold text-success-ink">{dados.saldo} revisões</p>
              </div>
            </div>
          ) : (
            <p className="text-ink/70">Carregando...</p>
          )}
          {dados?.saldo === 0 && (
            <p className="mt-4 text-ink/70">Saldo zerado: resgate um código abaixo para continuar estudando.</p>
          )}
        </section>

        <PlanosCard planos={planos} />
        <ResgateTokenCard onResgate={carregar} />

        <section className="card" aria-labelledby="extrato-titulo">
          <h2 id="extrato-titulo" className="text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
            <List size={22} aria-hidden="true" /> Extrato do saldo
          </h2>
          {!dados || dados.movimentos.length === 0 ? (
            <p className="text-ink/70">Nenhum movimento ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-ink/60 text-sm">
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2">Quantidade</th>
                    <th className="pb-2">Plano</th>
                    <th className="pb-2">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.movimentos.map((m, i) => (
                    <tr key={i} className="border-t border-ink/10">
                      <td className="py-2">{TIPO_TEXTO[m.tipo]}</td>
                      <td className={`py-2 font-bold ${m.quantidade > 0 ? 'text-success-ink' : 'text-danger-ink'}`}>
                        {m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}
                      </td>
                      <td className="py-2">{m.plano_codigo ?? '-'}</td>
                      <td className="py-2">{new Date(m.criado_em).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-ink/70">
          As revisões e o histórico ficam na{' '}
          <Link href="/revisoes" className="font-bold text-primary hover:text-primary-dark">área de revisões</Link>.
        </p>
      </main>
    </>
  );
}
