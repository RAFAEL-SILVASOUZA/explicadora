'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, BookOpen, User, LogOut, ShieldCheck, CircleDollarSign, Backpack, Library, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { apiFetch, lerToken, limparToken } from '@/lib/client/api';
import { assinarSaldo } from '@/lib/client/saldo';
import Mascote from './Mascote';

interface Sessao {
  role: 'user' | 'admin';
  nome: string;
  sobrenome: string;
  saldo_revisoes: number;
}

const LINKS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/revisoes', label: 'Revisões', icon: BookOpen },
  { href: '/deveres', label: 'Deveres', icon: Backpack },
  { href: '/arquivos', label: 'Arquivos', icon: Library },
  { href: '/creditos', label: 'Créditos', icon: CircleDollarSign },
  { href: '/conta', label: 'Minha conta', icon: User },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);

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
        if (data?.conta) {
          setSessao({
            role: data.conta.role,
            nome: data.conta.nome,
            sobrenome: data.conta.sobrenome,
            saldo_revisoes: data.conta.saldo_revisoes,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarSaldo();
    return assinarSaldo(carregarSaldo);
  }, [carregarSaldo]);

  // A gaveta é um overlay: ao navegar, ao apertar Esc ou com a página em foco de novo,
  // ela tem de sair do caminho do teclado e devolver a rolagem ao documento.
  useEffect(() => {
    if (!menuAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    fecharRef.current?.focus();
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAberto(false);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener('keydown', aoTeclar);
    };
  }, [menuAberto]);

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  function sair() {
    limparToken();
    setSessao(null);
    setMenuAberto(false);
    router.replace('/login');
  }

  const itens = sessao?.role === 'admin' ? [...LINKS, { href: '/admin', label: 'Admin', icon: ShieldCheck }] : LINKS;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-primary/15">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Logado, o slot da marca mostra o nome da pessoa; sem sessão, o nome do app. */}
        <Link href="/" className="flex items-center gap-2 font-extrabold text-primary text-lg min-w-0">
          <Mascote humor="feliz" className="w-8 h-8 shrink-0" decorative />
          <span className="truncate">
            {sessao ? [sessao.nome, sessao.sobrenome].filter(Boolean).join(' ') : 'Estudo Divertido'}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMenuAberto((aberto) => !aberto)}
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          className="ml-auto inline-flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-primary/25 bg-white text-primary transition-colors hover:bg-primary-light focus-visible:outline-offset-2"
        >
          {menuAberto ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>

      {/* Gaveta lateral: fecha ao tocar no véu, no Esc ou ao navegar. */}
      {menuAberto && (
        <button
          type="button"
          onClick={() => setMenuAberto(false)}
          aria-label="Fechar menu"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
        />
      )}

      <div
        id="menu-lateral"
        aria-label="Menu"
        className={`fixed top-0 right-0 z-50 h-dvh w-[min(20rem,85vw)] bg-white shadow-card flex flex-col transition-transform duration-200 motion-reduce:transition-none ${
          menuAberto ? 'translate-x-0' : 'translate-x-full invisible'
        }`}
      >
        <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/15">
          <span className="font-extrabold text-primary text-lg">Menu</span>
          <button
            ref={fecharRef}
            type="button"
            onClick={() => setMenuAberto(false)}
            aria-label="Fechar menu"
            className="ml-auto inline-flex items-center justify-center w-12 h-12 rounded-2xl text-ink/70 transition-colors hover:bg-primary-light hover:text-primary-dark focus-visible:outline-offset-2"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        {sessao && (
          <div className="px-4 pt-4">
            <span className="badge bg-success-light text-success-ink" aria-label={`Saldo: ${sessao.saldo_revisoes} revisões`}>
              {sessao.saldo_revisoes} revisões
            </span>
          </div>
        )}

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
          {itens.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuAberto(false)}
              className={`${navClass(href)} w-full !px-4 !py-3 text-lg`}
              aria-current={ativo(href) ? 'page' : undefined}
            >
              <Icon size={20} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>

        {sessao && (
          <div className="p-4 border-t border-primary/15">
            <button type="button" onClick={sair} className="btn-secondary w-full !py-3 text-base" aria-label="Sair da conta">
              <LogOut size={18} aria-hidden="true" /> Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
