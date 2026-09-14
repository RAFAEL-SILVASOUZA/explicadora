import { PartyPopper, BookOpen } from 'lucide-react';

export default function FeedbackResposta({ correto, explicacao, onProxima }: { correto: boolean; explicacao: string; onProxima: () => void }) {
  return (
    <div className={`rounded-2xl shadow-lg p-8 max-w-2xl mx-auto ${correto ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}>
      <div className="mb-4">{correto ? <PartyPopper size={48} className="text-green-600" /> : <BookOpen size={48} className="text-red-600" />}</div>
      <h2 className={`text-2xl font-bold mb-4 ${correto ? 'text-green-700' : 'text-red-700'}`}>
        {correto ? 'Muito bem!' : 'Quase lá!'}
      </h2>
      <p className="text-xl text-gray-700 mb-6">{explicacao}</p>
      <button
        onClick={onProxima}
        className="w-full bg-primary text-white text-xl font-bold py-4 rounded-xl hover:bg-blue-600 transition-colors"
      >
        Próxima Questão →
      </button>
    </div>
  );
}
