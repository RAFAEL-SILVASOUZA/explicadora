export default function ProgressoBarra({ atual, total }: { atual: number; total: number }) {
  const percentual = total > 0 ? (atual / total) * 100 : 0;
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between text-lg font-semibold text-ink/70 mb-2">
        <span>Questão {atual} de {total}</span>
        <span>{Math.round(percentual)}%</span>
      </div>
      <div className="w-full h-4 bg-primary-light rounded-full overflow-hidden"
        role="progressbar" aria-valuenow={Math.round(percentual)} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Progresso: questão ${atual} de ${total}`}>
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}
