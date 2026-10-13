'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ShieldCheck } from 'lucide-react';
import { apiFetch, lerToken, limparToken } from '@/lib/client/api';
import { assinarSaldo } from '@/lib/client/saldo';
import MascoteCoruja from './MascoteCoruja';

interface Sessao {
  role: 'user' | 'admin';
  saldo_revisoes: number;
}

export default function Header() {
  const router = useRouter();
  const [sessao, setSessao] = useState<Sessao | null>(null);

  const carregarSaldo = useCallback(() => {
    if (!lerToken()) {
      setSessao(null);
      return;
    }
    apiFetch('/api/conta')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.conta) setSessao({ role: data.conta.role, saldo_revisoes: data.conta.saldo_revisoes });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarSaldo();
    return assinarSaldo(carregarSaldo);
  }, [carregarSaldo]);

  function sair() {
    limparToken();
    setSessao(null);
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-primary/15">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-primary text-lg">
          <MascoteCoruja humor="feliz" className="w-8 h-8 shrink-0" aria-hidden="true" />
          Estudo Divertido
        </Link>

        <nav aria-label="Navegação principal" className="ml-auto flex items-center gap-1 flex-wrap">
          <Link href="/" className="nav-link">Início</Link>
          <Link href="/revisoes" className="nav-link">Revisões</Link>
          <Link href="/conta" className="nav-link">Minha conta</Link>
          {sessao?.role === 'admin' && (
            <Link href="/admin" className="nav-link">
              <ShieldCheck size={18} aria-hidden="true" /> Admin
            </Link>
          )}

          {sessao && (
            <span className="badge bg-success-light text-success" aria-label={`Saldo: ${sessao.saldo_revisoes} revisões`}>
              {sessao.saldo_revisoes} revisões
            </span>
          )}

          {sessao && (
            <button type="button" onClick={sair} className="btn-secondary !py-2 !px-4 text-base" aria-label="Sair da conta">
              <LogOut size={18} aria-hidden="true" /> Sair
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
