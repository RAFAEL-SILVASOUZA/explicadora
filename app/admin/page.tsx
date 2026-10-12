'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';

interface TokenRow { codigo: string; plano_codigo: string; status: string; expira_em: string; resgatado_por_email: string | null }

export default function Admin() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [plano, setPlano] = useState('pro');
  const [quantidade, setQuantidade] = useState(10);
  const [erro, setErro] = useState('');

  async function carregar() {
    const res = await apiFetch('/api/admin/tokens');
    if (res.status === 403) { setErro('Essa área é só do administrador.'); return; }
    if (!res.ok) return;
    setErro(''); setTokens(await res.json());
  }

  useEffect(() => { carregar(); }, []);

  async function gerar(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch('/api/admin/tokens', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plano_codigo: plano, quantidade }),
    });
    if (!res.ok) { setErro((await res.json()).error); return; }
    setErro(''); carregar();
  }

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Área do administrador</h1>
      <form onSubmit={gerar} className="flex flex-wrap gap-3 items-center">
        <select value={plano} onChange={(e) => setPlano(e.target.value)} className="border rounded-lg p-2">
          <option value="free">Free (3)</option>
          <option value="pro">Pro (20 · R$ 5)</option>
          <option value="familia">Família (50 · R$ 15)</option>
        </select>
        <input type="number" min="1" max="100" value={quantidade}
          onChange={(e) => setQuantidade(Number(e.target.value))} className="border rounded-lg p-2" />
        <button className="bg-blue-600 text-white rounded-lg p-2">Gerar lote</button>
      </form>
      {erro && <p className="text-red-600">{erro}</p>}
      <table className="w-full text-left">
        <thead><tr><th>Código</th><th>Plano</th><th>Status</th><th>Expira</th><th>Resgatado por</th></tr></thead>
        <tbody>
          {tokens.map(t => (
            <tr key={t.codigo}>
              <td className="font-mono">{t.codigo}</td><td>{t.plano_codigo}</td><td>{t.status}</td>
              <td>{new Date(t.expira_em).toLocaleDateString('pt-BR')}</td>
              <td>{t.resgatado_por_email ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
