import type { Primitivo } from './cena';
import type { PrimitivoAnimada } from './animacao';

export interface Dimensoes {
  largura: number;
  altura: number;
  // Família resolvida em tempo real (o canvas não aceita var() em ctx.font).
  familiaFonte?: string;
}

export const FONTE_PADRAO = 'system-ui, sans-serif';

// Pisos em pixels REAIS. O tamanho do texto vem normalizado (0..1 da altura),
// então num canvas de celular (~270px de altura) um 0,035 viraria ~9px: a criança
// não lê. O piso não acompanha o canvas, acompanha o olho.
export const FONTE_MINIMA_TEXTO = 15;
export const FONTE_MINIMA_EMOJI = 20;
export const FONTE_MINIMA_ROTULO = 12;

export function px(valor: number, dimensao: number): number {
  const v = Math.min(1, Math.max(0, valor));
  return v * dimensao;
}

// Converte tamanho normalizado em pixels aplicando o piso de legibilidade.
export function tamanhoDeFonte(tamanhoNormalizado: number, altura: number, minimoPx: number): number {
  return Math.max(px(tamanhoNormalizado, altura), minimoPx);
}

// Animação "desenhar" traça a linha progressivamente: o ponto final é
// interpolado entre origem e destino.
export function pontoDoTraco(origem: number, destino: number, progresso: number): number {
  return origem + (destino - origem) * Math.min(1, Math.max(0, progresso));
}

function escala(item: PrimitivoAnimada): number {
  if (item.primitivo.animacao === 'crescer' || item.primitivo.animacao === 'pular') {
    return 0.6 + 0.4 * item.progresso;
  }
  return 1;
}

function opacidade(item: PrimitivoAnimada): number {
  return item.primitivo.animacao === 'fade' ? item.progresso : 1;
}

// ctx.font não resolve var(): receber "var(--font-nunito, ...)" faz a atribuição
// ser rejeitada e o texto sair com a fonte da primitiva desenhada antes. A família
// chega pronta em Dimensoes.familiaFonte, lida do CSS em tempo real.
function familia(d: Dimensoes): string {
  const f = d.familiaFonte?.trim();
  return f && f.length > 0 ? f : FONTE_PADRAO;
}

export function desenharFundo(ctx: CanvasRenderingContext2D, cor: string, d: Dimensoes): void {
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, d.largura, d.altura);
}

function texto(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'texto' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const tamanho = tamanhoDeFonte(p.tamanho, d.altura, FONTE_MINIMA_TEXTO) * escala(item);
  ctx.font = `700 ${tamanho}px ${familia(d)}`;
  ctx.fillStyle = p.cor;
  ctx.globalAlpha = opacidade(item);
  ctx.textAlign = p.alinhamento === 'centro' ? 'center' : p.alinhamento === 'direita' ? 'right' : 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.valor, px(p.x, d.largura), px(p.y, d.altura));
  ctx.globalAlpha = 1;
}

function emoji(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'emoji' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const tamanho = tamanhoDeFonte(p.tamanho, d.altura, FONTE_MINIMA_EMOJI) * escala(item);
  ctx.font = `${tamanho}px ${familia(d)}`;
  ctx.globalAlpha = opacidade(item);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.valor, px(p.x, d.largura), px(p.y, d.altura));
  ctx.globalAlpha = 1;
}

function retaNumerica(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'reta_numerica' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const x0 = px(p.x, d.largura);
  const w = px(p.w, d.largura);
  const y = px(p.y, d.altura);
  const fim = pontoDoTraco(x0, x0 + w, item.progresso);

  ctx.strokeStyle = p.cor;
  ctx.lineWidth = Math.max(2, d.altura * 0.006);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.lineTo(fim, y);
  ctx.stroke();

  const intervalo = p.maximo - p.minimo || 1;
  for (const marca of p.marcas) {
    const mx = x0 + ((marca - p.minimo) / intervalo) * w;
    if (mx > fim) continue;
    ctx.beginPath();
    ctx.moveTo(mx, y - d.altura * 0.02);
    ctx.lineTo(mx, y + d.altura * 0.02);
    ctx.stroke();
    ctx.fillStyle = '#2D2A3E';
    ctx.font = `600 ${tamanhoDeFonte(0.03, d.altura, FONTE_MINIMA_ROTULO)}px ${familia(d)}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(String(marca), mx, y + d.altura * 0.03);
  }

  if (p.destaque !== undefined) {
    const dx = x0 + ((p.destaque - p.minimo) / intervalo) * w;
    if (dx <= fim) {
      ctx.fillStyle = '#FF8A3D';
      ctx.beginPath();
      ctx.arc(dx, y, d.altura * 0.022, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function barraModelo(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'barra_modelo' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const x0 = px(p.x, d.largura);
  const y0 = px(p.y, d.altura);
  const w = px(p.w, d.largura) * item.progresso;
  const h = px(p.h, d.altura);
  const total = p.partes.reduce((s, parte) => s + parte.valor, 0) || 1;

  let cursor = x0;
  for (const parte of p.partes) {
    const largura = (parte.valor / total) * w;
    ctx.fillStyle = parte.cor ?? '#7C5CFC';
    ctx.fillRect(cursor, y0, largura, h);
    if (parte.rotulo && largura > d.largura * 0.03) {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `700 ${tamanhoDeFonte(0.035, d.altura, FONTE_MINIMA_ROTULO)}px ${familia(d)}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(parte.rotulo, cursor + largura / 2, y0 + h / 2);
    }
    cursor += largura;
  }
}

