// SkillsSection.tsx — AI 技能管理：启用/禁用/新建
import { Check, ChevronDown, ChevronRight, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Skill } from "../../lib/storage/skill";
import { SettingsField, SettingsPage } from "./SettingsPageLayout";
import { PRIMARY_SKILLS, SKILL_LABELS } from "./settingsHelpers";

export function SkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // New skill form state
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formRunAs, setFormRunAs] = useState<"Inline" | "Subagent">("Inline");
  const [formTools, setFormTools] = useState<string[]>(["read_document"]);
  const [formBody, setFormBody] = useState("");
  const [formModel, setFormModel] = useState("");
  const [formEffort, setFormEffort] = useState("");
  const [formGenerating, setFormGenerating] = useState(false);
  const [formSaving, setFormSaving] = useState(false);
  const formNameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const { listSkills } = await import("../../lib/storage/skill");
        const list = await listSkills();
        setSkills(list);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const toggleSkill = async (name: string, enabled: boolean) => {
    try {
      const { setSkillEnabled } = await import("../../lib/storage/skill");
      await setSkillEnabled(name, enabled);
      setSkills(prev => prev.map(s => s.name === name ? { ...s, enabled } : s));
    } catch {}
  };

  const deleteSkillFn = async (name: string) => {
    try {
      const { deleteSkill } = await import("../../lib/storage/skill");
      await deleteSkill(name);
      setSkills(prev => prev.filter(s => s.name !== name));
    } catch {}
  };

  const toggleTool = (tool: string) => {
    setFormTools(prev =>
      prev.includes(tool) ? prev.filter(t => t !== tool) : [...prev, tool]
    );
  };

  const handleGenerateBody = async () => {
    if (!formName.trim() || !formDesc.trim()) return;
    setFormGenerating(true);
    try {
      const { generateSkillBody } = await import("../../lib/storage/skill");
      setFormGenerating(false);
    } catch {
      setFormGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim() || !formDesc.trim()) return;
    setFormSaving(true);
    try {
      const { installSkill } = await import("../../lib/storage/skill");
      await installSkill(formName.trim(), formDesc.trim(), formBody.trim() || "", formRunAs);
      const { listSkills } = await import("../../lib/storage/skill");
      const list = await listSkills();
      setSkills(list);
      setShowEditor(false);
      setFormName(""); setFormDesc(""); setFormRunAs("Inline");
      setFormTools(["read_document"]); setFormBody(""); setFormModel(""); setFormEffort("");
    } catch {}
    setFormSaving(false);
  };

  return (
    <SettingsPage title="技能" desc="管理 AI 写作技能，启用或禁用特定功能">
      {loading ? (
        <div style={{padding: 24, textAlign: "center", color: "var(--text-tertiary)" }}>加载中…</div>
      ) : (
        <>
        <div className="skills-list">
          {skills.map((s) => (
            <div key={s.name} className={"skills-list__item" + (expandedSkill === s.name ? " skills-list__item--expanded" : "")}>
              <div className="skills-list__header"
                onClick={() => setExpandedSkill(expandedSkill === s.name ? null : s.name)}
              >
                <span className="skills-list__chevron">
                  {expandedSkill === s.name ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </span>
                <span className="skills-list__name">{SKILL_LABELS[s.name] || s.name}</span>
                <span className="skills-list__desc">{s.description}</span>
                <span className="skills-list__loc-badges">
                  {PRIMARY_SKILLS.includes(s.name) && <span className="skills-list__loc-badge" title="出现在选中文本快捷工具栏">工具栏</span>}
                  {SKILL_LABELS[s.name] ? (
                    <span className="skills-list__loc-badge" title="出现在 Chat 输入框快捷操作">快捷</span>
                  ) : (
                    !PRIMARY_SKILLS.includes(s.name) && <span className="skills-list__loc-badge" title="在更多面板中可用">更多</span>
                  )}
                </span>
                <button
                  className={"skills-list__toggle" + (s.enabled ? " skills-list__toggle--on" : "")}
                  onClick={(e) => { e.stopPropagation(); toggleSkill(s.name, !s.enabled); }}
                  title={s.enabled ? "禁用" : "启用"}
                ><Check size={10} /></button>
              </div>
              {expandedSkill === s.name && (
                <div className="skills-list__body">
                  <div className="skills-list__preview">
                    <pre className="skills-list__code">{s.body || "（无指令模板）"}</pre>
                  </div>
                  <div className="skills-list__meta">
                    <span>执行方式: {(s as any).runAs || "Inline"}</span>
                    {s.model && <span>模型: {s.model}</span>}
                    {s.effort && <span>推理力度: {s.effort}</span>}
                  </div>
                  <div className="skills-list__actions">
                    <button className="btn btn--danger btn--small" onClick={() => deleteSkillFn(s.name)}>
                      删除技能
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{textAlign: "center", padding: 16}}>
          <button className="btn btn--primary" onClick={() => setShowEditor(true)} style={{fontSize: 12, padding: "6px 16px"}}>
            <Plus size={12} /> 新建技能
          </button>
        </div>

        {showEditor && (
          <div className="settings-overlay" onClick={() => setShowEditor(false)}>
            <div className="settings-dialog" onClick={(e) => e.stopPropagation()} style={{maxWidth: 480}}>
              <div className="settings-dialog__header">
                <h3>新建技能</h3>
                <button className="settings-dialog__close" onClick={() => setShowEditor(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="settings-dialog__body" style={{display: "flex", flexDirection: "column", gap: 12}}>
                <SettingsField label="技能 ID">
                  <input className="settings-input" ref={formNameRef} value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="英文标识，如 my-polish" />
                </SettingsField>
                <SettingsField label="中文名称">
                  <input className="settings-input" value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="如：我的润色" />
                </SettingsField>
                <SettingsField label="描述">
                  <input className="settings-input" value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="技能的作用说明" />
                </SettingsField>
                <SettingsField label="指令模板（body）">
                  <textarea className="settings-textarea" value={formBody}
                    onChange={e => setFormBody(e.target.value)}
                    placeholder="技能的核心提示词，支持 Markdown 格式。留空则使用 AI 生成"
                    style={{minHeight: 80, resize: "vertical"}} />
                </SettingsField>
                <SettingsField label="执行方式">
                  <select className="settings-select" value={formRunAs}
                    onChange={e => setFormRunAs(e.target.value as any)}>
                    <option value="Inline">内联（轻量快速）</option>
                    <option value="Subagent">子代理（复杂独立推理）</option>
                  </select>
                </SettingsField>
                <SettingsField label="工具权限">
                  <div className="skills-list__tags">
                    {["read_document", "write_document", "search_document"].map(t => (
                      <label key={t} className="skills-list__tag" style={{cursor: "pointer",
                        background: formTools.includes(t) ? "var(--accent-soft)" : "var(--hover)",
                        color: formTools.includes(t) ? "var(--accent)" : "var(--text-secondary)",
                      }}>
                        <input type="checkbox" checked={formTools.includes(t)}
                          onChange={() => toggleTool(t)} style={{display: "none"}} />
                        {{"read_document": "读取", "write_document": "写入", "search_document": "搜索"}[t]}
                      </label>
                    ))}
                  </div>
                </SettingsField>
                <SettingsField label="模型（可选）">
                  <input className="settings-input" value={formModel}
                    onChange={e => setFormModel(e.target.value)}
                    placeholder="如 gpt-4o，留空使用默认" />
                </SettingsField>
                <SettingsField label="推理力度（可选）">
                  <select className="settings-select" value={formEffort}
                    onChange={e => setFormEffort(e.target.value)}>
                    <option value="">默认</option><option value="low">低</option>
                    <option value="medium">中</option><option value="high">高</option>
                  </select>
                </SettingsField>
              </div>
              <div className="settings-dialog__footer">
                <button className="btn" onClick={() => setShowEditor(false)}
                  style={{fontSize: 12, padding: "6px 14px"}}>取消</button>
                <button className="btn btn--primary" onClick={handleSave}
                  disabled={!formName.trim() || formSaving}
                  style={{fontSize: 12, padding: "6px 14px"}}>
                  {formSaving ? "保存中…" : "保存"}
                </button>
              </div>
            </div>
          </div>
        )}
        </>
      )}
    </SettingsPage>
  );
}
