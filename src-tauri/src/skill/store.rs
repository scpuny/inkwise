// skill/store.rs — SkillStore：技能文件发现、加载、安装
use super::types::*;
use super::frontmatter::{parse_frontmatter, parse_tool_capabilities};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Skill 存储：从文件系统发现、加载、安装技能
pub struct SkillStore {
    roots: Vec<PathBuf>,
    builtins: Vec<Skill>,
}

impl SkillStore {
    pub fn new(global_skills_dir: PathBuf, project_skills_dir: Option<PathBuf>) -> Self {
        let mut roots = Vec::new();

        // Global scope: ~/.reasonix/skills/, ~/.inkwise/skills/
        for name in &[".reasonix", ".inkwise"] {
            let dir = global_skills_dir.parent().map(|p| p.join(name).join("skills"))
                .unwrap_or_else(|| global_skills_dir.join(name).join("skills"));
            roots.push(dir);
        }

        // Project scope
        if let Some(project_dir) = project_skills_dir {
            roots.push(project_dir);
        }

        // Remove non-existent
        roots.retain(|p| p.exists());

        SkillStore {
            roots,
            builtins: Vec::new(),
        }
    }

    /// Discover all skills across all roots
    pub fn list(&self) -> Vec<Skill> {
        let mut skills: Vec<Skill> = Vec::new();
        let mut seen = HashMap::new();

        for root in &self.roots {
            self.discover_in(root, SkillScope::Global, &mut seen, &mut skills);
        }

        // Add builtins last (lowest priority)
        for b in &self.builtins {
            if !seen.contains_key(&b.name) {
                skills.push(b.clone());
            }
        }

        skills
    }

    fn discover_in(&self, dir: &Path, scope: SkillScope, seen: &mut HashMap<String, usize>, out: &mut Vec<Skill>) {
        if !dir.is_dir() { return; }
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                        if !seen.contains_key(name) {
                            if let Some(skill) = self.load_from(&skill_md, name, &scope) {
                                seen.insert(name.to_string(), out.len());
                                out.push(skill);
                            }
                        }
                    }
                }
            } else if path.extension().map_or(false, |e| e == "md") {
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if stem == "SKILL" { continue; }
                    if !seen.contains_key(stem) {
                        if let Some(skill) = self.load_from(&path, stem, &scope) {
                            seen.insert(stem.to_string(), out.len());
                            out.push(skill);
                        }
                    }
                }
            }
        }
    }

    pub(crate) fn load_from(&self, path: &Path, default_name: &str, scope: &SkillScope) -> Option<Skill> {
        let content = std::fs::read_to_string(path).ok()?;
        let (fm, body) = parse_frontmatter(&content);

        let name = fm.name.clone().unwrap_or_else(|| default_name.to_string());
        let description = fm.description.unwrap_or_default();
        let run_as = match fm.run_as.as_deref() {
            Some("subagent") => RunAs::Subagent,
            _ => RunAs::Inline,
        };
        let allowed_tools: Vec<ToolCapability> = parse_tool_capabilities(fm.allowed_tools.as_deref());

        Some(Skill {
            name,
            description,
            body,
            scope: scope.clone(),
            path: path.to_string_lossy().to_string(),
            run_as,
            allowed_tools,
            model: fm.model,
            effort: fm.effort,
            enabled: true,
            recommended_theme_id: None,        })
    }

    pub fn find(&self, name: &str) -> Option<Skill> {
        let skills = self.list();
        skills.into_iter().find(|s| s.name == name)
    }

    pub fn install(&self, name: &str, description: &str, body: &str, run_as: &RunAs) -> Result<String, String> {
        let root = self.roots.first().ok_or("没有可用的 skills 目录")?;
        let skill_dir = root.join(name);
        std::fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;

        let run_as_str = match run_as {
            RunAs::Inline => "inline",
            RunAs::Subagent => "subagent",
        };

        let content = format!(
            "---\nname: {}\ndescription: {}\nrunAs: {}\n---\n\n{}",
            name, description, run_as_str, body
        );

        let path = skill_dir.join("SKILL.md");
        std::fs::write(&path, &content).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().to_string())
    }

    pub fn add_builtin(&mut self, skill: Skill) {
        self.builtins.push(skill);
    }
}
