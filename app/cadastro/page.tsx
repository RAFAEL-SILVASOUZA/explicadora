'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { guardarToken } from '@/lib/client/api';
import Mascote from '@/components/Mascote';

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [emailConfirmacao, setEmailConfirmacao] = useState('');
  const [senha, setSenha] = useState('');
  const [senhaConfirmacao, setSenhaConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function cadastrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro('');
    // As confirmações são conferidas no cliente por UX; a rota confere de novo.
    if (emailConfirmacao.toLowerCase().trim() !== email.toLowerCase().trim()) {
      setErro('A confirmação de email não casa com o email.');
      setEnviando(false);
      return;
    }
    if (senhaConfirmacao !== senha) {
      setErro('A confirmação de senha não casa com a senha.');
      setEnviando(false);
      return;
    }
    // fetch puro, não apiFetch (Ruling Z): um 409/400 não redireciona e um 401 aqui
    // recarregaria a página em loop. Não há token a enviar.
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nome, sobrenome, email,
          email_confirmacao: emailConfirmacao,
          senha, senha_confirmacao: senhaConfirmacao,
        }),
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

  const completo = nome && sobrenome && email && emailConfirmacao && senha && senhaConfirmacao;

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-4">
          <Mascote humor="pensando" className="w-20 h-20 animate-float" decorative />
        </div>
        <form onSubmit={cadastrar} className="card space-y-4" noValidate>
          <h1 className="text-2xl font-extrabold text-primary">Criar conta</h1>
          <p className="text-ink/70">
            Conta free: <strong>3 revisões</strong>. Quando acabarem, você cola o código do pacote contratado.
          </p>

          <div>
            <label htmlFor="nome" className="block text-lg font-semibold mb-1">Nome</label>
            <input id="nome" name="nome" type="text" autoComplete="given-name"
              value={nome} onChange={(e) => setNome(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="sobrenome" className="block text-lg font-semibold mb-1">Sobrenome</label>
            <input id="sobrenome" name="sobrenome" type="text" autoComplete="family-name"
              value={sobrenome} onChange={(e) => setSobrenome(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="email" className="block text-lg font-semibold mb-1">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="email_confirmacao" className="block text-lg font-semibold mb-1">Confirmação de email</label>
            <input id="email_confirmacao" name="email_confirmacao" type="email" autoComplete="off" inputMode="email"
              value={emailConfirmacao} onChange={(e) => setEmailConfirmacao(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="senha" className="block text-lg font-semibold mb-1">Senha</label>
            <input id="senha" name="senha" type="password" autoComplete="new-password"
              value={senha} onChange={(e) => setSenha(e.target.value)} required
              className="input" />
          </div>

          <div>
            <label htmlFor="senha_confirmacao" className="block text-lg font-semibold mb-1">Confirmação de senha</label>
            <input id="senha_confirmacao" name="senha_confirmacao" type="password" autoComplete="new-password"
              value={senhaConfirmacao} onChange={(e) => setSenhaConfirmacao(e.target.value)} required
              className="input" />
          </div>

          {erro && (
            <div role="alert" className="bg-danger-light border-2 border-danger/40 rounded-2xl p-4 text-danger-ink font-semibold">
              {erro}
            </div>
          )}

          <button type="submit" disabled={enviando || !completo} aria-busy={enviando || undefined} className="btn-primary">
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
