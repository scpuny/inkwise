mod store;
mod ai;
mod skill;
mod agent;
mod db;
mod project_indexer;
mod platform;
use platform::Platform;
use platform::wechat::WeChat;

use store::{Collection, DataStore, Provider, TrashItem, AppSettings, AiConfig, ArticleMeta, ArticleBlueprint, SeriesPlan, PlatformConfig, PublishRecord, WritingSkill, PhaseConfig, ContextSource, StyleDimension};
use ai::{chat_completion, fetch_available_models, ChatRequest, ChatMessage, ProviderConfig, ProviderListConfig};
use project_indexer::{ProjectContext, scan_project, build_context_text};
use skill::{Skill, SkillStore, RunAs, builtin_skills};
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

struct AppState {
    store: Mutex<DataStore>,
    db: Mutex<Option<db::Database>>,
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
// ─── AI Config ───

#[tauri::command]
fn get_ai_config(state: tauri::State<AppState>) -> Option<AiConfig> {
    state.store.lock().unwrap().load_ai_config()
}

#[tauri::command]
fn set_ai_config(state: tauri::State<AppState>, config: AiConfig) -> Result<(), String> {
    state.store.lock().unwrap().save_ai_config(&config)
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

// ─── Streaming Chat ───

#[tauri::command]
async fn chat_stream(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    provider_id: String,
    model: String,
    messages: Vec<ChatMessage>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
) -> Result<(), String> {
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
        stream: true,
    };

    // Emit start event
    let _ = app.emit("chat:start", serde_json::json!({}));

    let app_clone = app.clone();
    let on_token: ai::TokenCallback = Box::new(move |token: String| {
        let _ = app_clone.emit("chat:token", serde_json::json!({ "token": token }));
    });

    match ai::chat_completion_stream(&config, &req, on_token).await {
        Ok(full_content) => {
            let _ = app.emit("chat:done", serde_json::json!({ "content": full_content }));
        }
        Err(e) => {
            let _ = app.emit("chat:error", serde_json::json!({ "error": e }));
        }
    }

    Ok(())
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
    store.delete_article_meta(&id)?;
    store.delete_blueprint(&id).ok();
    Ok(())
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

// ─── Writing Skills ───

#[tauri::command]
fn list_writing_skills(state: tauri::State<AppState>) -> Vec<WritingSkill> {
    let store = state.store.lock().unwrap();
    store.load_writing_skills()
}

#[tauri::command]
fn save_writing_skill(state: tauri::State<AppState>, skill: WritingSkill) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let mut skills = store.load_writing_skills();
    // Replace existing or add new
    if let Some(pos) = skills.iter().position(|s| s.id == skill.id) {
        skills[pos] = skill;
    } else {
        skills.push(skill);
    }
    store.save_writing_skills(&skills)
}

#[tauri::command]
fn delete_writing_skill(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let mut skills = store.load_writing_skills();
    skills.retain(|s| s.id != id);
    store.save_writing_skills(&skills)
}

// ─── Skills ───

fn get_skill_store(state: &AppState) -> SkillStore {
    let store = state.store.lock().unwrap();
    let data_dir = store.data_dir().parent().unwrap().to_path_buf();
    let global_dir = data_dir.join("skills");
    drop(store);

    let mut skill_store = SkillStore::new(global_dir, None);
    for builtin in builtin_skills() {
        skill_store.add_builtin(builtin);
    }
    skill_store
}

#[tauri::command]
fn list_skills(state: tauri::State<AppState>) -> Vec<Skill> {
    let disabled = {
        let store = state.store.lock().unwrap();
        let data_dir = store.data_dir().parent().unwrap().to_path_buf();
        drop(store);
        let disabled_list_path = data_dir.join("disabled_skills.json");
        if disabled_list_path.exists() {
            std::fs::read_to_string(&disabled_list_path)
                .ok()
                .and_then(|c| serde_json::from_str(&c).ok())
                .unwrap_or_default()
        } else { vec![] }
    };

    let mut skills = get_skill_store(&state).list();
    for skill in &mut skills {
        if disabled.contains(&skill.name) {
            skill.enabled = false;
        }
    }
    skills
}

#[tauri::command]
fn read_skill(state: tauri::State<AppState>, name: String) -> Option<Skill> {
    let skill_store = get_skill_store(&state);
    skill_store.find(&name)
}

#[tauri::command]
async fn run_skill(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
    user_input: String,
    document_content: Option<String>,
    selected_text: Option<String>,
    blueprint: Option<ArticleBlueprint>,
    current_section_id: Option<String>,
) -> Result<agent::AgentResult, String> {
    let provider_info = {
        let store = state.store.lock().unwrap();
        let providers = store.load_providers();
        let data_dir = store.data_dir().parent().unwrap().to_path_buf();
        let global_dir = data_dir.join("skills");
        drop(store);

        let mut skill_store = SkillStore::new(global_dir, None);
        for builtin in builtin_skills() {
            skill_store.add_builtin(builtin);
        }

        let skill = skill_store.find(&name).ok_or_else(|| format!("未找到 skill: {}", name))?;
        let provider = providers.iter().find(|p| p.enabled && p.models.len() > 0)
            .ok_or_else(|| "没有已启用的 AI 提供商".to_string())?;

        let model = skill.model.clone().unwrap_or_else(|| provider.models[0].clone());
        let config = ProviderConfig {
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
        };

        (skill, config, model)
    };

    let (skill, config, _model) = provider_info;

    // Set up streaming callback
    let app_clone = app.clone();
    let on_token: Option<ai::TokenCallback> = Some(Box::new(move |token: String| {
        let _ = app_clone.emit("chat:token", serde_json::json!({ "token": token }));
    }));

    let agent_context = agent::AgentContext {
        document_content: document_content.unwrap_or_default(),
        selected_text,
        user_input,
        blueprint,
        current_section_id,
    };

    let result = agent::execute_agent(&skill, &config, &agent_context, on_token).await?;

    let _ = app.emit("chat:done", serde_json::json!({ "content": result.content }));

    Ok(result)
}

#[tauri::command]
fn install_skill(state: tauri::State<AppState>, name: String, description: String, body: String, run_as: String) -> Result<String, String> {
    let store = state.store.lock().unwrap();
    let data_dir = store.data_dir().parent().unwrap().to_path_buf();
    let global_dir = data_dir.join("skills");
    drop(store);

    let skill_store = SkillStore::new(global_dir, None);
    let run_as_enum = match run_as.as_str() {
        "subagent" => RunAs::Subagent,
        _ => RunAs::Inline,
    };
    skill_store.install(&name, &description, &body, &run_as_enum)
}

#[tauri::command]
fn delete_skill(state: tauri::State<AppState>, name: String) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let data_dir = store.data_dir().parent().unwrap().to_path_buf();
    let global_dir = data_dir.join("skills");
    drop(store);

