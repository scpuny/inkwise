// db.rs — SQLite 持久层，含 FTS5 全文检索
// 单文件 ~/.inkwise/data/inkwise.db

use rusqlite::{Connection, params, Result as SqlResult};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

// ─── 数据行类型 ───

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleRow {
    pub id: String,
    pub collection_id: String,
    pub title: String,
    pub content: String,
    pub description: String,
    pub tags: String,           // JSON array
    pub tone: Option<String>,
    pub audience: Option<String>,
    pub target_word_count: Option<i64>,
    pub outline: String,        // JSON array
    pub phase: String,
    pub status: String,         // draft | published | scheduled
    pub word_count: i64,
    pub collection_title: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CollectionRow {
    pub id: String,
    pub title: String,
    pub sort_order: i64,
    pub article_count: i64,
    pub linked_folder: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub article_id: String,
    pub collection_id: String,
    pub collection_title: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
}

// ─── Database ───

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn open(app_dir: &PathBuf) -> SqlResult<Self> {
        let data_dir = app_dir.join("data");
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("inkwise.db");

        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;

        let db = Self { conn: Mutex::new(conn) };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS collections (
                id          TEXT PRIMARY KEY,
                title       TEXT NOT NULL DEFAULT '',
                sort_order  INTEGER NOT NULL DEFAULT 0,
                linked_folder TEXT,
                created_at  INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS articles (
                id          TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL REFERENCES collections(id),
                title       TEXT NOT NULL DEFAULT '',
                content     TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                tags        TEXT NOT NULL DEFAULT '[]',
                tone        TEXT,
                audience    TEXT,
                target_word_count INTEGER,
                outline     TEXT NOT NULL DEFAULT '[]',
                phase       TEXT NOT NULL DEFAULT 'planning',
                status      TEXT NOT NULL DEFAULT 'draft',
                platform_meta TEXT DEFAULT '{}',
                word_count  INTEGER NOT NULL DEFAULT 0,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_articles_collection
                ON articles(collection_id);
            CREATE INDEX IF NOT EXISTS idx_articles_updated
                ON articles(updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_articles_status
                ON articles(status);

            CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
                title, content, description,
                tokenize='unicode61',
                content=articles,
                content_rowid=rowid
            );

            -- FTS sync triggers
            CREATE TRIGGER IF NOT EXISTS articles_ai AFTER INSERT ON articles BEGIN
                INSERT INTO articles_fts(rowid, title, content, description)
                VALUES (new.rowid, new.title, new.content, new.description);
            END;

            CREATE TRIGGER IF NOT EXISTS articles_ad AFTER DELETE ON articles BEGIN
                INSERT INTO articles_fts(articles_fts, rowid, title, content, description)
                VALUES ('delete', old.rowid, old.title, old.content, old.description);
            END;

            CREATE TRIGGER IF NOT EXISTS articles_au AFTER UPDATE ON articles BEGIN
                INSERT INTO articles_fts(articles_fts, rowid, title, content, description)
                VALUES ('delete', old.rowid, old.title, old.content, old.description);
                INSERT INTO articles_fts(rowid, title, content, description)
                VALUES (new.rowid, new.title, new.content, new.description);
            END;

            -- Settings key-value
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        ")?;
        Ok(())
    }

    // ─── Collections ───

    pub fn list_collections(&self) -> SqlResult<Vec<CollectionRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("
            SELECT c.id, c.title, c.sort_order, c.linked_folder, c.created_at,
                   (SELECT COUNT(*) FROM articles a WHERE a.collection_id = c.id) as article_count
            FROM collections c
            ORDER BY c.sort_order ASC, c.created_at ASC
        ")?;
        let rows = stmt.query_map([], |row| {
            Ok(CollectionRow {
                id: row.get(0)?,
                title: row.get(1)?,
                sort_order: row.get(2)?,
                linked_folder: row.get(3)?,
                created_at: row.get(4)?,
                article_count: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_collection(&self, id: &str, title: &str, sort_order: i64, created_at: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO collections (id, title, sort_order, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, title, sort_order, created_at],
        )?;
        Ok(())
    }

    pub fn rename_collection(&self, id: &str, title: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE collections SET title = ?1 WHERE id = ?2", params![title, id])?;
        Ok(())
    }

    pub fn delete_collection(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM articles WHERE collection_id = ?1", params![id])?;
        conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_collection_folder(&self, id: &str, folder: Option<&str>) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE collections SET linked_folder = ?1 WHERE id = ?2", params![folder, id])?;
        Ok(())
    }

    // ─── Articles ───

    pub fn list_articles(&self, collection_id: Option<&str>, status: Option<&str>, offset: i64, limit: i64) -> SqlResult<Vec<ArticleRow>> {
        let conn = self.conn.lock().unwrap();

        let mut sql = String::from(
            "SELECT a.id, a.collection_id, a.title, '', a.description, a.tags,
                    a.tone, a.audience, a.target_word_count, a.outline,
                    a.phase, a.status, a.word_count, c.title as collection_title,
                    a.created_at, a.updated_at
             FROM articles a JOIN collections c ON a.collection_id = c.id WHERE 1=1"
        );
        let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(cid) = collection_id {
            sql.push_str(" AND a.collection_id = ?");
            params_vec.push(Box::new(cid.to_string()));
        }
        if let Some(st) = status {
            sql.push_str(" AND a.status = ?");
            params_vec.push(Box::new(st.to_string()));
        }
        sql.push_str(" ORDER BY a.updated_at DESC LIMIT ? OFFSET ?");
        params_vec.push(Box::new(limit));
        params_vec.push(Box::new(offset));

        let mut stmt = conn.prepare(&sql)?;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
        let rows = stmt.query_map(param_refs.as_slice(), |row| {
            Ok(ArticleRow {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                title: row.get(2)?,
                content: String::new(), // content not loaded in list
                description: row.get(4)?,
                tags: row.get(5)?,
                tone: row.get(6)?,
                audience: row.get(7)?,
                target_word_count: row.get(8)?,
                outline: row.get(9)?,
                phase: row.get(10)?,
                status: row.get(11)?,
                word_count: row.get(12)?,
                collection_title: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        rows.collect()
    }

    pub fn get_article(&self, id: &str) -> SqlResult<Option<ArticleRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("
            SELECT a.id, a.collection_id, a.title, a.content, a.description, a.tags,
                   a.tone, a.audience, a.target_word_count, a.outline,
                   a.phase, a.status, a.word_count, c.title as collection_title,
                   a.created_at, a.updated_at
            FROM articles a JOIN collections c ON a.collection_id = c.id
            WHERE a.id = ?1
        ")?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(ArticleRow {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                description: row.get(4)?,
                tags: row.get(5)?,
                tone: row.get(6)?,
                audience: row.get(7)?,
                target_word_count: row.get(8)?,
                outline: row.get(9)?,
                phase: row.get(10)?,
                status: row.get(11)?,
                word_count: row.get(12)?,
                collection_title: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    pub fn save_article(&self, article: &ArticleRow) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let word_count = count_words(&article.content);
        conn.execute(
            "INSERT OR REPLACE INTO articles
             (id, collection_id, title, content, description, tags, tone, audience,
              target_word_count, outline, phase, status, word_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                article.id, article.collection_id, article.title, article.content,
                article.description, article.tags, article.tone, article.audience,
                article.target_word_count, article.outline, article.phase, article.status,
                word_count, article.created_at, article.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_article(&self, id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM articles WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn move_article(&self, id: &str, new_collection_id: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE articles SET collection_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_collection_id, unix_now(), id],
        )?;
        Ok(())
    }

    // ─── FTS5 搜索 ───

    pub fn search(&self, query: &str, limit: i64) -> SqlResult<Vec<SearchResult>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("
            SELECT a.id, a.collection_id, c.title as collection_title, a.title,
                   snippet(articles_fts, 1, '<mark>', '</mark>', '…', 32) as snippet,
                   rank
            FROM articles_fts
            JOIN articles a ON articles_fts.rowid = a.rowid
            JOIN collections c ON a.collection_id = c.id
            WHERE articles_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2
        ")?;
        let rows = stmt.query_map(params![query, limit], |row| {
            Ok(SearchResult {
                article_id: row.get(0)?,
                collection_id: row.get(1)?,
                collection_title: row.get(2)?,
                title: row.get(3)?,
                snippet: row.get(4)?,
                score: row.get::<_, f64>(5)?,
            })
        })?;
        rows.collect()
    }

    // ─── Settings KV ───

    pub fn get_setting(&self, key: &str) -> SqlResult<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
        Ok(rows.next().map(|r| r.unwrap_or_default()))
    }

    pub fn set_setting(&self, key: &str, value: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    // ─── 获取所有文章的概要（用于文章管理页） ───

    pub fn list_all_articles(&self) -> SqlResult<Vec<ArticleRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("
            SELECT a.id, a.collection_id, a.title, '', a.description, a.tags,
                   a.tone, a.audience, a.target_word_count, a.outline,
                   a.phase, a.status, a.word_count, c.title as collection_title,
                   a.created_at, a.updated_at
            FROM articles a JOIN collections c ON a.collection_id = c.id
            ORDER BY a.updated_at DESC
        ")?;
        let rows = stmt.query_map([], |row| {
            Ok(ArticleRow {
                id: row.get(0)?,
                collection_id: row.get(1)?,
                title: row.get(2)?,
                content: String::new(),
                description: row.get(4)?,
                tags: row.get(5)?,
                tone: row.get(6)?,
                audience: row.get(7)?,
                target_word_count: row.get(8)?,
                outline: row.get(9)?,
                phase: row.get(10)?,
                status: row.get(11)?,
                word_count: row.get(12)?,
                collection_title: row.get(13)?,
                created_at: row.get(14)?,
                updated_at: row.get(15)?,
            })
        })?;
        rows.collect()
    }
}

// ─── 工具函数 ───

fn count_words(text: &str) -> i64 {
    let cn = text.chars().filter(|&c| c >= '\u{4e00}' && c <= '\u{9fff}').count() as i64;
    // Count non-CJK words
    let cleaned: String = text.chars()
        .filter(|&c| c < '\u{4e00}' || c > '\u{9fff}')
        .collect();
    let western = cleaned.split_whitespace().count() as i64;
    cn + western
}

fn unix_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
