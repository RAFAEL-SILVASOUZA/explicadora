export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { aplicarMigracoes } = await import('./lib/db/migrate');
    const { semearAdmin } = await import('./lib/db/seed-admin');
    await aplicarMigracoes();
    const criada = await semearAdmin();
    if (!criada) {
      // Ruling LL: rowCount = 0 também acontece quando o admin já existe (ON CONFLICT
      // DO NOTHING), então a ausência de inserção não significa "não definidos".
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_SENHA) {
        console.warn('ADMIN_EMAIL/ADMIN_SENHA não definidos: conta admin não criada.');
      } else {
        console.log(`Conta admin já existente: ${process.env.ADMIN_EMAIL}`);
      }
    } else {
      console.log(`Conta admin criada: ${process.env.ADMIN_EMAIL}`);
    }
  }
}
