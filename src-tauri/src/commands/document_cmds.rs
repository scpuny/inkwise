// ─── Document / Article 命令 ───

use crate::domain::*;
use crate::AppState;
use tauri::State;

#[tauri::command]
pub fn save_article_content(state: State<AppState>, id: String, content: String) -> Result<(), String> {
    state.store.lock().map_err(|e| e.to_string())?.save_article_content(&id, &content)
}

#[tauri::command]
pub fn load_article_content(state: State<AppState>, id: String) -> Result<Option<String>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.load_article_content(&id))
}

#[tauri::command]
pub fn delete_article(state: State<AppState>, id: String) -> Result<(), String> {
    let store = state.store.lock().map_err(|e| e.to_string())?;
    store.delete_article_content(&id)?;
    store.delete_article_meta(&id)?;
    store.delete_blueprint(&id).ok();
    store.delete_article_document(&id).ok();
    Ok(())
}

#[tauri::command]
pub fn save_article_meta(state: State<AppState>, meta: ArticleMeta) -> Result<(), String> {
    state.store.lock().map_err(|e| e.to_string())?.save_article_meta(&meta)
}

#[tauri::command]
pub fn load_article_meta(state: State<AppState>, id: String) -> Result<Option<ArticleMeta>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.load_article_meta(&id))
}

#[tauri::command]
pub fn save_article_blueprint(state: State<AppState>, id: String, blueprint: ArticleBlueprint) -> Result<(), String> {
    state.store.lock().map_err(|e| e.to_string())?.save_blueprint(&id, &blueprint)
}

#[tauri::command]
pub fn load_article_blueprint(state: State<AppState>, id: String) -> Result<Option<ArticleBlueprint>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.load_blueprint(&id))
}

#[tauri::command]
pub fn save_article_document(state: State<AppState>, doc: ArticleDocument) -> Result<(), String> {
    state.store.lock().map_err(|e| e.to_string())?.save_article_document(&doc)
}

#[tauri::command]
pub fn load_article_document(state: State<AppState>, id: String) -> Result<Option<ArticleDocument>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.load_article_document(&id))
}

// ─── DB-backed article commands ───

#[tauri::command]
pub fn save_article_db(state: State<AppState>, article: crate::db::ArticleRow) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.save_article(&article).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_article_db(state: State<AppState>, id: String) -> Result<Option<crate::db::ArticleRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.get_article(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_article_db(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.delete_article(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_all_articles_db(state: State<AppState>) -> Result<Vec<crate::db::ArticleRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.list_all_articles().map_err(|e| e.to_string())
}
