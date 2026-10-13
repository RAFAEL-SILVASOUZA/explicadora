'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { guardarToken } from '@/lib/client/api';
import MascoteCoruja from '@/components/MascoteCoruja';

export default function Cadastro() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro('');
    // fetch puro, não apiFetch (Ruling Z): um 409/400 não redireciona e um 401 aqui
    // recarregaria a página em loop. Não há token a enviar.
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, senha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErro(data.error ?? 'Não foi possível criar a conta.');
        setEnviando(false);
        return;
      }
      guardarToken(data.token);
      router.replace(data.conta?.role === 'admin' ? '/admin' : '/');
    } catch {
      setErro('Não foi possível criar a conta. Verifique sua conexão.');
      setEnviando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <MascoteCoruja humor="pensando" className="w-20 h-20 animate-float" aria-hidden="true" />
        </div>
        <form onSubmit={cadastrar} className="card space-y-4" noValidate>
          <h1 className="text-2xl font-extrabold text-primary">Criar conta</h1>
          <p className="text-ink/70">
            Conta free: <strong>3 revisões</strong>. Quando acabarem, você cola o código do pacote contratado.
          </p>

          <div>
            <label htmlFor="email" className="block text-lg font-semibold mb-1">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="senha" className="block text-lg font-semibold mb-1">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="new-password"
              value={senha} onChange={(e) => setSenha(e.target.value)} required
              className="input" />
          </div>

          {erro && (
            <div role="alert" className="bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger font-semibold">
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando || !email || !senha} className="btn-primary">
            <UserPlus size={22} aria-hidden="true" />
            {enviando ? 'Criando conta...' : 'Cadastrar'}
          </button>

          <p className="text-center text-ink/70">
            Já tem conta?{' '}
            <Link href="/login" className="font-bold text-primary hover:text-primary-dark">Entrar</Link>
          </p>
        </form>
      </div>
    </main>
  );
}
