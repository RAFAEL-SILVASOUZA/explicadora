import { Check, X, PartyPopper } from 'lucide-react';
import Mascote from './Mascote';
import Confetti from './Confetti';

export default function FeedbackResposta({
  correto, explicacao, onProxima, isLast = false,
}: {
  correto: boolean;
  explicacao: string;
  onProxima: () => void;
  isLast?: boolean;
}) {
  return (
    <div className={`card max-w-2xl mx-auto animate-pop-in ${correto ? 'border-2 border-success/40' : 'border-2 border-danger/40'}`}>
      {correto && <Confetti />}
      <div className="flex items-center gap-3 mb-4">
        <Mascote
          humor={correto ? 'celebrando' : 'triste'}
          className={`w-16 h-16 shrink-0 ${correto ? 'animate-wiggle' : ''}`}
          decorative
        />
        {/* O ícone repete o veredito: a criança lê o símbolo antes de ler o texto. */}
        {correto ? <Check size={24} className="text-success-ink shrink-0" aria-hidden="true" />
                  : <X size={24} className="text-secondary-ink shrink-0" aria-hidden="true" />}
        <h2 className={`text-2xl font-extrabold ${correto ? 'text-success-ink' : 'text-secondary-ink'}`}>
          {correto ? 'Muito bem!' : 'Quase lá!'}
        </h2>
      </div>
      <p className="text-xl text-ink/80 mb-6">{explicacao}</p>
      <button type="button" onClick={onProxima} className="btn-primary">
        <PartyPopper size={22} aria-hidden="true" />
        {isLast ? 'Ver resultado!' : 'Próxima questão'}
      </button>
    </div>
  );
}