    let skill_dir = global_dir.join(&name);
    let skill_md = skill_dir.join("SKILL.md");
    if skill_md.exists() {
        std::fs::remove_file(&skill_md).map_err(|e| e.to_string())?;
        // Also try to remove the directory if empty
        std::fs::remove_dir(&skill_dir).ok();
        Ok(())
    } else {
        Err(format!("Skill '{}' 文件未找到", name))
    }
}

#[tauri::command]
fn set_skill_enabled(state: tauri::State<AppState>, name: String, enabled: bool) -> Result<(), String> {
    let store = state.store.lock().unwrap();
    let data_dir = store.data_dir().parent().unwrap().to_path_buf();
    let _global_dir = data_dir.join("skills");
    drop(store);

    let disabled_list_path = data_dir.join("disabled_skills.json");
    let mut disabled: Vec<String> = if disabled_list_path.exists() {
        std::fs::read_to_string(&disabled_list_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        vec![]
    };

    if enabled {
        disabled.retain(|n| n != &name);
    } else if !disabled.contains(&name) {
        disabled.push(name);
    }

    let content = serde_json::to_string_pretty(&disabled).map_err(|e| e.to_string())?;
    std::fs::write(&disabled_list_path, &content).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_disabled_skills(state: tauri::State<AppState>) -> Vec<String> {
    let store = state.store.lock().unwrap();
    let data_dir = store.data_dir().parent().unwrap().to_path_buf();
    drop(store);

    let disabled_list_path = data_dir.join("disabled_skills.json");
    if disabled_list_path.exists() {
        std::fs::read_to_string(&disabled_list_path)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
            .unwrap_or_default()
    } else {
        vec![]
    }
}

#[tauri::command]
async fn generate_skill(state: tauri::State<'_, AppState>, name: String, description: String) -> Result<String, String> {
    // Get provider info
    let (config, model) = {
        let store = state.store.lock().unwrap();
        let providers = store.load_providers();
        drop(store);

        let provider = providers.iter().find(|p| p.enabled && p.models.len() > 0)
            .ok_or_else(|| "没有已启用的 AI 提供商".to_string())?;

        let model = provider.models[0].clone();
        let config = ProviderConfig {
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
        };
        (config, model)
    };

    let system_prompt = "你是 Skill 生成器。根据用户提供的名称和描述，生成一个完整的 Skill 定义文件。

Skill 是一个 Markdown 文件，包含：
- frontmatter: name, description, runAs (inline/subagent), allowed-tools
- body: 写作规则、输出要求、示例

请直接输出 Markdown body 内容（不含 frontmatter），使用中文。";

    let user_prompt = format!("名称: {}\n描述: {}", name, description);

    let messages = vec![
        ChatMessage { role: "system".into(), content: system_prompt.into() },
        ChatMessage { role: "user".into(), content: user_prompt },
    ];

    let req = ChatRequest {
        provider_id: config.id.clone(),
        model,
        messages,
        temperature: Some(0.7),
        max_tokens: Some(2048),
        stream: false,
    };

    ai::chat_completion(&config, &req).await
}


// ─── Blueprint ───

#[tauri::command]
fn save_article_blueprint(state: tauri::State<AppState>, id: String, blueprint: ArticleBlueprint) -> Result<(), String> {
    state.store.lock().unwrap().save_blueprint(&id, &blueprint)
}

#[tauri::command]
fn load_article_blueprint(state: tauri::State<AppState>, id: String) -> Option<ArticleBlueprint> {
    state.store.lock().unwrap().load_blueprint(&id)
}



// ─── Database SQLite Commands ───

/// Migrate JSON data to SQLite
#[tauri::command]
async fn migrate_to_sqlite(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    let mut total = 0usize;
    
    // Get DB handle
    let db_guard = state.db.lock().map_err(|e| e.to_string())?;
    let db = db_guard.as_ref().ok_or("数据库未初始化")?;
    
    // Get store for reading JSON data
    let store = state.store.lock().map_err(|e| e.to_string())?;
    let collections = store.load_collections();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64;
    
    for col in &collections {
        // Check if already migrated
        let existing = db.list_collections().map_err(|e| e.to_string())?;
        if existing.iter().any(|c| c.id == col.id) {
            continue;
        }
        db.create_collection(&col.id, &col.title, 0, now).map_err(|e| e.to_string())?;
    }
    
    for col in &collections {
        for article in &col.articles {
            // Skip if already migrated
            if let Ok(Some(_)) = db.get_article(&article.id).map_err(|e| e.to_string()) {
                continue;
            }
            
            let content = store.load_article_content(&article.id).unwrap_or_default();
            let blueprint = store.load_blueprint(&article.id);
            
            let (description, tags, tone, audience, target_word_count, outline, phase, status) = 
                if let Some(bp) = blueprint {
                    (bp.description, serde_json::to_string(&bp.tags).unwrap_or_default(),
                     bp.tone, bp.target_audience, bp.target_word_count.map(|w| w as i64),
                     serde_json::to_string(&bp.outline).unwrap_or_default(),
                     bp.phase, "draft".to_string())
                } else {
                    (String::new(), "[]".to_string(), None, None, None,
                     "[]".to_string(), "planning".to_string(), "draft".to_string())
                };
            
            let title = article.title.clone();
            let updated_at = article.updated_at as i64;
            let created_at = article.created_at as i64;
            
            db.save_article(&db::ArticleRow {
                id: article.id.clone(),
                collection_id: col.id.clone(),
                title,
                content,
                description,
                tags,
                tone,
                audience,
                target_word_count,
                outline,
                phase,
                status,
                word_count: 0,
                collection_title: None,
                created_at,
                updated_at,
            }).map_err(|e| e.to_string())?;
            total += 1;
        }
    }
    
    // Migrate settings
    let settings = store.load_settings();
    let _ = db.set_setting("theme", &settings.theme);
    let _ = db.set_setting("theme_style", &settings.theme_style);
    let _ = db.set_setting("font_family", &settings.font_family);
    let _ = db.set_setting("text_size", &settings.text_size);
    
    Ok(total)
}
/// List all collections from DB
#[tauri::command]
fn list_collections_db(state: tauri::State<AppState>) -> Result<Vec<db::CollectionRow>, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.list_collections().map_err(|e| e.to_string())
}

/// Create a collection
#[tauri::command]
fn create_collection_db(state: tauri::State<AppState>, title: String, linked_folder: Option<String>) -> Result<db::CollectionRow, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    let id = format!("col_{}", chrono_now());
    let now = chrono_now();
    db.create_collection(&id, &title, 0, now).map_err(|e| e.to_string())?;
    db.list_collections().map_err(|e| e.to_string())?.into_iter().find(|c| c.id == id).ok_or("创建失败".to_string())
}

