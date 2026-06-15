mod store;
mod ai;

use store::{Collection, DataStore, Provider, TrashItem, AppSettings, ArticleMeta};
use ai::{chat_completion, fetch_available_models, ChatRequest, ChatMessage, ProviderConfig, ProviderListConfig};
use std::sync::Mutex;
use tauri::Manager;

struct AppState {
    store: Mutex<DataStore>,
}

#[allow(dead_code)]
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64
}

// ─── Collections ───

#[tauri::command]
fn get_collections(state: tauri::State<AppState>) -> Vec<Collection> {
    state.store.lock().unwrap().load_collections()
}

#[tauri::command]
fn set_collections(state: tauri::State<AppState>, collections: Vec<Collection>) -> Result<(), String> {
    state.store.lock().unwrap().save_collections(&collections)
}

#[tauri::command]
fn get_trash(state: tauri::State<AppState>) -> Vec<TrashItem> {
    state.store.lock().unwrap().load_trash()
}

#[tauri::command]
fn set_trash(state: tauri::State<AppState>, trash: Vec<TrashItem>) -> Result<(), String> {
    state.store.lock().unwrap().save_trash(&trash)
}

// ─── Providers ───

#[tauri::command]
fn get_providers(state: tauri::State<AppState>) -> Vec<Provider> {
    state.store.lock().unwrap().load_providers()
}

#[tauri::command]
fn set_providers(state: tauri::State<AppState>, providers: Vec<Provider>) -> Result<(), String> {
    state.store.lock().unwrap().save_providers(&providers)
}

// ─── Settings ───

#[tauri::command]
fn get_settings(state: tauri::State<AppState>) -> AppSettings {
    state.store.lock().unwrap().load_settings()
}

#[tauri::command]
fn set_settings(state: tauri::State<AppState>, settings: AppSettings) -> Result<(), String> {
    state.store.lock().unwrap().save_settings(&settings)
}

// ─── AI Chat ───

#[tauri::command]
async fn chat(state: tauri::State<'_, AppState>, provider_id: String, model: String, messages: Vec<ChatMessage>, temperature: Option<f32>, max_tokens: Option<u32>) -> Result<String, String> {
    let config = {
        let store = state.store.lock().unwrap();
        let providers = store.load_providers();
        let provider = providers.iter().find(|p| p.id == provider_id).ok_or_else(|| format!("未找到提供商: {}", provider_id))?.clone();
        ProviderConfig {
            id: provider.id.clone(),
            kind: provider.kind.clone(),
            base_url: provider.base_url.clone().unwrap_or_else(|| {
                match provider.kind.as_str() {
                    "anthropic" => "https://api.anthropic.com/v1".into(),
                    "deepseek" => "https://api.deepseek.com/v1".into(),
                    _ => "https://api.openai.com/v1".into(),
                }
            }),
            api_key: provider.api_key.clone().ok_or("未配置 API Key")?,
            model: model.clone(),
        }
    };

    let req = ChatRequest {
        provider_id,
        model,
        messages,
        temperature,
        max_tokens,
        stream: false,
    };

    chat_completion(&config, &req).await
}

// ─── Fetch models from provider API ───

#[tauri::command]
async fn fetch_models(state: tauri::State<'_, AppState>, provider_id: String) -> Result<Vec<String>, String> {
    let config = {
        let store = state.store.lock().unwrap();
        let providers = store.load_providers();
        let provider = providers.iter().find(|p| p.id == provider_id).ok_or_else(|| format!("未找到提供商: {}", provider_id))?.clone();
        ProviderListConfig {
            id: provider.id.clone(),
            kind: provider.kind.clone(),
            base_url: provider.base_url.clone().unwrap_or_else(|| {
                match provider.kind.as_str() {
                    "anthropic" => "https://api.anthropic.com/v1".into(),
                    _ => "https://api.openai.com/v1".into(),
                }
            }),
            api_key: provider.api_key.clone().ok_or("未配置 API Key")?,
        }
    };

    fetch_available_models(&config).await
}

/// Return all configured models from all enabled providers as a flat list.
#[tauri::command]
fn get_all_models(state: tauri::State<'_, AppState>) -> Vec<String> {
    let store = state.store.lock().unwrap();
    let providers = store.load_providers();
    let mut models: Vec<String> = providers
        .iter()
        .filter(|p| p.enabled && !p.models.is_empty())
        .flat_map(|p| p.models.clone())
        .collect();
    models.sort();
    models.dedup();
    models
}

#[tauri::command]
async fn fetch_models_from_url(kind: String, base_url: String, api_key: String) -> Result<Vec<String>, String> {
    let config = ProviderListConfig {
        id: "manual".into(),
        kind,
        base_url,
        api_key,
    };
    fetch_available_models(&config).await
}

// ─── Article content ───

#[tauri::command]
fn save_article(state: tauri::State<AppState>, id: String, content: String) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    store.save_article_content(&id, &content)
}

#[tauri::command]
fn load_article(state: tauri::State<AppState>, id: String) -> Option<String> {
    let store = state.store.lock().unwrap();
    store.load_article_content(&id)
}

#[tauri::command]
fn delete_article(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    store.delete_article_content(&id)?;
    store.delete_article_meta(&id)
}

#[tauri::command]
fn save_article_meta(state: tauri::State<AppState>, meta: ArticleMeta) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    store.save_article_meta(&meta)
}

#[tauri::command]
fn load_article_meta(state: tauri::State<AppState>, id: String) -> Option<ArticleMeta> {
    let store = state.store.lock().unwrap();
    store.load_article_meta(&id)
}

// ─── App entry ───

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            app.manage(AppState {
                store: Mutex::new(DataStore::new(app_dir)),
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_collections,
            set_collections,
            get_trash,
            set_trash,
            get_providers,
            set_providers,
            get_settings,
            set_settings,
            chat,
            fetch_models,
            fetch_models_from_url,
            get_all_models,
            save_article,
            load_article,
            delete_article,
            save_article_meta,
            load_article_meta,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
