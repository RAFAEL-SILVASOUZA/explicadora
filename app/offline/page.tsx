'use client';

import Header from '@/components/Header';
import Mascote from '@/components/Mascote';

export default function Offline() {
  return (
    <>
      <Header />
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md">
          {/* O emoji era o único lugar do app fora do sistema de design; o mascote já existe
              e tem a expressão "triste" exatamente para este estado. */}
          <div className="flex justify-center mb-6">
            <Mascote humor="triste" className="w-24 h-24" decorative />
          </div>
          <h1 className="text-3xl font-extrabold text-ink mb-4">Ops! Você está offline</h1>
          <p className="text-ink/70 mb-8">
            A Lia precisa de internet para te ajudar nos estudos.
            Verifique sua conexão e tente novamente!
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary !w-auto"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    </>
  );
}
