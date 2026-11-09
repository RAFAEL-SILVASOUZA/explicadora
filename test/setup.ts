// Node 26+ expõe um global localStorage experimental que só funciona com a flag
// --localstorage-file: sem ela, a leitura devolve undefined e ele SOMBRA o
// localStorage do jsdom (o global nativo tem precedência sobre o que o vitest copia
// da janela jsdom). Isso quebrava todo teste que grava o token de sessão — ambiente,
// não o código testado. Em ambiente jsdom, restauramos um Storage de memória com as
// mesmas semânticas que app e testes usam (getItem/setItem/removeItem/clear/key).
// Em ambiente node (rotas, db) nada é tocado: lá o global não é usado.
class StorageMemoria {
  private mapa = new Map<string, string>();

  get length(): number {
    return this.mapa.size;
  }

  key(indice: number): string | null {
    return Array.from(this.mapa.keys())[indice] ?? null;
  }

  getItem(chave: string): string | null {
    return this.mapa.has(chave) ? (this.mapa.get(chave) as string) : null;
  }

  setItem(chave: string, valor: string): void {
    this.mapa.set(chave, String(valor));
  }

  removeItem(chave: string): void {
    this.mapa.delete(chave);
  }

  clear(): void {
    this.mapa.clear();
  }
}

if (typeof window !== 'undefined' && typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: new StorageMemoria(),
    configurable: true,
  });
}
