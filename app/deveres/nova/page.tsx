import { Camera } from 'lucide-react';
import Header from '@/components/Header';
import DeverForm from '@/components/deveres/DeverForm';

export default function NovoDever() {
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary flex items-center gap-2">
          <Camera size={28} aria-hidden="true" /> Novo dever
        </h1>
        <div className="card">
          <DeverForm />
        </div>
      </main>
    </>
  );
}
