'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, User as UserIcon } from 'lucide-react';
import Header from '@/components/Header';
import { apiFetch, lerToken } from '@/lib/client/api';

interface DadosConta {
  conta: { role: 'user' | 'admin'; nome: string; sobrenome: string; email: string; criado_em: string };
}

export default function Conta() {
  const router = useRouter();
  const [dados, setDados] = useState<DadosConta | null>(null);

  const carregar = useCallback(async () => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    const res = await apiFetch('/api/conta');
    if (!res.ok) return;
    setDados(await res.json());
  }, [router]);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <>
      <Header />
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary">Minha conta</h1>

        {/* Conta é só o cadastro. Saldo, planos, resgate e extrato têm uma área só: /creditos. */}
        <section className="card" aria-labelledby="perfil-titulo">
          <h2 id="perfil-titulo" className="text-xl font-extrabold text-ink mb-4 flex items-center gap-2">
            <UserIcon size={22} aria-hidden="true" /> Meus dados
          </h2>
          {dados ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-semibold text-ink/60">Nome</dt>
                <dd className="text-lg font-bold text-ink">
                  {[dados.conta.nome, dados.conta.sobrenome].filter(Boolean).join(' ')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink/60">E-mail</dt>
                <dd className="text-lg font-bold text-ink flex items-center gap-2">
                  <Mail size={18} aria-hidden="true" /> {dados.conta.email}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-ink/60">Conta desde</dt>
                <dd className="text-lg font-bold text-ink">
                  {new Date(dados.conta.criado_em).toLocaleDateString('pt-BR')}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-ink/70">Carregando...</p>
          )}
        </section>

        <p className="text-center text-ink/70">
          Saldo, pacotes e resgate de código ficam em{' '}
          <Link href="/creditos" className="font-bold text-primary hover:text-primary-dark">Créditos</Link>
          {' '}e as revisões na{' '}
          <Link href="/revisoes" className="font-bold text-primary hover:text-primary-dark">área de revisões</Link>.
        </p>
      </main>
    </>
  );
}
