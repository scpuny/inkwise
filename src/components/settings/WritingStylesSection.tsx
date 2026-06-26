// WritingStylesSection.tsx — 写作风格管理：自定义/内置风格
import { useState, useEffect } from "react";
import { Plus, Check } from "lucide-react";
import type { WritingSkill, SkillPhase, StyleDimension } from "../../lib/ai/writingSkill";
import { getBuiltinSkills, getAllBuiltinSkills } from "../../lib/ai/writingSkill";
import { SettingsPage, SettingsSection } from "./SettingsPageLayout";
import { SKILL_ICONS } from "./settingsHelpers";
import { QuickSkillsSection } from "./QuickSkillsSection";

const BUILTIN_STYLE_CARDS = getAllBuiltinSkills().filter((s: WritingSkill) => s.scope === "full");

const PHASES: { key: SkillPhase; label: string }[] = [
  { key: "title", label: "标题生成" },
  { key: "description", label: "简介生成" },
  { key: "outline", label: "大纲生成" },
  { key: "tags", label: "标签生成" },
  { key: "writing", label: "正文写作" },
];

export function WritingStylesSection() {
  const [customs, setCustoms] = useState<WritingSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formIcon, setFormIcon] = useState("\u{1F4DD}");
  const [formBodies, setFormBodies] = useState<Record<string, string>>({});
  const [formTemps, setFormTemps] = useState<Record<string, number | undefined>>({});
  const [formTokens, setFormTokens] = useState<Record<string, number | undefined>>({});
  const [formContextSources, setFormContextSources] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const m = await import("../../lib/ai/writingSkill");
        setCustoms(await m.loadCustomSkills());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const refresh = async () => {
    try {
      const m = await import("../../lib/ai/writingSkill");
      const p = await import("../../lib/ai/plan");
      p.clearSkillCache();
      setCustoms(await m.loadCustomSkills());
    } catch {}
  };

  const resetForm = () => {
    setFormName(""); setFormDesc(""); setFormIcon("\u{1F4DD}");
    setFormBodies({}); setFormTemps({}); setFormTokens({});
    setFormContextSources([]);
    setEditingId(null); setEditMode(false);
  };

  const startCreate = () => { resetForm(); setEditMode(true); };

  const startEdit = (s: WritingSkill) => {
    setFormName(s.name); setFormDesc(s.description); setFormIcon(s.icon);
    const bodies: Record<string, string> = {};
    const temps: Record<string, number | undefined> = {};
    const tokens: Record<string, number | undefined> = {};
    const phases = ["title", "description", "outline", "tags", "writing"];
    for (const k of phases) {
      const c = s.configs[k as SkillPhase];
      bodies[k] = c?.systemPrompt || "";
      temps[k] = c?.temperature;
      tokens[k] = c?.maxTokens;
    }
    setFormBodies(bodies); setFormTemps(temps); setFormTokens(tokens);
    setFormContextSources(s.contextSources.map(cs => cs.type));
    setEditingId(s.id); setEditMode(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    try {
      const m = await import("../../lib/ai/writingSkill");
      const configs: Partial<Record<SkillPhase, { systemPrompt: string; temperature?: number; maxTokens?: number }>> = {};
      for (const k of ["title", "description", "outline", "tags", "writing"] as SkillPhase[]) {
        if (formBodies[k]) {
          configs[k] = { systemPrompt: formBodies[k], temperature: formTemps[k], maxTokens: formTokens[k] };
        }
      }
      const skill: WritingSkill = {
        id: editingId || `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: formName.trim(),
        description: formDesc.trim(),
        icon: formIcon || "\u{1F4DD}",
        scope: "full",
        configs,
        contextSources: formContextSources.map(type => ({
          type: type as "project" | "series" | "linked_folder" | "custom_text",
          label: type === "project" ? "关联项目目录" : type === "series" ? "系列文章前文" : type === "linked_folder" ? "关联文件夹" : "自定义参考文本",
          required: false,
        })),
        dimensions: [],
        builtin: false,
        createdAt: editingId ? (m.findSkill(editingId)?.createdAt || Date.now()) : Date.now(),
        updatedAt: Date.now(),
      };
      await m.saveCustomSkill(skill);
      resetForm();
      await refresh();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      const m = await import("../../lib/ai/writingSkill");
      await m.deleteCustomSkill(id);
      await refresh();
    } catch {}
  };

  if (loading) {
    return (
      <SettingsPage title="写作风格">
        <p style={{ padding: 24, color: "var(--text-tertiary)" }}>加载中…</p>
      </SettingsPage>
    );
  }

  // ── Edit Mode ──
  if (editMode) {
    return (
      <SettingsPage title={editingId ? "编辑风格" : "新建风格"} desc="配置写作风格各阶段的提示词和 AI 参数，留空则使用默认值">
        <SettingsSection title="基本信息">
          <div className="settings-field settings-field--style">
            <label className="settings-field__label">名称</label>
            <input className="settings-input" value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder="如：技术博客、文艺随笔" />
          </div>
          <div className="settings-field settings-field--style">
            <label className="settings-field__label">描述</label>
            <input className="settings-input" value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder="简要描述这个风格的特点和适用场景" />
          </div>
          <div className="settings-field settings-field--style">
            <label className="settings-field__label">图标</label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 22 }}>{formIcon}</span>
              <input className="settings-input" style={{ width: 80 }} value={formIcon}
                onChange={e => setFormIcon(e.target.value)} placeholder="📝" />
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="上下文来源" desc="技能可自动收集以下信息注入到 AI 提示中">
          <div className="settings-field settings-field--style">
            <label className="settings-field__label">来源</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { id: "project", label: "关联项目目录", desc: "自动读取项目结构作为写作参考" },
                { id: "series", label: "系列文章前文", desc: "读取同系列已发布的文章保持连贯" },
              ].map(ctx => (
                <label key={ctx.id} className="checkbox-label" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={formContextSources.includes(ctx.id)}
                    onChange={e => setFormContextSources(prev =>
                      e.target.checked ? [...prev, ctx.id] : prev.filter(x => x !== ctx.id)
                    )} />
                  <span>{ctx.label} <span style={{ color: "var(--text-tertiary)" }}>{ctx.desc}</span></span>
                </label>
              ))}
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="阶段配置" desc="每个阶段可独立设置 system prompt 和 AI 参数">
          {PHASES.map(({ key, label }) => (
            <details key={key} className="settings-card__details" style={{ marginBottom: 8 }}>
              <summary className="settings-card__summary">{label}</summary>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="settings-field settings-field--style">
                  <label className="settings-field__label">System Prompt</label>
                  <textarea className="settings-textarea" rows={4}
                    value={formBodies[key] || ""}
                    onChange={e => setFormBodies(p => ({ ...p, [key]: e.target.value }))}
                    placeholder="留空则使用默认 prompt" />
                </div>
                <div className="settings-field settings-field--style">
                  <label className="settings-field__label">参数</label>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 4 }}>Temperature</div>
                      <input className="settings-input" type="number" min={0} max={2} step={0.05}
                        value={formTemps[key] ?? ""}
                        onChange={e => setFormTemps(p => ({ ...p, [key]: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        placeholder="0.7" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, color: "var(--fg-dim)", marginBottom: 4 }}>Max Tokens</div>
                      <input className="settings-input" type="number" min={128} max={16384} step={128}
                        value={formTokens[key] ?? ""}
                        onChange={e => setFormTokens(p => ({ ...p, [key]: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="1024" />
                    </div>
                  </div>
                </div>
              </div>
            </details>
          ))}
        </SettingsSection>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={resetForm}>取消</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={!formName.trim()}>
            <Check size={12} /> 保存风格
          </button>
        </div>
      </SettingsPage>
    );
  }

  // ── List Mode ──
  return (
    <SettingsPage title="写作风格" desc="管理自定义和内置的写作风格">
      {/* Custom styles */}
      <section className="settings-section">
        <div className="settings-section__head">
          <div>
            <div className="settings-section__title">自定义风格</div>
            <div className="settings-section__desc">按需创建和编辑个性化写作风格</div>
          </div>
          <button className="btn btn--small" onClick={startCreate}>
            <Plus size={12} /> 新建风格
          </button>
        </div>
        <div className="settings-section__body settings-section__body--no-bg">
          {customs.map(s => (
            <div key={s.id} className="settings-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{s.description}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn--small" onClick={() => startEdit(s)}>编辑</button>
                <button className="btn btn--danger btn--small" style={{ fontSize: 11, height: 24, padding: "0 8px" }} onClick={() => handleDelete(s.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Built-in styles */}
      <section className="settings-section">
        <div className="settings-section__head">
          <div>
            <div className="settings-section__title">内置风格</div>
            <div className="settings-section__desc">预设的写作风格，不可编辑</div>
          </div>
        </div>
        <div className="settings-section__body settings-section__body--no-bg">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {builtinCards()}
          </div>
        </div>
      </section>

      <QuickSkillsSection />
    </SettingsPage>
  );
}

/** 内置风格卡片网格 */
function builtinCards() {
  try {
    if (!BUILTIN_STYLE_CARDS || BUILTIN_STYLE_CARDS.length === 0) return null;
    return BUILTIN_STYLE_CARDS.map((s: WritingSkill) => (
      <div key={s.id} className="settings-card" style={{ padding: 0, cursor: "default" }}>
        <div className="settings-card__body" style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>{s.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--text-tertiary)", margin: "0 0 8px", lineHeight: 1.4 }}>{s.description}</p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {s.dimensions.map((d: StyleDimension) => (
              <span key={d.name} className="settings-badge">{d.name}: {d.value}</span>
            ))}
          </div>
        </div>
      </div>
    ));
  } catch { return null; }
}