/// Rename a collection
#[tauri::command]
fn rename_collection_db(state: tauri::State<AppState>, id: String, title: String) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.rename_collection(&id, &title).map_err(|e| e.to_string())
}

/// Delete a collection
#[tauri::command]
fn delete_collection_db(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.delete_collection(&id).map_err(|e| e.to_string())
}

/// List articles from DB, optionally filtered by collection
#[tauri::command]
fn list_articles_db(state: tauri::State<AppState>, collection_id: Option<String>) -> Result<Vec<db::ArticleRow>, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.list_articles(collection_id.as_deref(), None, 0, 1000).map_err(|e| e.to_string())
}

/// Get a single article
#[tauri::command]
fn get_article_db(state: tauri::State<AppState>, id: String) -> Result<Option<db::ArticleRow>, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.get_article(&id).map_err(|e| e.to_string())
}

/// Save (insert or replace) an article
#[tauri::command]
fn save_article_db(state: tauri::State<AppState>, article: db::ArticleRow) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.save_article(&article).map_err(|e| e.to_string())
}

/// Delete an article
#[tauri::command]
fn delete_article_db(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.delete_article(&id).map_err(|e| e.to_string())
}

/// Move an article to a different collection
#[tauri::command]
fn move_article_db(state: tauri::State<AppState>, id: String, new_collection_id: String) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.move_article(&id, &new_collection_id).map_err(|e| e.to_string())
}

