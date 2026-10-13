'use client';

import { useRef, useState, useEffect } from 'react';
import { X, Eraser, Send } from 'lucide-react';

interface CanvasModalProps {
  onClose: () => void;
  onSend: (base64: string) => void;
}

export default function CanvasModal({ onClose, onSend }: CanvasModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  };
  
  const sendDrawing = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/png').split(',')[1];
    onSend(base64);
  };

  // Modal sem fechamento por teclado é armadilha: quem abriu com a mão fecha com o Esc.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-ink/50 flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg" role="dialog" aria-modal="true" aria-label="Desenhar fórmula" tabIndex={-1} autoFocus>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-extrabold text-ink">Desenhar fórmula</h3>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-2 rounded-full hover:bg-primary-light focus-visible:outline-offset-2">
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={500}
          height={350}
          className="w-full border-2 border-ink/15 rounded-xl cursor-crosshair touch-none"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />

        <div className="flex gap-3 mt-4">
          <button type="button" onClick={clearCanvas} className="btn-secondary !py-3">
            <Eraser size={20} aria-hidden="true" />
            Limpar
          </button>
          <button type="button" onClick={sendDrawing} disabled={!hasContent} className="btn-primary">
            <Send size={20} aria-hidden="true" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}
