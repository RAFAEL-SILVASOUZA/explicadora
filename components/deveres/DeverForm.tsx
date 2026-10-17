'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Plus, Sparkles, Trash2 } from 'lucide-react';
import LoadingQuestoes from '@/components/LoadingQuestoes';
import { MAX_IMAGENS } from '@/lib/constantes';
import { apiFetch } from '@/lib/client/api';
import { notificarSaldo } from '@/lib/client/saldo';
import { guardarTentativaDever, lerTentativaDever, limparTentativaDever } from '@/lib/client/tentativaDever';

export default function DeverForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoArquivos, setAvisoArquivos] = useState('');
  const [retomando, setRetomando] = useState(() => lerTentativaDever() !== null);

  // Retomada: a geração é longa e o pai pode sair no meio. Se o servidor
  // commitou, o dever já existe: redireciona em vez de mostrar o form.
  useEffect(() => {
    const chave = lerTentativaDever();
    if (!chave) return;
    apiFetch('/api/deveres')
      .then(async (r) => {
        if (!r.ok) { setRetomando(false); return; }
        const lista = await r.json();
        const encontrada = lista.find((linha: { id: string; chave_idempotencia?: string }) =>
          linha.chave_idempotencia === chave);
        if (encontrada) {
          limparTentativaDever();
          router.replace(`/deveres/${encontrada.id}`);
        } else {
          setRetomando(false);
        }
      })
      .catch(() => setRetomando(false));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (carregando || (!texto.trim() && arquivos.length === 0)) return;
    setCarregando(true);
    setErro('');

    const chave = crypto.randomUUID();
    guardarTentativaDever(chave);

    const formData = new FormData();
    formData.append('texto', texto.trim());
    for (const file of arquivos) formData.append('arquivos', file);

    try {
      const res = await apiFetch('/api/dever', {
        method: 'POST',
        headers: { 'X-Idempotency-Key': chave },
        body: formData,
      });
      if (res.status === 402) {
        setErro((await res.json()).error);
        setCarregando(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      limparTentativaDever();
      notificarSaldo();
      router.push(`/deveres/${data.id}`);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Algo deu errado. Tente novamente.');
      setCarregando(false);
    }
  };

  if (carregando || retomando) {
    return (
      <div>
        <LoadingQuestoes />
        <p className="text-center text-ink/60 text-lg -mt-4">
          A Lia está olhando o dever e preparando os desenhos. Isso pode levar um minuto.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="dever-enunciado" className="block text-xl font-semibold text-ink mb-2">
          Escreva o enunciado (opcional)
        </label>
        <textarea
          id="dever-enunciado"
          name="dever-enunciado"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Se a letra estiver difícil de ler, escreva o enunciado aqui..."
          className="input h-32 resize-y"
        />
      </div>

      <div className="bg-white rounded-2xl border-2 border-dashed border-ink/20 p-4 sm:p-6">
        <label htmlFor="dever-arquivos" className="block text-xl font-semibold text-ink mb-2">
          Fotos e PDFs do dever
        </label>
        <p id="ajuda-dever" className="text-ink/70 mb-4">
          Fotografe cada página do dever com boa luz e letra legível. Adicione um arquivo por vez ou vários juntos.
        </p>
        <input
          ref={inputRef}
          id="dever-arquivos"
          name="dever-arquivos"
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.webp,.pdf"
          aria-describedby="ajuda-dever"
          tabIndex={-1}
          onChange={(e) => {
            const selecionados = Array.from(e.target.files || []);
            e.target.value = '';
            if (!selecionados.length) return;
            let imagens = arquivos.filter((f) => !f.name.toLowerCase().endsWith('.pdf')).length;
            let excedentes = 0;
            let invalidos = 0;
            const aceitos = selecionados.filter((file) => {
              if (!/\.(png|jpe?g|webp|pdf)$/i.test(file.name)) { invalidos++; return false; }
              if (file.name.toLowerCase().endsWith('.pdf')) return true;
              if (imagens >= MAX_IMAGENS) { excedentes++; return false; }
              imagens++;
              return true;
            });
            setArquivos((anteriores) => [...anteriores, ...aceitos]);
            setAvisoArquivos([
              excedentes ? `Máximo de ${MAX_IMAGENS} imagens no total. ${excedentes} imagem(ns) não adicionada(s).` : '',
              invalidos ? 'Alguns arquivos não foram adicionados. Use PNG, JPG, WEBP ou PDF.' : '',
            ].filter(Boolean).join(' '));
            setErro('');
          }}
          className="sr-only"
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary !w-auto !text-lg !py-3 focus-visible:outline-offset-4">
          <Plus size={22} aria-hidden="true" />
          {arquivos.length ? 'Adicionar mais arquivos' : 'Adicionar fotos ou PDFs'}
        </button>
        <p className="text-sm text-ink/50 mt-3">PNG, JPG, WEBP e PDF. Até {MAX_IMAGENS} imagens no total.</p>
        <p role="status" className="text-ink mt-4 font-medium">
          {arquivos.length === 0
            ? 'Nenhum arquivo adicionado ainda.'
            : arquivos.length === 1 ? '1 arquivo adicionado' : `${arquivos.length} arquivos adicionados`}
        </p>
        {arquivos.length > 0 && (
          <ul className="mt-3 space-y-2" aria-label="Arquivos adicionados">
            {arquivos.map((file, index) => (
              <li key={index} className="flex items-center gap-3 rounded-xl bg-ink/5 p-3">
                <Camera size={24} className="shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-ink break-all">{file.name}</p>
                  <p className="text-sm text-ink/50">{Math.max(1, Math.ceil(file.size / 1024))} KB</p>
                </div>
                <button type="button" aria-label={`Remover ${file.name}`} onClick={() => {
                  setArquivos((anteriores) => anteriores.filter((_, i) => i !== index));
                  setAvisoArquivos('');
                }} className="shrink-0 p-3 rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-offset-2">
                  <Trash2 size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {avisoArquivos && <p role="alert" className="text-amber-700 mt-2">{avisoArquivos}</p>}
      </div>

      {erro && (
        <div role="alert" className="bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger text-lg font-semibold">
          {erro}
        </div>
      )}

      <p className="text-ink/70 text-center">
        A Lia explica o dever em desenhos e áudio. Ela nunca entrega a resposta: explica o caminho para a criança fazer sozinha.
      </p>
      <button type="submit" disabled={carregando || (!texto.trim() && arquivos.length === 0)} className="btn-primary">
        <Sparkles size={24} aria-hidden="true" /> Explicar o dever
      </button>
    </form>
  );
}
