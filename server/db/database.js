// ============================================================================
// OmniMind AI — SQLite Database Layer
// ============================================================================
// Manages all persistent storage: conversations, messages, memory, settings.
// Auto-creates tables on first run.
// ============================================================================

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'omnimind.db');

let db;

/**
 * Initialize the database connection and create tables if they don't exist.
 */
export function initDatabase() {
  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrent read performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    -- Conversations table
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT 'New Chat',
      personality TEXT DEFAULT 'professional',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    -- Long-term memory table
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL DEFAULT 'general',
      content TEXT NOT NULL,
      source TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- User settings table
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_messages_conversation 
      ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created 
      ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_category 
      ON memories(category);
    CREATE INDEX IF NOT EXISTS idx_conversations_updated 
      ON conversations(updated_at DESC);
  `);

  console.log('✅ Database initialized');
  return db;
}

/**
 * Get the database instance.
 */
export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
  return db;
}

// ─── Conversation Operations ─────────────────────────────────────────────

export function createConversation(id, title = 'New Chat', personality = 'professional') {
  const stmt = getDb().prepare(
    'INSERT INTO conversations (id, title, personality) VALUES (?, ?, ?)'
  );
  stmt.run(id, title, personality);
  return { id, title, personality };
}

export function getConversation(id) {
  return getDb().prepare('SELECT * FROM conversations WHERE id = ?').get(id);
}

export function listConversations(limit = 50) {
  return getDb().prepare(
    'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT ?'
  ).all(limit);
}

export function updateConversationTitle(id, title) {
  getDb().prepare(
    'UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(title, id);
}

export function deleteConversation(id) {
  getDb().prepare('DELETE FROM conversations WHERE id = ?').run(id);
}

// ─── Message Operations ──────────────────────────────────────────────────

export function addMessage(conversationId, role, content, metadata = {}) {
  const stmt = getDb().prepare(
    'INSERT INTO messages (conversation_id, role, content, metadata) VALUES (?, ?, ?, ?)'
  );
  stmt.run(conversationId, role, content, JSON.stringify(metadata));

  // Update conversation timestamp
  getDb().prepare(
    'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(conversationId);
}

export function getMessages(conversationId, limit = 100) {
  return getDb().prepare(
    'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?'
  ).all(conversationId, limit);
}

export function getRecentMessages(conversationId, limit = 20) {
  // Get the most recent N messages for context window
  const rows = getDb().prepare(
    `SELECT * FROM messages WHERE conversation_id = ? 
     ORDER BY created_at DESC LIMIT ?`
  ).all(conversationId, limit);
  return rows.reverse(); // Return in chronological order
}

// ─── Memory Operations ───────────────────────────────────────────────────

export function addMemory(category, content, source = '') {
  const stmt = getDb().prepare(
    'INSERT INTO memories (category, content, source) VALUES (?, ?, ?)'
  );
  const result = stmt.run(category, content, source);
  return { id: result.lastInsertRowid, category, content, source };
}

export function listMemories(category = null) {
  if (category) {
    return getDb().prepare(
      'SELECT * FROM memories WHERE category = ? ORDER BY created_at DESC'
    ).all(category);
  }
  return getDb().prepare(
    'SELECT * FROM memories ORDER BY created_at DESC'
  ).all();
}

export function searchMemories(query) {
  // Simple LIKE search — works well for small datasets
  return getDb().prepare(
    `SELECT * FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT 20`
  ).all(`%${query}%`);
}

export function deleteMemory(id) {
  getDb().prepare('DELETE FROM memories WHERE id = ?').run(id);
}

// ─── Settings Operations ─────────────────────────────────────────────────

export function getSetting(key, defaultValue = null) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  getDb().prepare(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
  ).run(key, value);
}
