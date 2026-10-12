'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';

interface Movimento { tipo: string; quantidade: number; plano_codigo: string | null; criado_em: string }

interface DadosConta {
  plano: string;
  saldo: number;
  movimentos: Movimento[];
  conta: { role: string };
}

export default function Conta() {
  const [dados, setDados] = useState<DadosConta | null>(null);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');

  async function carregar() {
    const res = await apiFetch('/api/conta');
    if (!res.ok) return;
    setDados(await res.json());
  }

  useEffect(() => { carregar(); }, []);

  async function resgatar(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiFetch('/api/tokens/resgate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ codigo }),
    });
    if (!res.ok) { setErro((await res.json()).error); return; }
    setErro(''); setCodigo('');
    // Desvio do brief: o brief conservava `movimentos: d.movimentos`, então o extrato
    // não mostrava o novo movimento até recarregar a página. A resposta do resgate não
    // traz `criado_em` nem `plano_codigo` do movimento, então reler /api/conta é o que
    // deixa plano, saldo e extrato coerentes.
    await carregar();
  }

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Minha conta</h1>
      <p className="text-lg">Plano: <strong>{dados?.plano}</strong> · Saldo: <strong>{dados?.saldo}</strong> revisões</p>
      <form onSubmit={resgatar} className="space-y-3">
        <label htmlFor="codigo" className="block text-lg">Cole o código do token</label>
        <input id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg font-mono" />
        <button className="bg-green-600 text-white rounded-lg p-3 text-lg">Resgatar token</button>
        {erro && <p className="text-red-600">{erro}</p>}
      </form>
      <table className="w-full text-left">
        <thead><tr><th>Tipo</th><th>Quantidade</th><th>Quando</th></tr></thead>
        <tbody>
          {dados?.movimentos.map((m, i) => (
            <tr key={i}>
              <td>{m.tipo}</td><td>{m.quantidade > 0 ? `+${m.quantidade}` : m.quantidade}</td>
              <td>{new Date(m.criado_em).toLocaleString('pt-BR')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
