'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarToken } from '@/lib/client/api';

export default function Cadastro() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    // fetch puro, não apiFetch (Ruling Z): um 409/400 não redireciona e um 401 aqui
    // recarregaria a página em loop. Não há token a enviar.
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, senha }),
    });
    if (!res.ok) { setErro((await res.json()).error); return; }
    const { token } = await res.json();
    guardarToken(token);
    router.push('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={cadastrar} className="w-full max-w-md bg-white p-6 rounded-xl shadow space-y-4">
        <h1 className="text-2xl font-bold">Criar conta</h1>
        <p className="text-lg">Conta free: 3 revisões. Quando acabarem, você precisa de um token.</p>
        <label htmlFor="email" className="block text-lg">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg" />
        <label htmlFor="senha" className="block text-lg">Senha</label>
        <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg" />
        <button className="w-full bg-blue-600 text-white rounded-lg p-3 text-lg">Cadastrar</button>
        {erro && <p className="text-red-600">{erro}</p>}
        <p><a href="/login">Já tenho conta</a></p>
      </form>
    </main>
  );
}
