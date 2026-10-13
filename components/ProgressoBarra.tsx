export default function ProgressoBarra({ atual, total }: { atual: number; total: number }) {
  const percentual = total > 0 ? (atual / total) * 100 : 0;
  const marcos = [25, 50, 75, 100];

  return (
    <div className="w-full mb-6">
      <div className="flex justify-between items-baseline text-lg font-semibold text-ink/70 mb-2">
        <span>Questão {atual} de {total}</span>
        {/* O percentual é informação, não título: peso menor que o contador de questão. */}
        <span className="text-base text-ink/50">{Math.round(percentual)}%</span>
      </div>

      <div className="relative w-full h-4 bg-primary-light rounded-full"
        role="progressbar" aria-valuenow={Math.round(percentual)} aria-valuemin={0} aria-valuemax={100}
        aria-label={`Progresso: questão ${atual} de ${total}`}>
        <div
          className="absolute inset-0 h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentual}%` }}
        />
        {/* Marcos de quarto: a criança vê o caminho que falta, não só o que passou.
            Camada acima do preenchimento, sem overflow-hidden, senão o marco de 100% é cortado. */}
        <div className="absolute inset-0" aria-hidden="true">
          {marcos.map((m) => (
            <span
              key={m}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-primary/30"
              style={{ left: `${m}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
