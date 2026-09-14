export default function ProgressoBarra({ atual, total }: { atual: number; total: number }) {
  const percentual = total > 0 ? (atual / total) * 100 : 0;
  return (
    <div className="w-full mb-6">
      <div className="flex justify-between text-lg font-semibold text-gray-700 mb-2">
        <span>Questão {atual} de {total}</span>
        <span>{Math.round(percentual)}%</span>
      </div>
      <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${percentual}%` }}
        />
      </div>
    </div>
  );
}
