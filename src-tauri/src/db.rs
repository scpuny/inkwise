// db.rs — SQLite 持久层，含 FTS5 全文检索
// 单文件 ~/.inkwise/data/inkwise.db

use rusqlite::{params, Connection, Result as SqlResult};
use serde::{Deserialize, Serialize};
use crate::vector::types::VectorChunkRow;
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
    pub tags: String, // JSON array
    pub tone: Option<String>,
    pub audience: Option<String>,
    pub target_word_count: Option<i64>,
    pub outline: String, // JSON array
    pub phase: String,
    pub status: String, // draft | published | scheduled
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
pub struct ArticleImageRow {
    pub id: String,
    pub article_id: String,
    pub local_path: String,
    pub alt_text: String,
    pub revised_prompt: Option<String>,
    pub section_index: Option<i64>,
    pub created_at: i64,
}

/// 文章搜索索引行（articles_search 表，只存 FTS 所需最小字段）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArticleSearchRow {
    pub id: String,
    pub title: String,
    pub description: String,
    pub content_snippet: String, // 前 2000 字
    pub tags: String,
    pub collection_id: String,
    pub created_at: i64,
    pub updated_at: i64,
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

/// Lock the database connection mutex, converting a poison error to a rusqlite error.
fn lock_conn(
    conn: &Mutex<Connection>,
) -> Result<std::sync::MutexGuard<'_, Connection>, rusqlite::Error> {
    conn.lock().map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(
            std::io::ErrorKind::Other,
            e.to_string(),
        )))
    })
}

/** 当前 schema 版本号 */
const SCHEMA_VERSION: i64 = 2;

/** 截取内容前 N 字用于搜索索引 */
fn content_snippet(content: &str, max_len: usize) -> String {
    if content.chars().count() > max_len {
        content.chars().take(max_len).collect()
    } else {
        content.to_string()
    }
}

impl Database {
    pub fn open(app_dir: &PathBuf) -> SqlResult<Self> {
        let data_dir = app_dir.join("data");
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("inkwise.db");

        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;")?;

        let db = Self {
            conn: Mutex::new(conn),
        };
        db.initialize_schema()?;
        Ok(db)
    }

