import { Bot } from 'lucide-react';

export default function LoadingQuestoes() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="mb-6 animate-bounce"><Bot size={64} /></div>
      <h2 className="text-2xl font-bold text-gray-700 mb-2">O professor está preparando as questões...</h2>
      <p className="text-lg text-gray-500">Isso pode levar alguns segundos</p>
      <div className="mt-6 flex gap-2">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
        <div className="w-3 h-3 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="w-3 h-3 bg-success rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}