function balanca(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'balanca' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const cx = px(p.x, d.largura);
  const cy = px(p.y, d.altura);
  const w = px(p.w, d.largura);
  const angulo = (p.inclinacao * Math.PI) / 180 * item.progresso;

  ctx.strokeStyle = p.cor;
  ctx.lineWidth = Math.max(2, d.altura * 0.008);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy + d.altura * 0.12);
  ctx.stroke();

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angulo);
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.stroke();
  ctx.fillStyle = '#2D2A3E';
  ctx.font = `700 ${tamanhoDeFonte(0.035, d.altura, FONTE_MINIMA_ROTULO)}px ${familia(d)}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(p.prato_esquerdo.join(' + '), -w / 2, -d.altura * 0.01);
  ctx.fillText(p.prato_direito.join(' + '), w / 2, -d.altura * 0.01);
  ctx.restore();
}

function blocos(ctx: CanvasRenderingContext2D, p: Extract<Primitivo, { kind: 'blocos' }>, d: Dimensoes, item: PrimitivoAnimada): void {
  const x0 = px(p.x, d.largura);
  const y0 = px(p.y, d.altura);
  const lado = d.altura * 0.06;
  const espacamento = lado * 0.3;

  for (let i = 0; i < p.itens; i++) {
    // Só o bloco cujo "nascimento" já passou pelo progresso: a contagem aparece
    // junto da fala, não de uma vez.
    const nascimento = i / Math.max(1, p.itens);
    if (nascimento > item.progresso) break;
    const linha = Math.floor(i / p.colunas);
    const coluna = i % p.colunas;
    const bx = x0 + coluna * (lado + espacamento);
    const by = y0 + linha * (lado + espacamento);
    ctx.fillStyle = p.cor;
    if (p.tipo === 'moeda') {
      ctx.beginPath();
      ctx.arc(bx + lado / 2, by + lado / 2, lado / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(bx, by, lado, lado);
    }
  }
}

export function desenharPrimitiva(
  ctx: CanvasRenderingContext2D, item: PrimitivoAnimada, d: Dimensoes,
): void {
  const p = item.primitivo;
  switch (p.kind) {
    case 'retangulo': {
      const e = escala(item);
      ctx.globalAlpha = opacidade(item);
      ctx.fillStyle = p.cor;
      const w = px(p.w, d.largura) * e;
      const h = px(p.h, d.altura) * e;
      const x = px(p.x, d.largura) - w / 2;
      const y = px(p.y, d.altura) - h / 2;
      if (p.raio > 0 && typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, px(p.raio, d.altura));
        ctx.fill();
      } else {
        ctx.fillRect(x, y, w, h);
      }
      ctx.globalAlpha = 1;
      return;
    }
    case 'circulo': {
      ctx.globalAlpha = opacidade(item);
      ctx.fillStyle = p.cor;
      ctx.beginPath();
      ctx.arc(px(p.x, d.largura), px(p.y, d.altura), px(p.r, d.altura) * escala(item), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    case 'linha':
    case 'seta': {
      const x1 = px(p.x, d.largura);
      const y1 = px(p.y, d.altura);
      const x2 = pontoDoTraco(x1, px(p.x2, d.largura), item.progresso);
      const y2 = pontoDoTraco(y1, px(p.y2, d.altura), item.progresso);
      ctx.strokeStyle = p.cor;
      ctx.lineWidth = Math.max(2, px(p.espessura, d.altura));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (p.kind === 'seta' && item.progresso > 0.9) {
        const angulo = Math.atan2(y2 - y1, x2 - x1);
        const cabeca = d.altura * 0.025;
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - cabeca * Math.cos(angulo - 0.5), y2 - cabeca * Math.sin(angulo - 0.5));
        ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - cabeca * Math.cos(angulo + 0.5), y2 - cabeca * Math.sin(angulo + 0.5));
        ctx.stroke();
      }
      return;
    }
    case 'texto': return texto(ctx, p, d, item);
    case 'emoji': return emoji(ctx, p, d, item);
    case 'reta_numerica': return retaNumerica(ctx, p, d, item);
    case 'barra_modelo': return barraModelo(ctx, p, d, item);
    case 'balanca': return balanca(ctx, p, d, item);
    case 'blocos': return blocos(ctx, p, d, item);
    case 'destaque': {
      // Pulso: a opacidade oscila com o progresso, para apontar sem cobrir.
      const pulso = 0.25 + 0.25 * Math.sin(item.progresso * Math.PI * 2);
      ctx.globalAlpha = pulso;
      ctx.fillStyle = '#FF8A3D';
      ctx.fillRect(px(p.x, d.largura), px(p.y, d.altura), px(p.w, d.largura), px(p.h, d.altura));
      ctx.globalAlpha = 1;
      return;
    }
  }
}
