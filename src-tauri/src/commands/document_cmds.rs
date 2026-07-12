// ─── Document / Article 命令 ───

use crate::domain::*;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn save_article_content(state: State<AppState>, id: String, content: String) -> Result<(), String> {
    state.storage.save_article_content(&id, &content)
}

#[tauri::command]
pub fn load_article_content(state: State<AppState>, id: String) -> Result<Option<String>, String> {
    Ok(state.storage.load_article_content(&id))
}

#[tauri::command]
pub fn delete_article(state: State<AppState>, id: String) -> Result<(), String> {
    let store = state.storage.json_lock();
    store.delete_article_content(&id)?;
    store.delete_article_meta(&id)?;
    store.delete_blueprint(&id).ok();
    store.delete_article_document(&id).ok();
    Ok(())
}

#[tauri::command]
pub fn save_article_meta(state: State<AppState>, meta: ArticleMeta) -> Result<(), String> {
    state.storage.save_article_meta(&meta)
}

#[tauri::command]
pub fn load_article_meta(state: State<AppState>, id: String) -> Result<Option<ArticleMeta>, String> {
    Ok(state.storage.load_article_meta(&id))
}

#[tauri::command]
pub fn save_article_blueprint(state: State<AppState>, id: String, blueprint: ArticleBlueprint) -> Result<(), String> {
    state.storage.save_blueprint(&id, &blueprint)
}

#[tauri::command]
pub fn load_article_blueprint(state: State<AppState>, id: String) -> Result<Option<ArticleBlueprint>, String> {
    Ok(state.storage.load_blueprint(&id))
}

#[tauri::command]
pub fn save_article_document(state: State<AppState>, doc: ArticleDocument) -> Result<(), String> {
    state.storage.save_article_document(&doc)
}

#[tauri::command]
pub fn load_article_document(state: State<AppState>, id: String) -> Result<Option<ArticleDocument>, String> {
    Ok(state.storage.load_article_document(&id))
}

// ─── DB-backed article commands ───

#[tauri::command]
pub fn save_article_db(state: State<AppState>, article: crate::db::ArticleRow) -> Result<(), String> {
    state.storage.db_save_article(&article)
}

#[tauri::command]
pub fn get_article_db(state: State<AppState>, id: String) -> Result<Option<crate::db::ArticleRow>, String> {
    Ok(state.storage.db_get_article(&id))
}

#[tauri::command]
pub fn delete_article_db(state: State<AppState>, id: String) -> Result<(), String> {
    state.storage.db_delete_article(&id)
}

#[tauri::command]
pub fn list_all_articles_db(state: State<AppState>) -> Result<Vec<crate::db::ArticleRow>, String> {
    Ok(state.storage.db_list_all_articles())
}
