'use client';

import { useEffect, useRef } from 'react';
import type { Cena } from '@/lib/deveres/cena';
import { estadoDoPasso } from '@/lib/deveres/animacao';
import { desenharFundo, desenharPrimitiva, FONTE_PADRAO, type Dimensoes } from '@/lib/deveres/desenho';
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

    // A família vem do CSS (Nunito via next/font). O canvas não entende var(),
    // então lemos o valor resolvido do próprio elemento.
    const lerFamilia = () => getComputedStyle(canvas).fontFamily || FONTE_PADRAO;
    let familiaFonte = lerFamilia();
    // next/font injeta a fonte depois do primeiro frame: sem isso o primeiro
    // desenho sairia com o fallback.
    document.fonts?.ready.then(() => { familiaFonte = lerFamilia(); }).catch(() => {});

    const pintar = () => {
      // Piso 1: com zoom do navegador o DPR cai abaixo de 1 (ex.: 0.9) e o bitmap
      // ficaria MENOR que o tamanho exibido, esticado e borrado.
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const largura = canvas.clientWidth;
      const altura = canvas.clientHeight;
      // Canvas desfoca sem escalar o bitmap pelo DPR.
      if (canvas.width !== Math.round(largura * dpr) || canvas.height !== Math.round(altura * dpr)) {
        canvas.width = Math.round(largura * dpr);
        canvas.height = Math.round(altura * dpr);
        familiaFonte = lerFamilia();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const d: Dimensoes = { largura, altura, familiaFonte };
      desenharFundo(ctx, cena.fundo, d);
      const progresso = progressoDoPasso(acumuladoRef.current, duracaoMs);
      for (const item of estadoDoPasso(cena, progresso, movimentoReduzido)) {
        desenharPrimitiva(ctx, item, d);
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
      className="canvas-dever w-full mx-auto rounded-3xl bg-white border-2 border-primary/15 aspect-square sm:aspect-[4/3]"
      style={{ touchAction: 'none' }}
    />
  );
}
