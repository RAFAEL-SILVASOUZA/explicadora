import { FileText } from 'lucide-react';
import RevisaoForm from '@/components/RevisaoForm';

export default function RevisaoPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-primary mb-6">
          <FileText size={32} className="inline mr-2" /> Criar Revisão
        </h1>
        <RevisaoForm />
      </div>
    </main>
  );
}
