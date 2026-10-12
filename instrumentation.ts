export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { aplicarMigracoes } = await import('./lib/db/migrate');
    const { semearAdmin } = await import('./lib/db/seed-admin');
    await aplicarMigracoes();
    const criada = await semearAdmin();
    if (!criada) console.warn('ADMIN_EMAIL/ADMIN_SENHA não definidos: conta admin não criada.');
    else console.log(`Conta admin criada: ${process.env.ADMIN_EMAIL}`);
  }
}