/// FTS5 search across articles
#[tauri::command]
fn search_articles_db(state: tauri::State<AppState>, query: String, limit: Option<i64>) -> Result<Vec<db::SearchResult>, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.search(&query, limit.unwrap_or(20)).map_err(|e| e.to_string())
}

/// List ALL articles (for management page)
#[tauri::command]
fn list_all_articles_db(state: tauri::State<AppState>) -> Result<Vec<db::ArticleRow>, String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.list_all_articles().map_err(|e| e.to_string())
}

/// Link a folder to a collection
#[tauri::command]
fn link_folder_db(state: tauri::State<AppState>, collection_id: String, path: String) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.update_collection_folder(&collection_id, Some(&path)).map_err(|e| e.to_string())
}

/// Unlink a folder from a collection
#[tauri::command]
fn unlink_folder_db(state: tauri::State<AppState>, collection_id: String) -> Result<(), String> {
    let db_opt = state.db.lock().unwrap();
    let db = db_opt.as_ref().ok_or("数据库未初始化")?;
    db.update_collection_folder(&collection_id, None).map_err(|e| e.to_string())
}

fn chrono_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

// ─── App entry ───


#[tauri::command]
fn read_folder_context(path: String) -> Result<String, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("路径不是有效的文件夹".into());
    }

    let mut context = String::new();

    // Read README if exists
    for readme_name in &["README.md", "README", "README.txt", "readme.md",] {
        let readme_path = dir.join(readme_name);
        if readme_path.exists() {
            match std::fs::read_to_string(&readme_path) {
                Ok(content) => {
                    context.push_str(&format!("# README ({})\n\n{}\n\n", readme_name, content));
                }
                Err(_) => {}
            }
            break;
        }
    }

    // Read package.json if exists
    let pkg_path = dir.join("package.json");
    if pkg_path.exists() {
        match std::fs::read_to_string(&pkg_path) {
            Ok(content) => {
                context.push_str(&format!("# package.json\n{}\n\n", content));
            }
            Err(_) => {}
        }
    }

    // Directory structure
    context.push_str("# 目录结构\n\n");
    let _ = list_directory_structure(dir, &mut context, 0, 2);

    // Read .md files in root
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(ext) = entry_path.extension() {
                    if ext == "md" {
                        if let Some(name) = entry_path.file_name() {
                            let name_str = name.to_string_lossy();
                            if !name_str.to_lowercase().starts_with("readme") {
                                if let Ok(content) = std::fs::read_to_string(&entry_path) {
                                    if content.len() < 2000 {
                                        context.push_str(&format!("# {}\n{}\n\n", name_str, content));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if context.is_empty() {
        context = "（空文件夹，没有找到可读取的上下文文件）".to_string();
    }

    Ok(context)
}

fn list_directory_structure(dir: &std::path::Path, output: &mut String, depth: usize, max_depth: usize) -> Result<(), std::io::Error> {
    if depth > max_depth { return Ok(()); }

    let prefix = "  ".repeat(depth);
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

            // Skip hidden files and common dirs
            if name.starts_with('.') || name == "node_modules" || name == "target" {
                continue;
            }

            if path.is_dir() {
                output.push_str(&format!("{}{}/\n", prefix, name));
                list_directory_structure(&path, output, depth + 1, max_depth)?;
            } else {
                output.push_str(&format!("{}{}\n", prefix, name));
            }
        }
    }
    Ok(())
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::sync::Arc;
    
    let result = Arc::new(std::sync::Mutex::new(None::<String>));
    let done = Arc::new(AtomicBool::new(false));
    
    let result_clone = result.clone();
    let done_clone = done.clone();
    
    app.dialog()
        .file()
        .pick_folder(move |path| {
            if let Some(path_buf) = path {
                let _ = result_clone.lock().map(|mut r| *r = Some(path_buf.to_string()));
            }
            done_clone.store(true, Ordering::SeqCst);
        });
    
    // Wait for the dialog to close (async callback)
    while !done.load(Ordering::SeqCst) {
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    
    let path = result.lock().map_err(|e| e.to_string())?.take();
    Ok(path)
}

/// Build an index of a folder's structure and key contents for AI context.
/// Returns a JSON summary that can be cached and reused.
#[tauri::command]
async fn build_folder_index(path: String) -> Result<String, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("路径不是有效的文件夹".into());
    }

    let mut index = Vec::<String>::new();
    
    // 1. Collect directory structure (2 levels deep)
    index.push("## 目录结构".to_string());
    let _ = collect_structure(dir, &mut index, 0, 2, &mut std::collections::HashSet::new());
    index.push(String::new());
    
    // 2. Read key files (README, package.json, Cargo.toml, etc.)
    for entry_name in &["README.md", "README", "package.json", "Cargo.toml", "pyproject.toml"] {
        let entry_path = dir.join(entry_name);
        if entry_path.exists() && entry_path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&entry_path) {
                let truncated = if content.len() > 3000 {
                    format!("{}...\n[内容太长，已截断]", &content[..3000])
                } else {
                    content
                };
                index.push(format!("## 文件: {}\n```\n{}\n```\n", entry_name, truncated));
            }
        }
    }
    
    // 3. Summarize .md and .txt files in root
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let entry_path = entry.path();
            if entry_path.is_file() {
                if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                    if matches!(ext, "md" | "txt" | "rs" | "ts" | "js" | "py" | "toml" | "json" | "yaml" | "yml") {
                        if let Some(name) = entry_path.file_name().and_then(|n| n.to_str()) {
                            if name.starts_with('.') { continue; }
                            // Skip already-read files
                            if matches!(name, "README.md" | "README" | "package.json" | "Cargo.toml" | "pyproject.toml") { continue; }
                            if let Ok(content) = std::fs::read_to_string(&entry_path) {
                                if content.len() > 5000 {
                                    // Just note the file exists with stats
                                    let lines = content.lines().count();
                                    let words = content.split_whitespace().count();
                                    index.push(format!("- {} ({} 行, ~{} 词)", name, lines, words));
                                } else {
                                    index.push(format!("## 文件: {}\n```\n{}\n```\n", name, content));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    
    Ok(index.join("\n"))
}


#[tauri::command]
async fn link_collection_folder(state: tauri::State<'_, AppState>, collection_id: String, path: String) -> Result<ProjectContext, String> {
    // Validate path
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("路径不是有效的文件夹".into());
    }
    // Scan the project
    let ctx = scan_project(&path, false)?;
    // Save the link info (via existing store - collections will be updated from frontend)
    // The frontend calls set_collections after linking
    Ok(ctx)
}

#[tauri::command]
fn unlink_collection_folder(_state: tauri::State<'_, AppState>, _collection_id: String) -> Result<(), String> {
    // Frontend handles removing linkedFolder from collection data
    // This is a placeholder for any server-side cleanup
    Ok(())
}

#[tauri::command]
async fn get_project_context(path: String) -> Result<ProjectContext, String> {
    scan_project(&path, false)
}

#[tauri::command]
async fn get_project_context_text(path: String) -> Result<String, String> {
    let ctx = scan_project(&path, false)?;
    Ok(build_context_text(&ctx))
}

#[tauri::command]
async fn rescan_project_folder(path: String) -> Result<ProjectContext, String> {
    scan_project(&path, true)
}

#[tauri::command]
fn read_project_files(path: String, files: Vec<String>) -> Result<Vec<serde_json::Value>, String> {
    let mut results = Vec::new();
    for rel_path in &files {
        let full_path = std::path::PathBuf::from(&path).join(rel_path);
        match std::fs::read_to_string(&full_path) {
            Ok(content) => {
                let size = content.len();
                // Truncate files larger than 50KB
                let truncated = if size > 51200 {
                    let truncated_content: String = content.chars().take(51200).collect();
                    format!("{}...(文件过大，已截断前 50KB)", truncated_content)
                } else {
                    content
                };
                results.push(serde_json::json!({
                    "path": rel_path,
                    "content": truncated,
                    "size": size,
                    "truncated": size > 51200
                }));
            }
            Err(e) => {
                results.push(serde_json::json!({
                    "path": rel_path,
                    "error": format!("无法读取文件: {}", e)
                }));
            }
        }
    }
    Ok(results)
}

// ─── Series Plan commands ───

#[tauri::command]
fn save_series_plan(state: tauri::State<'_, AppState>, collection_id: String, plan: SeriesPlan) -> Result<(), String> {
    state.store.lock().unwrap().save_series_plan(&collection_id, &plan)
}

#[tauri::command]
fn save_all_series_plans(state: tauri::State<'_, AppState>, collection_id: String, plans: Vec<SeriesPlan>) -> Result<(), String> {
    state.store.lock().unwrap().save_all_series_plans(&collection_id, &plans)
}

#[tauri::command]
fn load_all_series_plans(state: tauri::State<'_, AppState>, collection_id: String) -> Result<Vec<SeriesPlan>, String> {
    Ok(state.store.lock().unwrap().load_all_series_plans(&collection_id))
}

#[tauri::command]
fn load_series_plan(state: tauri::State<'_, AppState>, collection_id: String, series_id: String) -> Result<Option<SeriesPlan>, String> {
    Ok(state.store.lock().unwrap().load_series_plan(&collection_id, &series_id))
}

#[tauri::command]
fn delete_series_plan(state: tauri::State<'_, AppState>, collection_id: String, series_id: String) -> Result<(), String> {
    state.store.lock().unwrap().delete_series_plan(&collection_id, &series_id)
}



// ─── Platform Config ───

#[tauri::command]
fn get_platform_configs(state: tauri::State<AppState>) -> Vec<PlatformConfig> {
    state.store.lock().unwrap().load_platform_configs()
}

#[tauri::command]
fn save_platform_config(state: tauri::State<AppState>, config: PlatformConfig) -> Result<(), String> {
    let mut configs = state.store.lock().unwrap().load_platform_configs();
    if let Some(existing) = configs.iter_mut().find(|c| c.id == config.id) {
        *existing = config;
    } else {
        configs.push(config);
    }
    state.store.lock().unwrap().save_platform_configs(&configs)
}

#[tauri::command]
fn delete_platform_config(state: tauri::State<AppState>, id: String) -> Result<(), String> {
    let mut configs = state.store.lock().unwrap().load_platform_configs();
    configs.retain(|c| c.id != id);
    state.store.lock().unwrap().save_platform_configs(&configs)
}

#[tauri::command]
async fn verify_platform_credentials(_state: tauri::State<'_, AppState>, _platform: String, app_id: String, app_secret: String) -> Result<bool, String> {
    platform::wechat::verify_credentials(&app_id, &app_secret).await
}

// ─── Network ───

#[tauri::command]
async fn check_public_ip() -> Result<String, String> {
    let apis = vec![
        "https://httpbin.org/ip",
        "https://checkip.amazonaws.com",
        "https://icanhazip.com",
    ];
    for url in apis {
        match reqwest::get(url).await {
            Ok(resp) => {
                if !resp.status().is_success() { continue; }
                let text = resp.text().await.unwrap_or_default();
                let trimmed = text.trim();
                // Try JSON response (httpbin)
                if trimmed.starts_with('{') {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(trimmed) {
                        if let Some(origin) = json.get("origin").and_then(|v| v.as_str()) {
                            return Ok(origin.to_string());
                        }
                    }
                }
                // Plain text response (checkip, icanhazip)
                if !trimmed.is_empty() && trimmed.chars().all(|c| c.is_ascii_digit() || c == '.') {
                    return Ok(trimmed.to_string());
                }
            }
            Err(_) => continue,
        }
    }
    Err("无法获取公网 IP".into())
}


// ─── Publish Records ───

#[tauri::command]
fn get_publish_history(state: tauri::State<AppState>, article_id: String) -> Vec<PublishRecord> {
    let records = state.store.lock().unwrap().load_publish_records();
    records.into_iter().filter(|r| r.article_id == article_id).collect()
}


// ─── Publish ───

#[tauri::command]
async fn publish_to_platform(
    styled_html: String,
    state: tauri::State<'_, AppState>,
    article_id: String,
    platform: String,
    markdown: String,
    options: platform::PublishOptions,
    action: String,
) -> Result<platform::PublishResult, String> {
    if platform != "wechat" {
        return Err(format!("不支持的平台: {}", platform));
    }

    let (app_id, app_secret) = {
        let store = state.store.lock().unwrap();
        let configs = store.load_platform_configs();
        let wechat_cfg = configs.iter().find(|c| c.platform == "wechat" && c.enabled)
            .ok_or("未找到已启用的微信公众号配置")?.clone();
        (wechat_cfg.app_id, wechat_cfg.app_secret)
    };

    let article_dir = {
        let store = state.store.lock().unwrap();
        store.articles_dir().to_string_lossy().to_string()
    };

    let mut wechat = WeChat::new(app_id, app_secret);
    wechat.publish(&article_dir, &markdown, &styled_html, &options, &action).await
}


#[tauri::command]
fn save_publish_records(state: tauri::State<AppState>, records: Vec<PublishRecord>) -> Result<(), String> {
    state.store.lock().unwrap().save_publish_records(&records)
}

fn collect_structure(
    dir: &std::path::Path,
    output: &mut Vec<String>,
    depth: usize,
    max_depth: usize,
    seen: &mut std::collections::HashSet<std::path::PathBuf>,
) -> Result<(), std::io::Error> {
    if depth > max_depth || !seen.insert(dir.to_path_buf()) { return Ok(()); }
    
    let prefix = "  ".repeat(depth);
    if let Ok(entries) = std::fs::read_dir(dir) {
        let mut items: Vec<_> = entries.flatten().collect();
        items.sort_by_key(|e| {
            let name = e.file_name().to_string_lossy().to_lowercase();
            (e.path().is_dir(), name)
        });
        
        for entry in items {
            let path = entry.path();
            let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
            
            if name.starts_with('.') || name == "node_modules" || name == "target" || name == ".git" {
                continue;
            }
            
            if path.is_dir() {
                output.push(format!("{}{}/", prefix, name));
                collect_structure(&path, output, depth + 1, max_depth, seen)?;
            } else {
                output.push(format!("{}{}", prefix, name));
            }
        }
    }
    Ok(())
}
/// Recursively copy a directory
fn copy_dir_recursive(src: &std::path::Path, dst: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if !dst_path.exists() {
            std::fs::copy(&src_path, &dst_path)?;
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_dir = app.path().app_data_dir().expect("failed to get app data dir");
            std::fs::create_dir_all(&app_dir).ok();
            // Migrate data from old com.aiwriter.desktop if fresh install
            let old_app_dir = app_dir.parent().map(|p| p.join("com.aiwriter.desktop"));
            if let Some(ref old_dir) = old_app_dir {
                if !app_dir.join("data/collections.json").exists()
                    && old_dir.join("data/collections.json").exists()
                {
                    let _ = std::fs::create_dir_all(&app_dir.join("data"));
                    if let Ok(entries) = std::fs::read_dir(old_dir.join("data")) {
                        for entry in entries.flatten() {
                            let src = entry.path();
                            let dst = app_dir.join("data").join(src.file_name().unwrap_or_default());
                            if dst.exists() { continue; }
                            if src.is_dir() {
                                let _ = copy_dir_recursive(&src, &dst);
                            } else {
                                let _ = std::fs::copy(&src, &dst);
                            }
                        }
                    }
                }
            }
            let database = db::Database::open(&app_dir).ok();
            app.manage(AppState {
                store: Mutex::new(DataStore::new(app_dir.clone())),
                db: Mutex::new(database),
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            // ─── Tauri plugins ───
            app.handle().plugin(tauri_plugin_dialog::init())?;
            app.handle().plugin(tauri_plugin_fs::init())?;
            app.handle().plugin(tauri_plugin_clipboard_manager::init())?;
            app.handle().plugin(tauri_plugin_global_shortcut::Builder::default().build())?;
            app.handle().plugin(tauri_plugin_window_state::Builder::default().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
        list_writing_skills,
        save_writing_skill,
        delete_writing_skill,
            get_collections,
            set_collections,
            get_trash,
            set_trash,
            get_providers,
            set_providers,
            get_settings,
            set_settings,
            get_ai_config,
            set_ai_config,
            chat,
            chat_stream,
            fetch_models,
            fetch_models_from_url,
            get_all_models,
            save_article,
            load_article,
            delete_article,
            save_article_meta,
            load_article_meta,
            save_article_blueprint,
            load_article_blueprint,
            list_skills,
            read_skill,
            run_skill,
            install_skill,
            generate_skill,
            delete_skill,
            set_skill_enabled,
            list_disabled_skills,
            read_folder_context,
            pick_folder,
            build_folder_index,
            migrate_to_sqlite,
            list_collections_db,
            create_collection_db,
            rename_collection_db,
            delete_collection_db,
            list_articles_db,
            get_article_db,
            save_article_db,
            delete_article_db,
            move_article_db,
            search_articles_db,
            list_all_articles_db,
            link_folder_db,
            unlink_folder_db,
            link_collection_folder,
            unlink_collection_folder,
            get_project_context,
            get_project_context_text,
            rescan_project_folder,
            read_project_files,
            save_series_plan,
            save_all_series_plans,
            load_series_plan,
            load_all_series_plans,
            delete_series_plan,
            get_platform_configs,
            save_platform_config,
            delete_platform_config,
            verify_platform_credentials,
            check_public_ip,
            get_publish_history,
            save_publish_records,
            publish_to_platform])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
