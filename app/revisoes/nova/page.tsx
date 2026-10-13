import { FileText } from 'lucide-react';
import Header from '@/components/Header';
import RevisaoForm from '@/components/RevisaoForm';

export default function NovaRevisao() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
          <FileText size={28} aria-hidden="true" /> Nova revisão
        </h1>
        <div className="card">
          <RevisaoForm />
        </div>
      </main>
    </>
  );
}
