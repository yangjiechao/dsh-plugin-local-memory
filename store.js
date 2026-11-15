import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdir, lstat, open, chmod, realpath } from 'node:fs/promises';
import path from 'node:path';

export const LIMITS = Object.freeze({ title: 120, body: 8000, tags: 8, tag: 24, query: 120,
  perProject: 1000, total: 10000, list: 50, modelChars: 6000 });
export class MemoryError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const fail = (code, message) => { throw new MemoryError(code, message); };
export function recordObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))) fail('BAD_REQUEST', 'Invalid request fields. / 请求字段无效。');
  return value;
}
const text = (value, max, name, empty = false) => {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()) || value.includes('\0')) {
    fail('BAD_REQUEST', `Invalid ${name}. / ${name} 字段无效。`);
  }
  return value.trim();
};
const secrets = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/i,
  /\b(?:gh[pousr]_[A-Za-z0-9]{16,}|github_pat_[A-Za-z0-9_]{16,}|sk-(?:proj-)?[A-Za-z0-9_-]{16,}|AKIA[A-Z0-9]{16})\b/,
  /\bbearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /(?:api[_ -]?key|access[_ -]?token|password|passwd|client[_ -]?secret|密码|密钥)\s*(?:[:=：]|是)\s*["']?[^\s"']{4,}/i,
  /https?:\/\/[^\s/:]+:[^\s/@]+@/i,
];
export function noteInput(value) {
  const title = text(value.title, LIMITS.title, 'title');
  text(value.body, LIMITS.body, 'body');
  const body = value.body;
  const rawTags = value.tags ?? [];
  if (!Array.isArray(rawTags) || rawTags.length > LIMITS.tags) fail('BAD_REQUEST', 'Invalid tags. / 标签无效。');
  const tags = [...new Set(rawTags.map(tag => text(tag, LIMITS.tag, 'tag')))];
  if (secrets.some(pattern => pattern.test([title, body, ...tags].join('\n')))) {
    fail('SECRET_DETECTED', 'Possible credential detected. Redact it before saving; no override is provided. / 检测到疑似凭据，请先脱敏后再保存。');
  }
  return { title, body, tags };
}
function projectPath(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) fail('NO_PROJECT', 'A project is required. / 请选择项目。');
  return path.normalize(value);
}
function idInput(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id)) fail('BAD_REQUEST', 'Invalid note ID. / 笔记 ID 无效。');
  return id;
}
function versionInput(value) {
  if (!Number.isSafeInteger(value) || value < 1) fail('BAD_REQUEST', 'A current version is required. / 需要当前版本号。');
  return value;
}
function mapRecord(row) {
  return { id: row.id, title: row.title, body: row.body, tags: JSON.parse(row.tags),
    version: Number(row.version), createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    sourceSessionId: row.source_session_id };
}

