'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { guardarToken } from '@/lib/client/api';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    // fetch puro, não apiFetch (Ruling Z): apiFetch redireciona para /login em 401,
    // o que recarregaria esta mesma página a cada senha errada. Aqui não há token a
    // enviar, então fetch simples é o correto.
    const res = await fetch('/api/auth/login', {
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
      <form onSubmit={entrar} className="w-full max-w-md bg-white p-6 rounded-xl shadow space-y-4">
        <h1 className="text-2xl font-bold">Entrar</h1>
        <label htmlFor="email" className="block text-lg">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg" />
        <label htmlFor="senha" className="block text-lg">Senha</label>
        <input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)}
          className="w-full border rounded-lg p-3 text-lg" />
        <button className="w-full bg-blue-600 text-white rounded-lg p-3 text-lg">Entrar</button>
        {erro && <p className="text-red-600">{erro}</p>}
        <p><a href="/cadastro">Criar conta free (3 revisões)</a></p>
      </form>
    </main>
  );
}
