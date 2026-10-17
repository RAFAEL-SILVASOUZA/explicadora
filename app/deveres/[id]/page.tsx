'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Frown } from 'lucide-react';
import Header from '@/components/Header';
import Mascote from '@/components/Mascote';
import CanvasExplicacao from '@/components/deveres/CanvasExplicacao';
import ControlesDever from '@/components/deveres/ControlesDever';
import TranscricaoDever from '@/components/deveres/TranscricaoDever';
import { tituloDoDever } from '@/components/deveres/DeverGrid';
import { apiFetch, lerToken } from '@/lib/client/api';
import { carregarAudioDever } from '@/lib/client/audio';
import { duracaoDoPasso } from '@/lib/deveres/timeline';
import type { Cena } from '@/lib/deveres/cena';
import type { DeverCompleto } from '@/lib/types';

export default function DeverDetalhe({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [dados, setDados] = useState<DeverCompleto | null>(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [chaveReinicio, setChaveReinicio] = useState(0);
  const [mostrarTranscricao, setMostrarTranscricao] = useState(false);
  const [movimentoReduzido, setMovimentoReduzido] = useState(false);
  // Elemento de áudio do passo atual, exposto para play/pause/repetir vindos dos controles.
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!lerToken()) {
      router.replace('/login');
      return;
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMovimentoReduzido(mq.matches);
    const ouvir = (e: MediaQueryListEvent) => setMovimentoReduzido(e.matches);
    mq.addEventListener('change', ouvir);
    return () => mq.removeEventListener('change', ouvir);
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

  const passo = dados?.passos[indice] ?? null;
  const duracaoMs = useMemo(
    () => (passo ? duracaoDoPasso({ narracao: passo.narracao, duracao_ms: passo.duracao_ms }) : 0),
    [passo],
  );

  // Áudio: baixado autenticado e tocado por object URL. Guardado em ref para
  // revogar quando o passo muda ou o componente desmonta.
  useEffect(() => {
    if (!passo) return;
    let url: string | null = null;
    let audio: HTMLAudioElement | null = null;
    let cancelado = false;

    setTocando(false);
    setChaveReinicio((c) => c + 1);

    if (passo.audio_path) {
      carregarAudioDever(params.id, passo.ordem).then((u) => {
        if (cancelado) {
          // A object URL foi criada depois do cleanup: revogamos aqui para não vazar.
          if (u) URL.revokeObjectURL(u);
          return;
        }
        if (!u) return;
        url = u;
        audio = new Audio(u);
        audioRef.current = audio;
        audio.addEventListener('ended', () => setTocando(false));
        audio.play().then(() => setTocando(true)).catch(() => setTocando(false));
      });
    } else if (passo.duracao_ms === null) {
      // Sem áudio: o desenho roda pelo tempo estimado e para sozinho.
      setTocando(true);
      const t = setTimeout(() => setTocando(false), duracaoMs);
      return () => clearTimeout(t);
    }

    return () => {
      cancelado = true;
      if (audio) { audio.pause(); audio.src = ''; }
      if (url) URL.revokeObjectURL(url);
      audioRef.current = null;
    };
  }, [params.id, indice, passo, duracaoMs]);

  // Atalhos de teclado: espaço e setas. A criança (e o pai) controla sem mouse.
  useEffect(() => {
    const teclas = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); alternar(); }
      if (e.code === 'ArrowRight') irPara(indice + 1);
      if (e.code === 'ArrowLeft') irPara(indice - 1);
    };
    window.addEventListener('keydown', teclas);
    return () => window.removeEventListener('keydown', teclas);
  });

  function irPara(novo: number) {
    if (!dados || novo < 0 || novo >= dados.passos.length) return;
    setIndice(novo);
  }

  function alternar() {
    // Pausa/retoma também o áudio real; sem isso a fala continua com o desenho congelado.
    if (tocando) {
      audioRef.current?.pause();
    } else {
      audioRef.current?.play().catch(() => {});
    }
    setTocando((atual) => !atual);
    setChaveReinicio((c) => c + 1);
  }

  function repetir() {
    // "Repetir este passo" refaz o desenho e o áudio do início (spec §5).
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    setChaveReinicio((c) => c + 1);
  }

  if (carregando) {
    return (
      <>
        <Header />
        <main className="max-w-3xl mx-auto px-4 py-8">
          <div className="card"><p className="text-2xl font-extrabold text-ink">Carregando o dever...</p></div>
        </main>
      </>
    );
  }

  if (erro || !dados || !passo) {
    return (
      <>
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-8">
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

  const cena = (passo.cena ?? { fundo: '#FDF6EC', primitivos: [] }) as Cena;

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <Mascote humor="feliz" className="w-12 h-12 shrink-0" decorative />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-extrabold text-primary truncate">{tituloDoDever(dados.dever)}</h1>
            <p className="text-ink/60 text-sm">{dados.dever.disciplina || 'Dever de casa'}</p>
          </div>
        </div>

        <p aria-live="polite" className="text-2xl font-extrabold text-ink">{passo.titulo}</p>

        <CanvasExplicacao
          cena={cena}
          duracaoMs={duracaoMs}
          tocando={tocando}
          chaveReinicio={chaveReinicio}
          movimentoReduzido={movimentoReduzido}
        />

        <ControlesDever
          tocando={tocando}
          passoAtual={indice + 1}
          totalPassos={dados.passos.length}
          temTranscricao
          onPlayPause={alternar}
          onAnterior={() => irPara(indice - 1)}
          onProximo={() => irPara(indice + 1)}
          onRepetir={repetir}
          onAbrirTranscricao={() => setMostrarTranscricao((v) => !v)}
        />

        {mostrarTranscricao && (
          <section aria-label="Texto da explicação">
            <TranscricaoDever passos={dados.passos} />
          </section>
        )}

        {dados.dever.resumo_para_pais && (
          <section className="card">
            <h2 className="font-extrabold text-ink mb-2">Para o responsável</h2>
            <p className="text-ink/70">{dados.dever.resumo_para_pais}</p>
          </section>
        )}

        <Link href="/deveres" className="btn-secondary !w-auto block text-center">Voltar para os deveres</Link>
      </main>
    </>
  );
}
