import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(file) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snapshots(id TEXT, version INTEGER, data TEXT, PRIMARY KEY(id,version));
      CREATE TABLE IF NOT EXISTS operations(key TEXT PRIMARY KEY, post_id TEXT, state TEXT, data TEXT, updated TEXT);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at TEXT, subject TEXT, action TEXT, detail TEXT);
      PRAGMA user_version=1;`);
  }
  get(id) { const row = this.db.prepare('SELECT data FROM records WHERE id=?').get(id); return row ? JSON.parse(row.data) : null; }
  list(kind) { return this.db.prepare('SELECT data FROM records WHERE kind=? ORDER BY rowid DESC').all(kind).map(r => JSON.parse(r.data)); }
  put(kind, value) {
    this.db.prepare('INSERT INTO records VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(value.id, kind, JSON.stringify(value));
    return value;
  }
  snapshot(value) { this.db.prepare('INSERT OR IGNORE INTO snapshots VALUES(?,?,?)').run(value.id, value.version, JSON.stringify(value)); }
  history(id) { return this.db.prepare('SELECT data FROM snapshots WHERE id=? ORDER BY version DESC').all(id).map(r => JSON.parse(r.data)); }
  tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const result = fn(); this.db.exec('COMMIT'); return result; } catch (error) { this.db.exec('ROLLBACK'); throw error; } }
  audit(id, action, detail = '') { this.db.prepare('INSERT INTO audit(at,subject,action,detail) VALUES(?,?,?,?)').run(new Date().toISOString(), id, action, detail); }
  events() { return this.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all(); }
  backupTrail(brandId,postIds) {
    const audit=this.db.prepare('SELECT * FROM audit WHERE subject=? ORDER BY id');
    const operations=this.db.prepare('SELECT * FROM operations WHERE post_id=?');
    return {audit:[brandId,...postIds].flatMap(id=>audit.all(id)).sort((a,b)=>a.id-b.id),operations:postIds.flatMap(id=>operations.all(id)).map(r=>({...r,data:JSON.parse(r.data)}))};
  }
  operation(key) { const row = this.db.prepare('SELECT * FROM operations WHERE key=?').get(key); return row ? { ...row, data: JSON.parse(row.data) } : null; }
  setOperation(key, post, state, data = {}) { this.db.prepare('INSERT INTO operations VALUES(?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET state=excluded.state,data=excluded.data,updated=excluded.updated').run(key, post, state, JSON.stringify(data), new Date().toISOString()); }
  close() { this.db.close(); }
}
export const newId = (prefix) => `${prefix}_${randomUUID()}`;
