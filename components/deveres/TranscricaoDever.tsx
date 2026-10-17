'use client';

interface Passo { titulo: string; narracao: string }

// O canvas é decorativo (aria-hidden). Esta é a alternativa textual equivalente,
// exigida para leitor de tela e para a criança que preferir ler.
export default function TranscricaoDever({ passos }: { passos: Passo[] }) {
  return (
    <ol className="space-y-4">
      {passos.map((p, i) => (
        <li key={i} className="card">
          <h3 className="font-extrabold text-ink text-lg mb-1">
            {i + 1}. {p.titulo}
          </h3>
          <p className="text-ink/80">{p.narracao}</p>
        </li>
      ))}
    </ol>
  );
}
