// ─── Collection / Database 命令 ───

use crate::domain::*;
use crate::AppState;
use tauri::State;

// ─── JSON-backed collection commands ───

#[tauri::command]
pub fn get_collections(state: State<AppState>) -> Result<Vec<Collection>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.load_collections())
}

#[tauri::command]
pub fn set_collections(state: State<AppState>, collections: Vec<Collection>) -> Result<(), String> {
    state.store.lock().map_err(|e| e.to_string())?.save_collections(&collections)
}

#[tauri::command]
pub fn get_trash(state: State<AppState>) -> Result<Vec<TrashItem>, String> {
    Ok(state.store.lock().map_err(|e| e.to_string())?.load_trash())
}

#[tauri::command]
pub fn set_trash(state: State<AppState>, trash: Vec<TrashItem>) -> Result<(), String> {
    state.store.lock().map_err(|e| e.to_string())?.save_trash(&trash)
}

// ─── DB-backed collection commands ───

#[tauri::command]
pub fn list_collections_db(state: State<AppState>) -> Result<Vec<crate::db::CollectionRow>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.list_collections().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_collection_db(state: State<AppState>, id: String, title: String, created_at: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.create_collection(&id, &title, 0, created_at).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn rename_collection_db(state: State<AppState>, id: String, title: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.rename_collection(&id, &title).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_collection_db(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.delete_collection(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn link_collection_folder_db(state: State<AppState>, id: String, folder: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.update_collection_folder(&id, Some(&folder)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn unlink_collection_folder(state: State<AppState>, id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.as_ref().ok_or("数据库未初始化")?.update_collection_folder(&id, None).map_err(|e| e.to_string())
}
