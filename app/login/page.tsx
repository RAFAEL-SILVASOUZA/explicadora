'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';
import { guardarToken } from '@/lib/client/api';
import Mascote from '@/components/Mascote';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro('');
    // fetch puro, não apiFetch (Ruling Z): apiFetch redireciona para /login em 401,
    // o que recarregaria esta mesma página a cada senha errada. Aqui não há token a
    // enviar, então fetch simples é o correto.
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Não foi possível entrar.');
        setEnviando(false);
        return;
      }
      guardarToken(data.token);
      // Admin vai direto para a área admin; usuário vai para a home com os planos.
      router.replace(data.conta?.role === 'admin' ? '/admin' : '/');
    } catch {
      setErro('Não foi possível entrar. Verifique sua conexão.');
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <Mascote humor="feliz" className="w-20 h-20 animate-float" decorative />
        </div>
        <form onSubmit={entrar} className="card space-y-4" noValidate>
          <h1 className="text-2xl font-extrabold text-primary">Entrar</h1>
          {/* A promessa de "pontos" não existe no produto (não há placar nem saldo de pontos):
             texto que promete mecânica ausente cria expectativa falsa em criança. */}
          <p className="text-ink/70">Estude e resgate seu pacote.</p>

          <div>
            <label htmlFor="email" className="block text-lg font-semibold mb-1">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="senha" className="block text-lg font-semibold mb-1">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="current-password"
              value={senha} onChange={(e) => setSenha(e.target.value)} required
              className="input" />
          </div>

          {erro && (
            <div role="alert" className="bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger-ink font-semibold">
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando || !email || !senha} aria-busy={enviando || undefined} className="btn-primary">
            <LogIn size={22} aria-hidden="true" />
            {enviando ? 'Entrando...' : 'Entrar'}
          </button>

          <p className="text-center text-ink/70">
            Ainda não tem conta?{' '}
            <Link href="/cadastro" className="font-bold text-primary hover:text-primary-dark">
              Criar conta free (3 revisões)
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
