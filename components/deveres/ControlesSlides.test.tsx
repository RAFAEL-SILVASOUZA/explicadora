import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ControlesSlides from '@/components/deveres/ControlesSlides';

afterEach(() => cleanup());

test('mostra a posição atual e desabilita nas pontas', () => {
  render(<ControlesSlides slideAtual={1} totalSlides={3} onAnterior={vi.fn()} onProximo={vi.fn()} />);
  expect(screen.getByText('Slide 1 de 3')).toBeTruthy();
  expect((screen.getByLabelText('Slide anterior') as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByLabelText('Próximo slide') as HTMLButtonElement).disabled).toBe(false);
});

test('emite os eventos de navegação', () => {
  const onAnterior = vi.fn();
  const onProximo = vi.fn();
  render(<ControlesSlides slideAtual={2} totalSlides={3} onAnterior={onAnterior} onProximo={onProximo} />);

  fireEvent.click(screen.getByLabelText('Slide anterior'));
  expect(onAnterior).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByLabelText('Próximo slide'));
  expect(onProximo).toHaveBeenCalledTimes(1);
});

test('desabilita o próximo no último slide', () => {
  render(<ControlesSlides slideAtual={3} totalSlides={3} onAnterior={vi.fn()} onProximo={vi.fn()} />);
  expect((screen.getByLabelText('Próximo slide') as HTMLButtonElement).disabled).toBe(true);
});
