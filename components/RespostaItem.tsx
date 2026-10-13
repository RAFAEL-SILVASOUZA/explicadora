import { Check, X } from 'lucide-react';
import { Questao, Resposta } from '@/lib/types';

export default function RespostaItem({
  questao, resposta, numero,
}: { questao: Questao; resposta: Resposta | null; numero: number }) {
  return (
    <li className={`card ${resposta ? (resposta.correto ? 'border-2 border-success/40' : 'border-2 border-danger/40') : 'border-2 border-ink/15'}`}>
      <div className="flex items-start gap-3">
        <span className="chip">{numero}</span>
        <div className="min-w-0">
          <p className="text-lg font-bold text-ink mb-3">{questao.enunciado}</p>

          {questao.opcoes.length > 0 && (
            <ul className="mb-3 space-y-1 text-ink/70">
              {questao.opcoes.map((opcao, i) => (
                <li key={i}>{String.fromCharCode(65 + i)}) {opcao}</li>
              ))}
            </ul>
          )}

          {resposta ? (
            <>
              <p className="mb-3">
                <span className="font-semibold text-ink/70">Sua resposta: </span>
                <span className="font-bold text-ink">{resposta.resposta_dada}</span>
                {' '}
                {resposta.correto ? (
                  <span className="badge bg-success-light text-success-ink">
                    <Check size={16} aria-hidden="true" /> Acertou
                  </span>
                ) : (
                  <span className="badge bg-danger-light text-danger-ink">
                    <X size={16} aria-hidden="true" /> Errou · correta: {questao.resposta_correta}
                  </span>
                )}
              </p>
              <p className="text-ink/80">{resposta.explicacao}</p>
            </>
          ) : (
            <p className="text-ink/60">Não respondida.</p>
          )}
        </div>
      </div>
    </li>
  );
}
