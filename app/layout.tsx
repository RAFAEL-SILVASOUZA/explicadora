import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Estudo Divertido',
  description: 'Sistema de estudo com LLM para crianças',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-bg">{children}</body>
    </html>
  );
}
