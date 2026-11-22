'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Frown } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import ControlesSlides from '@/components/deveres/ControlesSlides';
import { tituloDoDever } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import type { DeverCompleto } from '@/lib/types';

export default function DeverDetalhe({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [dados, setDados] = useState<DeverCompleto | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    apiFetch(`/api/dever/${params.id}`)
      .then(async (res) => {
        const corpo = await res.json();
        if (!res.ok) throw new Error(corpo.error ?? 'Não foi possível carregar o dever.');
        setDados(corpo);
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const slide = dados?.slides[indice] ?? null;

  // Atalhos de teclado: setas. O aluno (e o pai) navega sem mouse.
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.code === 'ArrowRight') irPara(indice + 1);
      if (e.code === 'ArrowLeft') irPara(indice - 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  function irPara(novo: number) {
    if (!dados || novo < 0 || novo >= dados.slides.length) return;
    setIndice(novo);
  }

  if (carregando) {
    return (
      <>
        <Header />
        <main className="shell py-8">
          <div className="card"><p className="text-2xl font-extrabold text-ink">Carregando o dever...</p></div>
        </main>
      </>
    );
  }

  if (erro || !dados || !slide) {
    return (
      <>
        <Header />
        <main className="shell py-8">
          <div className="card text-center border-2 border-danger/40">
            <p className="text-2xl font-extrabold text-danger mb-4">
              <Frown size={32} className="inline mr-2" aria-hidden="true" /> {erro || 'Dever não encontrado'}
            </p>
            <Link href="/deveres" className="btn-primary !w-auto">Voltar para os deveres</Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="shell py-3 sm:py-4 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Mascote humor="feliz" className="w-10 h-10 shrink-0" decorative />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-primary truncate">{tituloDoDever(dados.dever)}</h1>
            <p className="text-ink/60 text-sm">{dados.dever.disciplina || 'Dever de casa'}</p>
          </div>
          <Link href="/deveres" className="btn-secondary !py-2 !px-4 text-base shrink-0" aria-label="Voltar para os deveres">
            <ChevronLeft size={18} aria-hidden="true" /> Dever de Casa
          </Link>
        </div>

        {/* O slide é o conteúdo: título curto + explicação em frases curtas. */}
        <section className="card" aria-label={`Slide ${indice + 1} de ${dados.slides.length}`}>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-ink mb-3">{slide.titulo}</h2>
          <p className="text-xl sm:text-2xl text-ink/80 leading-relaxed">{slide.explicacao}</p>
        </section>

        <ControlesSlides
          slideAtual={indice + 1}
          totalSlides={dados.slides.length}
          onAnterior={() => irPara(indice - 1)}
          onProximo={() => irPara(indice + 1)}
        />
      </main>
    </>
  );
}
