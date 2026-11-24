'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, Frown, RotateCcw, CheckCircle2, RefreshCw } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import ControlesSlides from '@/components/deveres/ControlesSlides';
import { tituloDoDever } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import type { DeverCompleto } from '@/lib/types';

export default function DeverDetalhe({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dados, setDados] = useState<DeverCompleto | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [indice, setIndice] = useState(0);
  const [verTexto, setVerTexto] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [revelado, setRevelado] = useState(false);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
  }, [router]);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro('');
    apiFetch(`/api/dever/${params.id}`)
      .then(async (res) => {
        const corpo = await res.json();
        if (!res.ok) throw new Error(corpo.error ?? 'Não foi possível carregar o dever.');
        setDados(corpo);
        const lido = corpo.dever.lido_ate ?? 0;
        // lido_ate é a quantidade de slides lidos (1-based). Retomar no último
        // slide lido (lido - 1), não no próximo: recarregar não deve avançar.
        setIndice(Math.min(Math.max(0, lido - 1), Math.max(0, corpo.slides.length - 1)));
      })
      .catch((err: Error) => setErro(err.message))
      .finally(() => setCarregando(false));
  }, [params.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // Aviso vindo do formulário (vazamento não corrigido): exibe uma vez.
  useEffect(() => {
    if (searchParams.get('aviso') === 'vazamento') {
      setAviso('A explicação foi gerada, mas um slide ainda pode revelar a resposta. Revise com cuidado.');
    }
  }, [searchParams]);

  const slide = dados?.slides[indice] ?? null;

  // Ao trocar de slide, a explicação volta a ficar escondida: o aluno tenta
  // sozinho antes de ver a resposta.
  useEffect(() => { setRevelado(false); }, [indice]);

  // Persiste a leitura: o aluno volta de onde parou.
  useEffect(() => {
    if (!dados) return;
    const lidoAte = Math.max(dados.dever.lido_ate ?? 0, indice + 1);
    // Uma vez concluído, permanece concluído: navegar para trás não desmarca.
    const concluido = Boolean(dados.dever.concluido) || (indice + 1 >= dados.slides.length);
    if (lidoAte === dados.dever.lido_ate && concluido === dados.dever.concluido) return;
    apiFetch(`/api/dever/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lido_ate: lidoAte, concluido }),
    }).then(() => {
      setDados((d) => d ? { ...d, dever: { ...d.dever, lido_ate: lidoAte, concluido } } : d);
    }).catch(() => {});
  }, [indice, dados, params.id]);

  const regenerar = useCallback(async () => {
    if (regenerando) return;
    if (!confirm('Gerar uma nova versão desta explicação? Custa meia revisão do seu saldo.')) return;
    setRegenerando(true);
    setAviso('');
    try {
      const res = await apiFetch(`/api/dever/${params.id}/regenerar`, { method: 'POST' });
      const corpo = await res.json();
      if (!res.ok) throw new Error(corpo.error ?? 'Não foi possível regenerar.');
      if (corpo.vazamentoNaoCorrigido) setAviso('A explicação foi refeita, mas um slide ainda pode revelar a resposta. Revise com cuidado.');
      carregar();
    } catch (err: unknown) {
      setAviso(err instanceof Error ? err.message : 'Não foi possível regenerar.');
    } finally {
      setRegenerando(false);
    }
  }, [params.id, regenerando, carregar]);

  const irPara = useCallback((novo: number) => {
    if (!dados || novo < 0 || novo >= dados.slides.length) return;
    setIndice(novo);
  }, [dados]);

  // Atalhos de teclado: setas. O aluno (e o pai) navega sem mouse.
  // Desativado no modo "ver texto completo": as setas não fazem sentido lá.
  useEffect(() => {
    if (verTexto) return;
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.code === 'ArrowRight') irPara(indice + 1);
      if (e.code === 'ArrowLeft') irPara(indice - 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  }, [indice, irPara, verTexto]);

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
            <div className="flex gap-3 justify-center flex-wrap">
              <button type="button" onClick={carregar} className="btn-primary !w-auto">
                <RotateCcw size={20} aria-hidden="true" /> Tentar de novo
              </button>
              <Link href="/deveres" className="btn-secondary !w-auto">Voltar para os deveres</Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  const total = dados.slides.length;
  const progresso = Math.round(((indice + 1) / total) * 100);

  return (
    <>
      <Header />
      <main className="shell py-3 sm:py-4 space-y-3 sm:space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Mascote humor="feliz" className="w-10 h-10 shrink-0" decorative />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-primary truncate">{tituloDoDever(dados.dever)}</h1>
            <p className="text-ink/60 text-sm">{dados.dever.disciplina || 'Dever de casa'} · {dados.dever.nivel}</p>
          </div>
          <Link href="/deveres" className="btn-secondary !py-2 !px-4 text-base shrink-0" aria-label="Voltar para os deveres">
            <ChevronLeft size={18} aria-hidden="true" /> Dever de Casa
          </Link>
        </div>

        {/* Barra de progresso de leitura */}
        <div className="card !py-3" aria-label="Progresso de leitura">
          <div className="flex items-center justify-between text-sm text-ink/70 mb-2">
            <span>Progresso</span>
            <span>{indice + 1} de {total} · {progresso}%</span>
          </div>
          <div className="h-3 bg-ink/10 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${progresso}%` }} />
          </div>
        </div>

        {/* Toggle: ver texto completo ou um slide por vez */}
        <div className="flex gap-2">
          <button type="button" onClick={() => setVerTexto(false)} className={`btn-secondary !w-auto !py-2 ${!verTexto ? 'ring-2 ring-primary' : ''}`}>
            Um slide por vez
          </button>
          <button type="button" onClick={() => setVerTexto(true)} className={`btn-secondary !w-auto !py-2 ${verTexto ? 'ring-2 ring-primary' : ''}`}>
            Ver texto completo
          </button>
        </div>

        {verTexto ? (
          <section className="card space-y-4" aria-label="Texto completo">
            {dados.slides.map((s, i) => (
              <div key={s.id} className="border-b border-ink/10 pb-4 last:border-0 last:pb-0">
                <h2 className="text-xl font-extrabold text-ink mb-2">{i + 1}. {s.titulo}</h2>
                <p className="text-lg text-ink/80 leading-relaxed">{s.explicacao}</p>
              </div>
            ))}
          </section>
        ) : (
          <section className="card" aria-label={`Slide ${indice + 1} de ${total}`}>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-ink mb-3">{slide.titulo}</h2>
            {revelado ? (
              <p className="text-xl sm:text-2xl text-ink/80 leading-relaxed">{slide.explicacao}</p>
            ) : (
              <div className="space-y-4">
                <p className="text-lg text-ink/70">Tente entender o conceito sozinho antes de ver a explicação.</p>
                <button type="button" onClick={() => setRevelado(true)} className="btn-primary !w-auto">Mostrar explicação</button>
              </div>
            )}
          </section>
        )}

        {!verTexto && (
          <ControlesSlides
            slideAtual={indice + 1}
            totalSlides={total}
            onAnterior={() => irPara(indice - 1)}
            onProximo={() => irPara(indice + 1)}
          />
        )}

        {aviso && (
          <p role="alert" className="text-center text-amber-700 font-semibold">{aviso}</p>
        )}

        {dados.dever.concluido && (
          <p className="text-center text-primary font-semibold flex items-center justify-center gap-2">
            <CheckCircle2 size={20} aria-hidden="true" /> Dever concluído!
          </p>
        )}

        <div className="flex justify-center">
          <button type="button" onClick={regenerar} disabled={regenerando} className="btn-secondary !w-auto">
            <RefreshCw size={18} aria-hidden="true" /> {regenerando ? 'Regenerando...' : 'Gerar nova versão (0,5)'}
          </button>
        </div>
      </main>
    </>
  );
}
