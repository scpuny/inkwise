// ─── Collection / Database 命令 ───

use crate::domain::*;
use crate::AppState;
use tauri::State;

// ─── JSON-backed collection commands ───

#[tauri::command]
pub fn get_collections(state: State<AppState>) -> Result<Vec<Collection>, String> {
    Ok(state.storage.load_collections())
}

#[tauri::command]
pub fn set_collections(state: State<AppState>, collections: Vec<Collection>) -> Result<(), String> {
    state.storage.save_collections(&collections)
}

#[tauri::command]
pub fn get_trash(state: State<AppState>) -> Result<Vec<TrashItem>, String> {
    Ok(state.storage.load_trash())
}

#[tauri::command]
pub fn set_trash(state: State<AppState>, trash: Vec<TrashItem>) -> Result<(), String> {
    state.storage.save_trash(&trash)
}

// ─── DB-backed collection commands ───

#[tauri::command]
pub fn list_collections_db(state: State<AppState>) -> Result<Vec<crate::db::CollectionRow>, String> {
    Ok(state.storage.db_list_collections())
}

#[tauri::command]
pub fn create_collection_db(state: State<AppState>, id: String, title: String, created_at: i64) -> Result<(), String> {
    state.storage.db_create_collection(&id, &title, 0, created_at)
}

#[tauri::command]
pub fn rename_collection_db(state: State<AppState>, id: String, title: String) -> Result<(), String> {
    state.storage.db_rename_collection(&id, &title)
}

#[tauri::command]
pub fn delete_collection_db(state: State<AppState>, id: String) -> Result<(), String> {
    state.storage.db_delete_collection(&id)
}

#[tauri::command]
pub fn link_collection_folder_db(state: State<AppState>, id: String, folder: String) -> Result<(), String> {
    state.storage.db_update_collection_folder(&id, Some(&folder))
}

#[tauri::command]
pub fn unlink_collection_folder(state: State<AppState>, id: String) -> Result<(), String> {
    state.storage.db_update_collection_folder(&id, None)
}
