// QuickSkillsSection.tsx — 快捷技能管理（选区即时操作）
import { useState, useEffect } from "react";
import { Sparkles, Check } from "lucide-react";
import type { Skill } from "../../lib/storage/skill";
import { SKILL_ICONS, SKILL_LABELS } from "./settingsHelpers";

export function QuickSkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <section className="settings-section">
        <div className="settings-section__head">
          <div className="settings-section__title">快捷技能</div>
          <div className="settings-section__desc">加载中…</div>
        </div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <div className="settings-section__head">
        <div>
          <div className="settings-section__title">快捷技能</div>
          <div className="settings-section__desc">选中文本后可用的即时 AI 操作，可在工具栏和 AI 面板中使用</div>
        </div>
      </div>
      <div className="settings-section__body settings-section__body--no-bg">
        {skills.map((s) => (
          <div key={s.name} className="quick-skill-item">
            <div className="quick-skill-item__info">
              <span className="quick-skill-item__icon">{SKILL_ICONS[s.name] || <Sparkles size={13} />}</span>
              <div>
                <div className="quick-skill-item__name">{SKILL_LABELS[s.name] || s.name}</div>
                <div className="quick-skill-item__desc">{s.description}</div>
              </div>
            </div>
            <button
              className={"quick-skill-item__toggle" + (s.enabled ? " quick-skill-item__toggle--on" : "")}
              onClick={() => toggleSkill(s.name, !s.enabled)}
              title={s.enabled ? "禁用" : "启用"}
            ><Check size={10} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}