    fn initialize_schema(&self) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute_batch(
            "
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

            -- Settings key-value
            CREATE TABLE IF NOT EXISTS settings (
                key   TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS article_images (
                id          TEXT PRIMARY KEY,
                article_id  TEXT NOT NULL REFERENCES articles(id),
                local_path  TEXT NOT NULL,
                alt_text    TEXT NOT NULL DEFAULT '',
                revised_prompt TEXT,
                section_index INTEGER,
                created_at  INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_article_images_article
                ON article_images(article_id);
            CREATE INDEX IF NOT EXISTS idx_article_images_section
                ON article_images(section_index);
        ",
        )?;
        self.migrate(&conn)?;
        Ok(())
    }

    /** Schema 版本迁移：v1 → v2 新增 articles_search 表，FTS5 指向 content_snippet */
    fn migrate(&self, conn: &Connection) -> SqlResult<()> {
        let current: i64 = conn
            .query_row(
                "SELECT COALESCE((SELECT value FROM settings WHERE key = 'schema_version'), '0')",
                [],
                |row| {
                    row.get::<_, String>(0).and_then(|v| {
                        v.parse::<i64>().map_err(|_| {
                            rusqlite::Error::InvalidParameterName("schema_version parse".into())
                        })
                    })
                },
            )
            .unwrap_or(0);

        if current >= SCHEMA_VERSION {
            return Ok(());
        }

        if current < 2 {
            conn.execute_batch("
                -- 1. 建 articles_search 表（只存搜索最小字段）
                CREATE TABLE IF NOT EXISTS articles_search (
                    id              TEXT NOT NULL PRIMARY KEY,
                    title           TEXT NOT NULL DEFAULT '',
                    description     TEXT NOT NULL DEFAULT '',
                    content_snippet TEXT NOT NULL DEFAULT '',
                    tags            TEXT NOT NULL DEFAULT '[]',
                    collection_id   TEXT NOT NULL,
                    created_at      INTEGER NOT NULL DEFAULT 0,
                    updated_at      INTEGER NOT NULL DEFAULT 0
                );

                -- 2. 迁移已有数据：content 截取前 2000 字
                INSERT OR IGNORE INTO articles_search
                    (id, title, description, content_snippet, tags, collection_id, created_at, updated_at)
                SELECT
                    id, title, description,
                    CASE WHEN length(content) > 2000 THEN substr(content, 1, 2000) ELSE content END,
                    tags, collection_id, created_at, updated_at
                FROM articles;

                -- 3. 删除旧 FTS 触发器
                DROP TRIGGER IF EXISTS articles_ai;
                DROP TRIGGER IF EXISTS articles_ad;
                DROP TRIGGER IF EXISTS articles_au;

                -- 4. 删除旧 FTS5 表（DROP TABLE 需单独 execute_batch）
            ")?;

            conn.execute_batch("DROP TABLE IF EXISTS articles_fts;")?;

            conn.execute_batch("
                CREATE VIRTUAL TABLE articles_fts USING fts5(
                    title, description, content_snippet, tags,
                    tokenize='unicode61',
                    content='articles_search',
                    content_rowid=rowid
                );

                -- 5. 重建 FTS 索引
                INSERT INTO articles_fts(rowid, title, description, content_snippet, tags)
                SELECT rowid, title, description, content_snippet, tags FROM articles_search;

                -- 6. 新建触发器：articles → articles_search → FTS5
                CREATE TRIGGER IF NOT EXISTS articles_search_ai AFTER INSERT ON articles BEGIN
                    INSERT INTO articles_search (id, title, description, content_snippet, tags, collection_id, created_at, updated_at)
                    VALUES (
                        new.id, new.title, new.description,
                        CASE WHEN length(new.content) > 2000 THEN substr(new.content, 1, 2000) ELSE new.content END,
                        new.tags, new.collection_id, new.created_at, new.updated_at
                    );
                    INSERT INTO articles_fts(rowid, title, description, content_snippet, tags)
                    VALUES (
                        (SELECT rowid FROM articles_search WHERE id = new.id),
                        new.title, new.description,
                        CASE WHEN length(new.content) > 2000 THEN substr(new.content, 1, 2000) ELSE new.content END,
                        new.tags
                    );
                END;

                CREATE TRIGGER IF NOT EXISTS articles_search_ad AFTER DELETE ON articles BEGIN
                    INSERT INTO articles_fts(articles_fts, rowid, title, description, content_snippet, tags)
                    VALUES (
                        'delete',
                        (SELECT rowid FROM articles_search WHERE id = old.id),
                        old.title, old.description, '', old.tags
                    );
                    DELETE FROM articles_search WHERE id = old.id;
                END;

                CREATE TRIGGER IF NOT EXISTS articles_search_au AFTER UPDATE ON articles BEGIN
                    INSERT INTO articles_fts(articles_fts, rowid, title, description, content_snippet, tags)
                    VALUES (
                        'delete',
                        (SELECT rowid FROM articles_search WHERE id = old.id),
                        old.title, old.description, '', old.tags
                    );
                    INSERT OR REPLACE INTO articles_search (id, title, description, content_snippet, tags, collection_id, created_at, updated_at)
                    VALUES (
                        new.id, new.title, new.description,
                        CASE WHEN length(new.content) > 2000 THEN substr(new.content, 1, 2000) ELSE new.content END,
                        new.tags, new.collection_id, new.created_at, new.updated_at
                    );
                    INSERT INTO articles_fts(rowid, title, description, content_snippet, tags)
                    VALUES (
                        (SELECT rowid FROM articles_search WHERE id = new.id),
                        new.title, new.description,
                        CASE WHEN length(new.content) > 2000 THEN substr(new.content, 1, 2000) ELSE new.content END,
                        new.tags
                    );
                END;

                -- 7. 记录 schema 版本
                CREATE TABLE IF NOT EXISTS vector_chunks (
                    id TEXT PRIMARY KEY,
                    article_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    content TEXT NOT NULL,
                    content_hash TEXT NOT NULL,
                    embedding TEXT,
                    created_at INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_vector_chunks_article ON vector_chunks(article_id);
                INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '3');
            ")?;
        }

        Ok(())
    }

    // ─── Collections ───

    pub fn list_collections(&self) -> SqlResult<Vec<CollectionRow>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "
            SELECT c.id, c.title, c.sort_order, c.linked_folder, c.created_at,
                   (SELECT COUNT(*) FROM articles a WHERE a.collection_id = c.id) as article_count
            FROM collections c
            ORDER BY c.sort_order ASC, c.created_at ASC
        ",
        )?;
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

    pub fn create_collection(
        &self,
        id: &str,
        title: &str,
        sort_order: i64,
        created_at: i64,
    ) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT INTO collections (id, title, sort_order, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![id, title, sort_order, created_at],
        )?;
        Ok(())
    }

    pub fn rename_collection(&self, id: &str, title: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "UPDATE collections SET title = ?1 WHERE id = ?2",
            params![title, id],
        )?;
        Ok(())
    }

