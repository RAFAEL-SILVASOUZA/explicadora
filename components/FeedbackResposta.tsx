import { PartyPopper, BookOpen } from 'lucide-react';
import MascoteCoruja from './MascoteCoruja';

export default function FeedbackResposta({
  correto, explicacao, onProxima,
}: { correto: boolean; explicacao: string; onProxima: () => void }) {
  return (
    <div className={`card max-w-2xl mx-auto animate-pop-in ${correto ? 'border-2 border-success/40' : 'border-2 border-secondary/40'}`}>
      <div className="flex items-center gap-3 mb-4">
        <MascoteCoruja humor={correto ? 'celebrando' : 'triste'} className="w-16 h-16 shrink-0" aria-hidden="true" />
        <h2 className={`text-2xl font-extrabold ${correto ? 'text-success' : 'text-secondary'}`}>
          {correto ? 'Muito bem!' : 'Quase lá!'}
        </h2>
      </div>
      <p className="text-xl text-ink/80 mb-6">{explicacao}</p>
      <button type="button" onClick={onProxima} className="btn-primary">
        <PartyPopper size={22} aria-hidden="true" />
        Próxima questão
      </button>
    </div>
  );
}