/** Synchronous bounded SQLite operations; transactions are the cross-process write boundary. */
export class MemoryStore {
  static async open(directory) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) fail('STORE_UNAVAILABLE', 'Storage directory must be absolute. / 存储目录必须为绝对路径。');
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) fail('STORE_UNAVAILABLE', 'Storage directory must not be a symbolic link. / 存储目录不能是符号链接。');
    const canonical = await realpath(directory);
    const file = path.join(canonical, 'memory.sqlite');
    try { const handle = await open(file, 'wx', 0o600); await handle.close(); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) fail('STORE_UNAVAILABLE', 'Unsafe database file. / 数据库文件不安全。');
    if (process.platform !== 'win32') { await chmod(canonical, 0o700); await chmod(file, 0o600); }
    const db = new DatabaseSync(file);
    try { return new MemoryStore(db, file); } catch (error) { db.close(); throw error; }
  }
  constructor(db, file) {
    this.db = db; this.file = file; this.closed = false;
    db.exec('PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL;');
    const version = Number(db.prepare('PRAGMA user_version').get().user_version);
    if (version !== 0 && version !== 1) fail('STORE_UNAVAILABLE', 'Unsupported memory database version. / 记忆数据库版本不受支持。');
    if (version === 0) {
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      if (tables.length) fail('STORE_UNAVAILABLE', 'Refusing to initialize an unrelated database. / 拒绝覆盖未知数据库。');
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE notes(id TEXT NOT NULL UNIQUE, project TEXT NOT NULL, title TEXT NOT NULL,
          body TEXT NOT NULL, tags TEXT NOT NULL, version INTEGER NOT NULL,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, source_session_id TEXT);
        CREATE INDEX notes_project ON notes(project, updated_at DESC);
        CREATE VIRTUAL TABLE notes_fts USING fts5(title,body,content='notes',content_rowid='rowid',tokenize='unicode61');
        PRAGMA user_version=1;
        COMMIT;`);
    }
    db.exec("PRAGMA journal_mode=DELETE; PRAGMA secure_delete=ON;");
    // FTS5 secure-delete removes old index entries as well. No automatic backup copies.
    db.prepare("INSERT INTO notes_fts(notes_fts, rank) VALUES('secure-delete', 1)").run();
    db.prepare('SELECT id,project,title,body,tags,version,created_at,updated_at,source_session_id FROM notes LIMIT 0').all();
  }
  ready() { if (this.closed) fail('STORE_UNAVAILABLE', 'Memory store is closed. / 记忆数据库已关闭。'); }
  transaction(fn) {
    this.ready();
    try {
      this.db.exec('BEGIN IMMEDIATE');
      try { const result = fn(); this.db.exec('COMMIT'); return result; }
      catch (error) { this.db.exec('ROLLBACK'); throw error; }
    } catch (error) {
      if (/database is (?:locked|busy)/i.test(error.message)) fail('STORE_BUSY', 'Memory database is busy. Retry later. / 记忆数据库忙，请稍后重试。');
      throw error;
    }
  }
  row(project, id) { return this.db.prepare('SELECT rowid,* FROM notes WHERE project=? AND id=?').get(project, id); }
  get(project, id) {
    this.ready(); project = projectPath(project); idInput(id);
    const row = this.row(project, id);
    if (!row) fail('NOT_FOUND', 'Note not found in this project. / 此项目中找不到该笔记。');
    return { record: mapRecord(row) };
  }
  list(project, options = {}) {
    this.ready(); project = projectPath(project);
    const query = text(options.query ?? '', LIMITS.query, 'query', true);
    const limit = options.limit ?? 20, offset = options.offset ?? 0;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > LIMITS.list || !Number.isSafeInteger(offset) || offset < 0 || offset > LIMITS.total) {
      fail('BAD_REQUEST', 'Invalid pagination. / 分页参数无效。');
    }
    const parameters = [project];
    let where = 'project=?';
    if (query) {
      // Parameterized literal phrase plus literal substring fallback for short/CJK queries.
      where += ` AND (rowid IN (SELECT rowid FROM notes_fts WHERE notes_fts MATCH ?)
        OR instr(lower(title || char(10) || body || char(10) || tags),lower(?))>0)`;
      parameters.push(`"${query.replaceAll('"', '""')}"`, query);
    }
    const total = Number(this.db.prepare(`SELECT count(*) AS n FROM notes WHERE ${where}`).get(...parameters).n);
    const rows = this.db.prepare(`SELECT * FROM notes WHERE ${where} ORDER BY updated_at DESC,id LIMIT ? OFFSET ?`)
      .all(...parameters, limit, offset);
    return { items: rows.map(row => { const { body, ...record } = mapRecord(row); return { ...record, preview: body.slice(0, 240) }; }),
      total, hasMore: offset + rows.length < total, projectPath: project };
  }
  save(project, input, sourceSessionId = null) {
    project = projectPath(project); const note = noteInput(input);
    if (sourceSessionId !== null && (typeof sourceSessionId !== 'string' || sourceSessionId.length > 256)) fail('BAD_REQUEST', 'Invalid source session. / 来源会话无效。');
    return this.transaction(() => {
      const count = this.db.prepare('SELECT count(*) AS n FROM notes WHERE project=?').get(project).n;
      const total = this.db.prepare('SELECT count(*) AS n FROM notes').get().n;
      if (count >= LIMITS.perProject || total >= LIMITS.total) fail('LIMIT', 'Memory note limit reached. Remove unneeded notes first. / 笔记数量已达上限，请先删除不需要的笔记。');
      const id = randomUUID(), now = Date.now();
      const result = this.db.prepare('INSERT INTO notes(id,project,title,body,tags,version,created_at,updated_at,source_session_id) VALUES(?,?,?,?,?,1,?,?,?)')
        .run(id, project, note.title, note.body, JSON.stringify(note.tags), now, now, sourceSessionId);
      this.db.prepare('INSERT INTO notes_fts(rowid,title,body) VALUES(?,?,?)').run(result.lastInsertRowid, note.title, note.body);
      return this.get(project, id);
    });
  }
  update(project, input) {
    project = projectPath(project); idInput(input.id); versionInput(input.expectedVersion); const note = noteInput(input);
    return this.transaction(() => {
      const old = this.row(project, input.id);
      if (!old) fail('NOT_FOUND', 'Note not found in this project. / 此项目中找不到该笔记。');
      if (Number(old.version) !== input.expectedVersion) fail('CONFLICT', 'Note changed; reload before editing. / 笔记已变化，请先重新加载再编辑。');
      this.db.prepare("INSERT INTO notes_fts(notes_fts,rowid,title,body) VALUES('delete',?,?,?)").run(old.rowid, old.title, old.body);
      this.db.prepare('UPDATE notes SET title=?,body=?,tags=?,version=version+1,updated_at=? WHERE project=? AND id=?')
        .run(note.title, note.body, JSON.stringify(note.tags), Date.now(), project, input.id);
      this.db.prepare('INSERT INTO notes_fts(rowid,title,body) VALUES(?,?,?)').run(old.rowid, note.title, note.body);
      return this.get(project, input.id);
    });
  }
  delete(project, input) {
    project = projectPath(project); idInput(input.id); versionInput(input.expectedVersion);
    return this.transaction(() => {
      const old = this.row(project, input.id);
      if (!old) fail('NOT_FOUND', 'Note not found in this project. / 此项目中找不到该笔记。');
      if (Number(old.version) !== input.expectedVersion) fail('CONFLICT', 'Note changed; inspect it again before deleting. / 笔记已变化，请重新查看后再删除。');
      this.db.prepare("INSERT INTO notes_fts(notes_fts,rowid,title,body) VALUES('delete',?,?,?)").run(old.rowid, old.title, old.body);
      this.db.prepare('DELETE FROM notes WHERE project=? AND id=?').run(project, input.id);
      return { deleted: true, id: input.id };
    });
  }
  close() { if (!this.closed) { this.closed = true; this.db.close(); } }
}

/** Presentation budget only: tool text never dumps an unlimited note collection. */
export function forModel(value) {
  const result = structuredClone(value); let budget = LIMITS.modelChars;
  let truncated = false;
  const reduce = record => {
    for (const key of ['body', 'preview']) if (typeof record[key] === 'string') {
      const original = record[key]; record[key] = original.slice(0, Math.max(0, budget));
      budget -= record[key].length;
      if (record[key].length < original.length) truncated = true;
    }
  };
  if (result.record) reduce(result.record);
  result.items?.forEach(reduce);
  return { untrustedHistoricalData: true, ...result, truncated, maxContentChars: LIMITS.modelChars };
}
