'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, BookOpen, User, LogOut, ShieldCheck, CircleDollarSign, Backpack, Library, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { apiFetch, lerToken, limparToken } from '@/lib/client/api';
import { assinarSaldo, formatarRevisoes } from '@/lib/client/saldo';
import { SkeletonBloco } from './Skeleton';

interface Sessao {
  role: 'user' | 'admin';
  nome: string;
  sobrenome: string;
  saldo_revisoes: number;
}

const LINKS = [
  { href: '/', label: 'Início', icon: Home },
  { href: '/revisoes', label: 'Revisões', icon: BookOpen },
  { href: '/deveres', label: 'Dever de Casa', icon: Backpack },
  { href: '/arquivos', label: 'Arquivos', icon: Library },
  { href: '/creditos', label: 'Créditos', icon: CircleDollarSign },
  { href: '/conta', label: 'Minha conta', icon: User },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [menuAberto, setMenuAberto] = useState(false);
  // "montado" vive um tempo a mais que "aberto": ao fechar, o invólucro continua visível
  // pela duração da animação — sem isso o painel some sem deslizar de volta (o "nenhum efeito").
  const [montado, setMontado] = useState(false);
  // O badge de saldo não pode simplesmente "aparecer do nada": enquanto a primeira
  // resposta não chega, a gaveta mostra a silhueta dele pulsando.
  const [saldoChegou, setSaldoChegou] = useState(false);
  const fecharRef = useRef<HTMLButtonElement>(null);

  // Uma navegação sem estado ativo não diz onde você está. O prefixo mantém o link
  // aceso dentro das páginas filhas (/revisoes/abc continua "Revisões").
  const ativo = (href: string) => pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
  const navClass = (href: string) => `nav-link ${ativo(href) ? 'bg-primary-light text-primary-dark' : ''}`;

  const carregarSaldo = useCallback(() => {
    if (!lerToken()) {
      setSessao(null);
      setSaldoChegou(true);
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
      .catch(() => {})
      .finally(() => setSaldoChegou(true));
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

  // Duração casada com o `duration-200` do painel e do véu abaixo.
  useEffect(() => {
    if (menuAberto) {
      setMontado(true);
      return;
    }
    const t = setTimeout(() => setMontado(false), 200);
    return () => clearTimeout(t);
  }, [menuAberto]);

  function sair() {
    limparToken();
    setSessao(null);
    setMenuAberto(false);
    router.replace('/login');
  }

  const itens = sessao?.role === 'admin' ? [...LINKS, { href: '/admin', label: 'Admin', icon: ShieldCheck }] : LINKS;

  return (
    <>
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-primary/15">
      <div className="shell py-3 flex items-center gap-3">
        {/* Só o ícone da marca: o texto foi removido no rebrand. */}
        <Link href="/" className="flex items-center gap-2 min-w-0" aria-label="EXPLICADORA — Página inicial">
          {/* eslint-disable-next-line @next/next/no-img-element -- ícone local do app (SVG sem next/image) */}
          <img src="/logo-icon.svg" alt="Estudo Divertido" width={40} height={40} className="w-10 h-10 sm:w-8 sm:h-8 shrink-0" />
        </Link>

        <button
          type="button"
          onClick={() => setMenuAberto((aberto) => !aberto)}
          aria-expanded={menuAberto}
          aria-controls="menu-lateral"
          aria-label={menuAberto ? 'Fechar menu' : 'Abrir menu'}
          className="ml-auto inline-flex items-center justify-center w-12 h-12 rounded-2xl border-2 border-primary/25 bg-white text-primary transition-[color,background-color,transform] duration-150 hover:bg-primary-light active:scale-90 focus-visible:outline-offset-2"
        >
          {menuAberto ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
        </button>
      </div>
    </header>

      {/* Gaveta lateral: irmã do header (não filha), porque o backdrop-blur do header criaria
          um containing block e a gaveta `fixed` ficaria presa na faixa do topo. O invólucro
          recortado (e sem ponteiro quando fechada) evita que o painel traduzido para fora da
          tela crie rolagem horizontal. Fecha ao tocar no véu, no Esc ou ao navegar. */}
      <div
        aria-hidden={!menuAberto}
        className={`fixed inset-0 z-50 overflow-hidden ${montado ? '' : 'invisible pointer-events-none'}`}
      >
        {/* O véu acompanha a gaveta nos dois sentidos: entra desvanecendo e sai junto dela. */}
        <button
          type="button"
          onClick={() => setMenuAberto(false)}
          aria-label="Fechar menu"
          aria-hidden="true"
          tabIndex={-1}
          className={`absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-200 motion-reduce:transition-none ${
            menuAberto ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        <div
          id="menu-lateral"
          aria-label="Menu"
          className={`absolute top-0 right-0 h-dvh w-[min(20rem,85vw)] bg-white shadow-card flex flex-col transition-transform duration-200 motion-reduce:transition-none ${
            menuAberto ? 'translate-x-0' : 'translate-x-full'
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

        {sessao ? (
          <div className="px-4 pt-4">
            <span className="badge bg-success-light text-success-ink" aria-label={`Saldo: ${formatarRevisoes(sessao.saldo_revisoes)} revisões`}>
              {formatarRevisoes(sessao.saldo_revisoes)} revisões
            </span>
          </div>
        ) : !saldoChegou ? (
          <div className="px-4 pt-4">
            <SkeletonBloco className="h-7 w-28 rounded-full" />
          </div>
        ) : null}

        <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
          {itens.map(({ href, label, icon: Icon }, i) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuAberto(false)}
              className={`${navClass(href)} w-full !px-4 !py-3 text-lg transition-[transform,opacity,color,background-color] duration-300 motion-reduce:transition-none ${
                menuAberto ? 'translate-x-0 opacity-100' : 'translate-x-6 opacity-0'
              }`}
              style={{ transitionDelay: menuAberto ? `${80 + i * 45}ms` : '0ms' }}
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
      </div>
    </>
  );
}
