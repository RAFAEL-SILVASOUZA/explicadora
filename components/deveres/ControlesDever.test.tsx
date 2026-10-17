import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ControlesDever from '@/components/deveres/ControlesDever';

const props = () => ({
  tocando: false, passoAtual: 1, totalPassos: 3, temTranscricao: true,
  onPlayPause: vi.fn(), onAnterior: vi.fn(), onProximo: vi.fn(), onRepetir: vi.fn(),
  onAbrirTranscricao: vi.fn(),
});

afterEach(() => cleanup());

test('mostra o número do passo atual', () => {
  render(<ControlesDever {...props()} />);
  expect(screen.getByText('Passo 1 de 3')).toBeTruthy();
});

test('play dispara onPlayPause', () => {
  const p = props();
  render(<ControlesDever {...p} />);
  // Os regex aceitam o acento: o rótulo acessível é "Ouvir a explicação".
  fireEvent.click(screen.getByRole('button', { name: /ouvir a explica[cç][aã]o/i }));
  expect(p.onPlayPause).toHaveBeenCalledTimes(1);
});

test('repetir dispara onRepetir', () => {
  const p = props();
  render(<ControlesDever {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /repetir este passo/i }));
  expect(p.onRepetir).toHaveBeenCalledTimes(1);
});

test('primeiro passo desabilita o botão anterior', () => {
  render(<ControlesDever {...props()} />);
  expect((screen.getByRole('button', { name: /passo anterior/i }) as HTMLButtonElement).disabled).toBe(true);
});

test('último passo desabilita o próximo', () => {
  render(<ControlesDever {...props()} passoAtual={3} />);
  expect((screen.getByRole('button', { name: /pr[oó]ximo passo/i }) as HTMLButtonElement).disabled).toBe(true);
});

test('abrir transcrição dispara onAbrirTranscricao', () => {
  const p = props();
  render(<ControlesDever {...p} />);
  fireEvent.click(screen.getByRole('button', { name: /ver texto/i }));
  expect(p.onAbrirTranscricao).toHaveBeenCalledTimes(1);
});
