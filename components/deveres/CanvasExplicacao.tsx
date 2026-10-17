'use client';

import { useEffect, useRef } from 'react';
import type { Cena } from '@/lib/deveres/cena';
import { estadoDoPasso } from '@/lib/deveres/animacao';
import { desenharFundo, desenharPrimitiva } from '@/lib/deveres/desenho';
import { progressoDoPasso } from '@/lib/deveres/timeline';

interface Props {
  cena: Cena;
  duracaoMs: number;
  tocando: boolean;
  // Mudar esta chave zera o relógio: é como "repetir este passo" refaz o desenho.
  chaveReinicio: number;
  movimentoReduzido: boolean;
}

export default function CanvasExplicacao({ cena, duracaoMs, tocando, chaveReinicio, movimentoReduzido }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inicioRef = useRef<number | null>(null);
  const acumuladoRef = useRef(0);

  useEffect(() => {
    acumuladoRef.current = 0;
    inicioRef.current = null;
  }, [chaveReinicio]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let quadro = 0;
    let anterior = 0;

    const pintar = () => {
      const dpr = window.devicePixelRatio || 1;
      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      // Canvas desfoca sem escalar o bitmap pelo DPR.
      if (canvas.width !== largura * dpr || canvas.height !== altura * dpr) {
        canvas.width = largura * dpr;
        canvas.height = altura * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      desenharFundo(ctx, cena.fundo, { largura, altura });
      const progresso = progressoDoPasso(acumuladoRef.current, duracaoMs);
      for (const item of estadoDoPasso(cena, progresso, movimentoReduzido)) {
        desenharPrimitiva(ctx, item, { largura, altura });
      }
    };

    const tick = (agora: number) => {
      if (tocando) {
        if (inicioRef.current === null) inicioRef.current = agora;
        acumuladoRef.current += agora - (anterior || agora);
      }
      anterior = agora;
      pintar();
      quadro = requestAnimationFrame(tick);
    };

    quadro = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(quadro);
  }, [cena, duracaoMs, tocando, movimentoReduzido]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full rounded-3xl bg-white border-2 border-primary/15"
      style={{ aspectRatio: '4 / 3', touchAction: 'none' }}
    />
  );
}
