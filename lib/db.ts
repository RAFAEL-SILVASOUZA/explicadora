import Database from 'better-sqlite3';
import path from 'path';
import { Sessao, Questao, Resposta, SessaoCompleta, QuestaoInput } from './types';

const DB_PATH = path.join(process.cwd(), 'data', 'estudo.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const fs = require('fs');
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY,
        conteudo_texto TEXT NOT NULL,
        criada_em TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS questoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessao_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        enunciado TEXT NOT NULL,
        opcoes_json TEXT NOT NULL DEFAULT '[]',
        resposta_correta TEXT NOT NULL,
        dica TEXT NOT NULL DEFAULT '',
        ordem INTEGER NOT NULL,
        FOREIGN KEY (sessao_id) REFERENCES sessoes(id)
      );
      CREATE TABLE IF NOT EXISTS respostas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        questao_id INTEGER NOT NULL,
        resposta_dada TEXT NOT NULL,
        correto INTEGER NOT NULL,
        explicacao TEXT NOT NULL,
        respondida_em TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (questao_id) REFERENCES questoes(id)
      );
    `);

    // Migração: garante a coluna 'dica' em bancos criados antes dela existir.
    const colunas = db.prepare("PRAGMA table_info(questoes)").all() as { name: string }[];
    if (!colunas.some((c) => c.name === 'dica')) {
      db.exec("ALTER TABLE questoes ADD COLUMN dica TEXT NOT NULL DEFAULT ''");
    }
  }
  return db;
}

export function createSessao(conteudoTexto: string): string {
  const id = crypto.randomUUID();
  const db = getDb();
  db.prepare('INSERT INTO sessoes (id, conteudo_texto) VALUES (?, ?)').run(id, conteudoTexto);
  return id;
}

export function getSessao(id: string): Sessao | null {
  const db = getDb();
  return db.prepare('SELECT * FROM sessoes WHERE id = ?').get(id) as Sessao | null;
}

export function getQuestoes(sessaoId: string): Questao[] {
  const db = getDb();
  return db.prepare('SELECT * FROM questoes WHERE sessao_id = ? ORDER BY ordem').all(sessaoId) as Questao[];
}

export function getRespostas(sessaoId: string): Resposta[] {
  const db = getDb();
  return db.prepare(`
    SELECT r.* FROM respostas r
    JOIN questoes q ON r.questao_id = q.id
    WHERE q.sessao_id = ?
  `).all(sessaoId) as Resposta[];
}

export function createQuestoes(sessaoId: string, questoes: QuestaoInput[]): void {
  const db = getDb();
  const insert = db.prepare('INSERT INTO questoes (sessao_id, tipo, enunciado, opcoes_json, resposta_correta, dica, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)');
  questoes.forEach((q, i) => {
    insert.run(sessaoId, q.tipo, q.enunciado, JSON.stringify(q.opcoes), q.resposta_correta, q.dica || '', i + 1);
  });
}

export function createResposta(questaoId: string, respostaDada: string, correto: boolean, explicacao: string): void {
  const db = getDb();
  db.prepare('INSERT INTO respostas (questao_id, resposta_dada, correto, explicacao) VALUES (?, ?, ?, ?)').run(
    questaoId, respostaDada, correto ? 1 : 0, explicacao
  );
}

export function listarSessoes(): Sessao[] {
  const db = getDb();
  return db.prepare('SELECT * FROM sessoes ORDER BY criada_em DESC').all() as Sessao[];
}

export function getSessaoComQuestoes(id: string): SessaoCompleta | null {
  const sessao = getSessao(id);
  if (!sessao) return null;
  return {
    sessao,
    questoes: getQuestoes(id),
    respostas: getRespostas(id),
  };
}

export function getScore(sessaoId: string): { acertos: number; total: number } {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM questoes WHERE sessao_id = ?').get(sessaoId) as { c: number }).c;
  const acertos = (db.prepare(`
    SELECT COUNT(*) as c FROM respostas r
    JOIN questoes q ON r.questao_id = q.id
    WHERE q.sessao_id = ? AND r.correto = 1
  `).get(sessaoId) as { c: number }).c;
  return { acertos, total };
}
