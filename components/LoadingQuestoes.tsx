import MascoteCoruja from './MascoteCoruja';

export default function LoadingQuestoes() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-6 animate-float">
        <MascoteCoruja humor="pensando" className="w-24 h-24" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-extrabold text-ink mb-2">O professor está preparando as questões...</h2>
      <p className="text-lg text-ink/60">Isso pode levar alguns segundos</p>
      <div className="mt-6 flex gap-2" aria-hidden="true">
        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
        <div className="w-3 h-3 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
        <div className="w-3 h-3 bg-success rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
      </div>
    </div>
  );
}
