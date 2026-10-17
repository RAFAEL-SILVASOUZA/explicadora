'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CircleDollarSign, KeyRound, List } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import PlanosCard from '@/components/PlanosCard';
import ResgateTokenCard from '@/components/ResgateTokenCard';
import { apiFetch, lerToken } from '@/lib/client/api';
import { Plano } from '@/lib/types';

interface Movimento {
  tipo: 'registro' | 'resgate' | 'consumo' | 'revogacao';
  quantidade: number;
  plano_codigo: string | null;
  // A API /api/conta devolve os vínculos do movimento (extratoConta seleciona
  // m.dever_id/m.revisao_id): é o que permite ao extrato distinguir consumo de
  // dever de consumo de revisão.
  dever_id?: string | null;
  revisao_id?: string | null;
  criado_em: string;
}

interface DadosConta {
  plano: string;
  saldo: number;
  movimentos: Movimento[];
}

const TIPO_TEXTO: Record<Movimento['tipo'], string> = {
  registro: 'Cadastro',
  resgate: 'Resgate',
  consumo: 'Revisão gerada',
  revogacao: 'Código revogado',
};

// Um consumo vinculado a um dever (dever_id preenchido em movimentos_saldo) foi
// gerado por um dever explicado, não por uma revisão (spec §6.1).
function rotuloDoMovimento(movimento: Movimento): string {
  if (movimento.tipo === 'consumo' && movimento.dever_id) return 'Dever explicado';
  return TIPO_TEXTO[movimento.tipo];
}

export default function Creditos() {
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
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
          <CircleDollarSign size={30} aria-hidden="true" /> Créditos
        </h1>
        <p className="text-ink/70">
          Aqui você vê quanto saldo tem, contrata um pacote e cola o código que recebeu para somar revisões.
        </p>

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
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Mascote humor="pensando" className="w-12 h-12 shrink-0" decorative />
              <p className="text-ink/70">
                Saldo zerado: contrate um pacote abaixo e cole o código para continuar estudando.
              </p>
            </div>
          )}
        </section>

        <PlanosCard planos={planos} />
        <ResgateTokenCard onResgate={carregar} />

        <section className="card" aria-labelledby="extrato-titulo">
          <h2 id="extrato-titulo" className="text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
            <List size={22} aria-hidden="true" /> Extrato dos créditos
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
                    <th className="pb-2">Pacote</th>
                    <th className="pb-2">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.movimentos.map((m, i) => (
                    <tr key={i} className="border-t border-ink/10">
                      <td className="py-2">{rotuloDoMovimento(m)}</td>
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
          Seus dados de acesso ficam em{' '}
          <Link href="/conta" className="font-bold text-primary hover:text-primary-dark">Minha conta</Link>
          {' '}e as revisões na{' '}
          <Link href="/revisoes" className="font-bold text-primary hover:text-primary-dark">área de revisões</Link>.
        </p>
      </main>
    </>
  );
}
