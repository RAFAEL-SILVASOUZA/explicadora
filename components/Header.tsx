'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, BookOpen, User, LogOut, ShieldCheck } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { apiFetch, lerToken, limparToken } from '@/lib/client/api';
import { assinarSaldo } from '@/lib/client/saldo';
import Mascote from './Mascote';

interface Sessao {
  role: 'user' | 'admin';
  saldo_revisoes: number;
}

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState<Sessao | null>(null);

  // Uma navegação sem estado ativo não diz onde você está. O prefixo mantém o link
  // aceso dentro das páginas filhas (/revisoes/abc continua "Revisões").
  const ativo = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const navClass = (href: string) => `nav-link ${ativo(href) ? 'bg-primary-light text-primary-dark' : ''}`;

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
          <Mascote humor="feliz" className="w-8 h-8 shrink-0" decorative />
          Estudo Divertido
        </Link>

        <nav aria-label="Navegação principal" className="ml-auto flex items-center gap-1 flex-wrap">
          <Link href="/" className={navClass('/')} aria-current={ativo('/') ? 'page' : undefined}>
            <Home size={18} aria-hidden="true" /> Início
          </Link>
          <Link href="/revisoes" className={navClass('/revisoes')} aria-current={ativo('/revisoes') ? 'page' : undefined}>
            <BookOpen size={18} aria-hidden="true" /> Revisões
          </Link>
          <Link href="/conta" className={navClass('/conta')} aria-current={ativo('/conta') ? 'page' : undefined}>
            <User size={18} aria-hidden="true" /> Minha conta
          </Link>
          {sessao?.role === 'admin' && (
            <Link href="/admin" className={navClass('/admin')} aria-current={ativo('/admin') ? 'page' : undefined}>
              <ShieldCheck size={18} aria-hidden="true" /> Admin
            </Link>
          )}

          {sessao && (
            <span className="badge bg-success-light text-success-ink" aria-label={`Saldo: ${sessao.saldo_revisoes} revisões`}>
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
