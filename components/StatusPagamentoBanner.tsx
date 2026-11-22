'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { apiFetch } from '@/lib/client/api';
import { notificarSaldo } from '@/lib/client/saldo';

export default function StatusPagamentoBanner({ onConfirmado }: { onConfirmado?: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  const jaConfirmou = useRef(false);

  // Em ambientes de teste mockados sem useSearchParams implementado, faz fallback gracioso
  let status: string | null = null;
  let orderId: string | null = null;

  try {
    const searchParams = typeof useSearchParams === 'function' ? useSearchParams() : null;
    status = searchParams?.get('status') ?? null;
    orderId = searchParams?.get('order_id') ?? null;
  } catch {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      status = sp.get('status');
      orderId = sp.get('order_id');
    }
  }

  useEffect(() => {
    if (status === 'approved' && orderId && !jaConfirmou.current) {
      jaConfirmou.current = true;
      setConfirmando(true);
      apiFetch('/api/pagamentos/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId }),
      })
        .then((res) => {
          if (res.ok) {
            notificarSaldo();
            onConfirmado?.();
          }
        })
        .catch(console.error)
        .finally(() => setConfirmando(false));
    }
  }, [status, orderId, onConfirmado]);

  if (!status) return null;

  if (status === 'approved') {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-success-ink/30 bg-success-light p-4 text-success-ink flex items-start gap-3"
      >
        <CheckCircle2 size={24} className="shrink-0 mt-0.5 text-success-ink" aria-hidden="true" />
        <div>
          <p className="font-extrabold text-base">Pagamento aprovado com sucesso!</p>
          <p className="text-sm opacity-90">
            {confirmando
              ? 'Confirmando e creditando seu saldo...'
              : 'Seu saldo de revisões foi creditado. Bons estudos!'}
          </p>
        </div>
      </div>
    );
  }

  if (status === 'pending') {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-amber-500/30 bg-amber-50 p-4 text-amber-900 flex items-start gap-3"
      >
        <Clock size={24} className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
        <div>
          <p className="font-extrabold text-base">Pagamento em processamento</p>
          <p className="text-sm opacity-90">
            Se você pagou via PIX ou boleto, assim que a instituição financeira confirmar, seu saldo será creditado automaticamente.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div
        role="alert"
        className="rounded-2xl border-2 border-danger-ink/30 bg-danger-light p-4 text-danger-ink flex items-start gap-3"
      >
        <XCircle size={24} className="shrink-0 mt-0.5 text-danger-ink" aria-hidden="true" />
        <div>
          <p className="font-extrabold text-base">Pagamento não concluído</p>
          <p className="text-sm opacity-90">
            Houve um problema ou o pagamento foi cancelado. Nenhuma cobrança foi efetuada. Você pode tentar novamente quando quiser.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