    pub fn delete_collection(&self, id: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM articles WHERE collection_id = ?1", params![id])?;
        conn.execute("DELETE FROM collections WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_collection_folder(&self, id: &str, folder: Option<&str>) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "UPDATE collections SET linked_folder = ?1 WHERE id = ?2",
            params![folder, id],
        )?;
        Ok(())
    }

    // ─── Articles ───

    pub fn list_articles(
        &self,
        collection_id: Option<&str>,
        status: Option<&str>,
        offset: i64,
        limit: i64,
    ) -> SqlResult<Vec<ArticleRow>> {
        let conn = lock_conn(&self.conn)?;

        let mut sql = String::from(
            "SELECT a.id, a.collection_id, a.title, '', a.description, a.tags,
                    a.tone, a.audience, a.target_word_count, a.outline,
                    a.phase, a.status, a.word_count, c.title as collection_title,
                    a.created_at, a.updated_at
             FROM articles a JOIN collections c ON a.collection_id = c.id WHERE 1=1",
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
        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            params_vec.iter().map(|p| p.as_ref()).collect();
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
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "
            SELECT a.id, a.collection_id, a.title, a.content, a.description, a.tags,
                   a.tone, a.audience, a.target_word_count, a.outline,
                   a.phase, a.status, a.word_count, c.title as collection_title,
                   a.created_at, a.updated_at
            FROM articles a JOIN collections c ON a.collection_id = c.id
            WHERE a.id = ?1
        ",
        )?;
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
        let conn = lock_conn(&self.conn)?;
        let word_count = count_words(&article.content);
        conn.execute(
            "INSERT OR REPLACE INTO articles
             (id, collection_id, title, content, description, tags, tone, audience,
              target_word_count, outline, phase, status, word_count, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                article.id,
                article.collection_id,
                article.title,
                article.content,
                article.description,
                article.tags,
                article.tone,
                article.audience,
                article.target_word_count,
                article.outline,
                article.phase,
                article.status,
                word_count,
                article.created_at,
                article.updated_at,
            ],
        )?;
        // articles_search + FTS 通过触发器自动同步
        Ok(())
    }

    pub fn delete_article(&self, id: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM articles WHERE id = ?1", params![id])?;
        // articles_search + FTS 通过触发器自动清理
        Ok(())
    }

