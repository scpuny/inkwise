// skill/frontmatter.rs — Markdown Frontmatter 解析
use super::types::ToolCapability;

// ─── Frontmatter parser (minimal, no deps) ───

#[derive(Default)]
pub(crate) struct Frontmatter {
    pub name: Option<String>,
    pub description: Option<String>,
    pub run_as: Option<String>,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub allowed_tools: Option<String>,
}

pub(crate) fn parse_frontmatter(content: &str) -> (Frontmatter, String) {
    let content = content.trim();
    if !content.starts_with("---") {
        return (Frontmatter::default(), content.to_string());
    }

    let end = content[3..].find("---").map(|p| p + 6);
    match end {
        Some(end_pos) => {
            let fm_str = &content[3..end_pos - 3];
            let body = content[end_pos..].trim().to_string();
            let mut fm = Frontmatter::default();

            for line in fm_str.lines() {
                let line = line.trim();
                if let Some((key, value)) = line.split_once(':') {
                    let key = key.trim().to_lowercase();
                    let value = value.trim().trim_matches('"').trim().to_string();
                    match key.as_str() {
                        "name" => fm.name = Some(value),
                        "description" => fm.description = Some(value),
                        "runas" | "run_as" => fm.run_as = Some(value),
                        "model" => fm.model = Some(value),
                        "effort" => fm.effort = Some(value),
                        "allowed-tools" | "allowed_tools" => fm.allowed_tools = Some(value),
                        _ => {}
                    }
                }
            }
            (fm, body)
        }
        None => (Frontmatter::default(), content.to_string()),
    }
}

pub(crate) fn parse_tool_capabilities(s: Option<&str>) -> Vec<ToolCapability> {
    match s {
        Some(val) => val.split(',')
            .map(|s| ToolCapability::from_str(s.trim()))
            .filter_map(|t| t)
            .collect(),
        None => Vec::new(),
    }
}