    pub fn move_article(&self, id: &str, new_collection_id: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "UPDATE articles SET collection_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_collection_id, unix_now(), id],
        )?;
        Ok(())
    }

    // ─── Article Images ───

    pub fn save_article_images(
        &self,
        article_id: &str,
        images: &[ArticleImageRow],
    ) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "DELETE FROM article_images WHERE article_id = ?1",
            params![article_id],
        )?;
        let mut stmt = conn.prepare(
            "INSERT INTO article_images (id, article_id, local_path, alt_text, revised_prompt, section_index, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
        )?;
        for img in images {
            stmt.execute(params![
                img.id,
                img.article_id,
                img.local_path,
                img.alt_text,
                img.revised_prompt,
                img.section_index,
                img.created_at,
            ])?;
        }
        // 更新 articles_search 中的 description 以包含图片描述（提升 FTS 覆盖）
        let img_descs: Vec<String> = images
            .iter()
            .filter(|img| !img.alt_text.is_empty())
            .map(|img| format!("[图片: {}]", img.alt_text))
            .collect();
        if !img_descs.is_empty() {
            let desc_text = img_descs.join(" ");
            // 同时更新 articles 和 articles_search 的 description
            let update_sql = "
                UPDATE articles SET description = CASE
                    WHEN description = '' OR description IS NULL THEN ?1
                    ELSE description || ' ' || ?1
                 END, updated_at = ?2 WHERE id = ?3";
            conn.execute(update_sql, params![desc_text, unix_now(), article_id])?;
            // articles_search 通过 UPDATE 触发器自动同步
        }
        Ok(())
    }

    pub fn get_article_images(&self, article_id: &str) -> SqlResult<Vec<ArticleImageRow>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, article_id, local_path, alt_text, revised_prompt, section_index, created_at FROM article_images WHERE article_id = ?1 ORDER BY section_index ASC, created_at ASC"
        )?;
        let rows = stmt.query_map(params![article_id], |row| {
            Ok(ArticleImageRow {
                id: row.get(0)?,
                article_id: row.get(1)?,
                local_path: row.get(2)?,
                alt_text: row.get(3)?,
                revised_prompt: row.get(4)?,
                section_index: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        rows.collect()
    }

    pub fn delete_article_images(&self, article_id: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "DELETE FROM article_images WHERE article_id = ?1",
            params![article_id],
        )?;
        Ok(())
    }

    // ─── FTS5 搜索 ───

    pub fn search(&self, query: &str, limit: i64) -> SqlResult<Vec<SearchResult>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "
            SELECT a.id, a.collection_id, c.title as collection_title, a_t.title,
                   snippet(articles_fts, 2, '<mark>', '</mark>', '…', 32) as snippet,
                   rank
            FROM articles_fts
            JOIN articles_search a_t ON articles_fts.rowid = a_t.rowid
            JOIN articles a ON a_t.id = a.id
            JOIN collections c ON a.collection_id = c.id
            WHERE articles_fts MATCH ?1
            ORDER BY rank
            LIMIT ?2
        ",
        )?;
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
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?1")?;
        let mut rows = stmt.query_map(params![key], |row| row.get::<_, String>(0))?;
        Ok(rows.next().map(|r| r.unwrap_or_default()))
    }

    pub fn set_setting(&self, key: &str, value: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    // ─── 获取所有文章的概要（用于文章管理页） ───

    pub fn list_all_articles(&self) -> SqlResult<Vec<ArticleRow>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "
            SELECT a.id, a.collection_id, a.title, '', a.description, a.tags,
                   a.tone, a.audience, a.target_word_count, a.outline,
                   a.phase, a.status, a.word_count, c.title as collection_title,
                   a.created_at, a.updated_at
            FROM articles a JOIN collections c ON a.collection_id = c.id
            ORDER BY a.updated_at DESC
        ",
        )?;
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

    /// 获取搜索索引行（供外部读取 articles_search 内容）
    pub fn get_article_search(&self, id: &str) -> SqlResult<Option<ArticleSearchRow>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, content_snippet, tags, collection_id, created_at, updated_at
             FROM articles_search WHERE id = ?1"
        )?;
        let mut rows = stmt.query_map(params![id], |row| {
            Ok(ArticleSearchRow {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                content_snippet: row.get(3)?,
                tags: row.get(4)?,
                collection_id: row.get(5)?,
                created_at: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?;
        match rows.next() {
            Some(row) => Ok(Some(row?)),
            None => Ok(None),
        }
    }

    /// 获取 schema 版本号
    pub fn schema_version(&self) -> i64 {
        let conn = match lock_conn(&self.conn) {
            Ok(c) => c,
            Err(_) => return 0,
        };
        conn.query_row(
            "SELECT COALESCE((SELECT value FROM settings WHERE key = 'schema_version'), '0')",
            [],
            |row| {
                row.get::<_, String>(0).and_then(|v| {
                    v.parse::<i64>()
                        .map_err(|_| rusqlite::Error::InvalidParameterName("parse".into()))
                })
            },
        )
        .unwrap_or(0)
    }

    // ─── Vector Chunks ───

    /// 列出文章的所有向量 chunk
    pub fn list_vector_chunks(&self, article_id: &str) -> SqlResult<Vec<VectorChunkRow>> {
        let conn = lock_conn(&self.conn)?;
        let mut stmt = conn.prepare(
            "SELECT id, article_id, chunk_index, content, content_hash, embedding, created_at              FROM vector_chunks WHERE article_id = ?1 ORDER BY chunk_index"
        )?;
        let rows = stmt.query_map(params![article_id], |row| {
            Ok(VectorChunkRow {
                id: row.get(0)?,
                article_id: row.get(1)?,
                chunk_index: row.get(2)?,
                content: row.get(3)?,
                content_hash: row.get(4)?,
                embedding: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        let mut result = Vec::new();
        for row in rows {
            result.push(row?);
        }
        Ok(result)
    }

    /// 列出所有向量 chunk（含 embedding）
    pub fn list_vector_chunks_with_embedding(&self, article_id: Option<&str>) -> SqlResult<Vec<VectorChunkRow>> {
        let conn = lock_conn(&self.conn)?;
        let mut result = Vec::new();
        if let Some(aid) = article_id {
            let mut stmt = conn.prepare(
                "SELECT id, article_id, chunk_index, content, content_hash, embedding, created_at                  FROM vector_chunks WHERE article_id = ?1 AND embedding IS NOT NULL ORDER BY chunk_index"
            )?;
            for row in stmt.query_map(params![aid], map_chunk_row)? {
                result.push(row?);
            }
        } else {
            let mut stmt = conn.prepare(
                "SELECT id, article_id, chunk_index, content, content_hash, embedding, created_at                  FROM vector_chunks WHERE embedding IS NOT NULL ORDER BY article_id, chunk_index"
            )?;
            for row in stmt.query_map([], map_chunk_row)? {
                result.push(row?);
            }
        }
        Ok(result)
    }

    /// 插入或更新向量 chunk
    pub fn upsert_vector_chunk(&self, chunk: &VectorChunkRow) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute(
            "INSERT OR REPLACE INTO vector_chunks (id, article_id, chunk_index, content, content_hash, embedding, created_at)              VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![chunk.id, chunk.article_id, chunk.chunk_index, chunk.content, chunk.content_hash, chunk.embedding, chunk.created_at],
        )?;
        Ok(())
    }

    /// 删除文章的所有向量 chunk
    pub fn delete_vector_chunks(&self, article_id: &str) -> SqlResult<()> {
        let conn = lock_conn(&self.conn)?;
        conn.execute("DELETE FROM vector_chunks WHERE article_id = ?1", params![article_id])?;
        Ok(())
    }

    /// 获取向量 chunk 总数
    pub fn vector_chunk_count(&self) -> SqlResult<i64> {
        let conn = lock_conn(&self.conn)?;
        conn.query_row("SELECT COUNT(*) FROM vector_chunks", [], |row| row.get(0))
    }
}

// ─── 工具函数 ───

/// 将 SQLite row 映射为 VectorChunkRow
fn map_chunk_row(row: &rusqlite::Row) -> rusqlite::Result<VectorChunkRow> {
    Ok(VectorChunkRow {
        id: row.get(0)?,
        article_id: row.get(1)?,
        chunk_index: row.get(2)?,
        content: row.get(3)?,
        content_hash: row.get(4)?,
        embedding: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn count_words(text: &str) -> i64 {
    let cn = text
        .chars()
        .filter(|&c| c >= '\u{4e00}' && c <= '\u{9fff}')
        .count() as i64;
    let cleaned: String = text
        .chars()
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
