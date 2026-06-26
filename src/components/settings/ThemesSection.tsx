// ThemesSection.tsx — 文章主题管理：预设/自定义/导入/编辑
import { useState, useCallback } from "react";
import { Plus, FileText, Check, X } from "lucide-react";
import {
  getAllThemes, getThemeById, isPresetTheme,
  saveCustomThemes, loadCustomThemes,
  type ArticleTheme, type ArticleThemeVars,
} from "../../lib/theme/articleThemes";
import { isTauriEnv, tryInvoke } from "../../lib/bridge/tauri";
import { SettingsPage } from "./SettingsPageLayout";

export function ThemesSection() {
  const themes = getAllThemes();
  const [customs, setCustoms] = useState<ArticleTheme[]>(loadCustomThemes());
  const [showEditor, setShowEditor] = useState(false);
  const [editTheme, setEditTheme] = useState<ArticleTheme | null>(null);

  const refresh = useCallback(() => {
    setCustoms(loadCustomThemes());
  }, []);

  const handleImportTheme = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.label || !data.vars || !data.vars.textColor) {
          alert('无效的主题文件');
          return;
        }
        const theme: ArticleTheme = {
          id: 'custom-' + Date.now(),
          label: data.label,
          desc: data.desc || '导入的主题',
          platform: 'general',
          tags: ['自定义', '导入'],
          vars: data.vars,
        };
        const existing = loadCustomThemes();
        saveCustomThemes([...existing, theme]);
        refresh();
      } catch {
        alert('导入失败：文件格式错误');
      }
    };
    input.click();
  }, [refresh]);

  const defaultVars: ArticleThemeVars = {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '16',
    lineHeight: 1.75,
    paragraphGap: '1.25',
    maxWidth: '780',
    textColor: '#2c2c2c',
    bgColor: '#ffffff',
    headingColor: '#111111',
    linkColor: '#1a73e8',
    codeBg: '#f5f5f5',
    codeText: '#333333',
    blockquoteBorder: '#dfe1e5',
    blockquoteBg: '#f8f9fa',
  };

  return (
    <SettingsPage title="文章主题管理">
      <div className="settings-section__header">
        <h3 className="settings-section__title">文章主题</h3>
        <div style={{display: 'flex', gap: 6}}>
          <button className="btn btn--small" onClick={handleImportTheme}>
            <FileText size={12} /> 导入
          </button>
          <button className="btn btn--small" onClick={() => { setEditTheme(null); setShowEditor(true); }}>
            <Plus size={12} /> 新建
          </button>
        </div>
      </div>

      <div className="theme-manager__grid">
        {themes.map(t => {
          const isCustom = !isPresetTheme(t.id);
          const v = t.vars;
          return (
            <div key={t.id} className="theme-manager__card">
              <div className="theme-manager__card-preview" style={{background: v.bgColor}}>
                <div className="theme-manager__card-swatches">
                  <span className="theme-manager__swatch" style={{background: v.textColor}} title="文字色" />
                  <span className="theme-manager__swatch" style={{background: v.headingColor}} title="标题色" />
                  <span className="theme-manager__swatch" style={{background: v.linkColor}} title="链接色" />
                  <span className="theme-manager__swatch" style={{background: v.codeBg, border: '1px solid rgba(0,0,0,0.06)'}} title="代码背景" />
                  <span className="theme-manager__swatch" style={{background: v.blockquoteBorder}} title="引用边框" />
                </div>
                <div className="theme-manager__card-text" style={{color: v.headingColor, fontFamily: v.fontFamily}}>
                  <div style={{fontWeight: 700, fontSize: 14}}>{t.label}</div>
                  <div style={{fontSize: 10, color: v.textColor, marginTop: 2}}>{v.fontSize}px / {v.lineHeight}</div>
                </div>
              </div>
              <div className="theme-manager__card-info">
                <span className="theme-manager__card-name">{t.label}</span>
                {isCustom && <span className="theme-manager__card-badge">自定义</span>}
              </div>
              <div className="theme-manager__card-desc">{t.desc}</div>
              <div className="theme-manager__card-actions">
                {!isCustom && (
                  <button className="btn btn--small" onClick={() => { setEditTheme(t); setShowEditor(true); }}>复制创建</button>
                )}
                {isCustom && (
                  <>
                    <button className="btn btn--small" onClick={() => { setEditTheme(t); setShowEditor(true); }}>编辑</button>
                    <button className="btn btn--small" onClick={() => {
                      const json = JSON.stringify({ label: t.label, desc: t.desc, vars: t.vars }, null, 2);
                      const fileName = t.label + '.json';
                      if (isTauriEnv()) {
                        tryInvoke('dialog_save', { filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: fileName })
                          .then((path: any) => {
                            if (path) tryInvoke('fs_write_text_file', { path, contents: json });
                          });
                      } else {
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = fileName; a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}>导出</button>
                    <button className="btn btn--small btn--danger" onClick={() => {
                      const updated = customs.filter(c => c.id !== t.id);
                      saveCustomThemes(updated);
                      refresh();
                      window.location.reload();
                    }}>删除</button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showEditor && (
        <ThemeForm
          initial={editTheme}
          onSave={(theme) => {
            const existing = loadCustomThemes();
            if (editTheme) {
              const idx = existing.findIndex(c => c.id === editTheme.id);
              if (idx >= 0) existing[idx] = theme;
              else existing.push(theme);
            } else {
              existing.push(theme);
            }
            saveCustomThemes(existing);
            refresh();
            setShowEditor(false);
            setEditTheme(null);
            window.location.reload();
          }}
          isNew={!editTheme}
        />
      )}
    </SettingsPage>
  );
}

/* ════════════════════════════════════════════════
   Theme Form — 新建/编辑主题
   ════════════════════════════════════════════════ */
function ThemeForm({ initial, onSave, isNew }: {
  initial: ArticleTheme | null;
  onSave: (t: ArticleTheme) => void;
  isNew: boolean;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [desc, setDesc] = useState(initial?.desc ?? "");
  const [vars, setVars] = useState<ArticleThemeVars>(initial?.vars ?? {
    fontFamily: '"PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: '16', lineHeight: 1.75, paragraphGap: '1.25', maxWidth: '780',
    textColor: '#2c2c2c', bgColor: '#ffffff', headingColor: '#111111',
    linkColor: '#1a73e8', codeBg: '#f5f5f5', codeText: '#333333',
    blockquoteBorder: '#dfe1e5', blockquoteBg: '#f8f9fa',
  });

  const updateVar = (key: keyof ArticleThemeVars, val: string | number) => {
    setVars(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      id: initial?.id ?? `custom-${Date.now()}`,
      label: label.trim(),
      desc: desc.trim() || "自定义主题",
      platform: "general",
      tags: ["自定义"],
      vars,
    });
  };

  return (
    <div className="settings-overlay" onClick={() => onSave(initial as ArticleTheme)}>
      <div className="settings-dialog theme-editor" onClick={e => e.stopPropagation()} style={{maxWidth: 640}}>
        <div className="settings-dialog__header">
          <h3>{isNew ? "新建主题" : "编辑主题"}</h3>
          <button className="settings-dialog__close" onClick={() => onSave(initial as ArticleTheme)}><X size={14} /></button>
        </div>

        <div className="theme-editor__body">
          <div className="theme-editor__field-group">
            <label className="theme-editor__group-label">基本信息</label>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field" style={{flex: 1}}>
                <label className="set-label">主题名称</label>
                <input className="mem-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="主题名称" />
              </div>
              <div className="theme-editor__field" style={{flex: 2}}>
                <label className="set-label">描述</label>
                <input className="mem-input" value={desc} onChange={e => setDesc(e.target.value)} placeholder="简要描述" />
              </div>
            </div>
          </div>

          <div className="theme-editor__divider" />
          <div className="theme-editor__field-group">
            <label className="theme-editor__group-label">排版</label>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">字体</label>
                <input className="mem-input" value={vars.fontFamily} onChange={e => updateVar('fontFamily', e.target.value)} />
              </div>
              <div className="theme-editor__field">
                <label className="set-label">字号 (px)</label>
                <input className="mem-input" type="number" value={parseInt(vars.fontSize)} onChange={e => updateVar('fontSize', String(e.target.value))} />
              </div>
            </div>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">行高</label>
                <input className="mem-input" type="number" min={0.5} max={3} step={0.1} value={vars.lineHeight} onChange={e => updateVar('lineHeight', parseFloat(e.target.value))} />
              </div>
              <div className="theme-editor__field">
                <label className="set-label">段间距 (em)</label>
                <input className="mem-input" type="number" min={0.5} max={3} step={0.1} value={parseFloat(vars.paragraphGap)} onChange={e => updateVar('paragraphGap', String(e.target.value))} />
              </div>
            </div>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">最大宽度 (px)</label>
                <input className="mem-input" type="number" min={500} max={1200} value={parseInt(vars.maxWidth)} onChange={e => updateVar('maxWidth', String(e.target.value))} />
              </div>
            </div>
          </div>

          <div className="theme-editor__divider" />
          <div className="theme-editor__field-group">
            <label className="theme-editor__group-label">颜色</label>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">背景色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.bgColor} onChange={e => updateVar('bgColor', e.target.value)} />
                  <input className="mem-input" value={vars.bgColor} onChange={e => updateVar('bgColor', e.target.value)} />
                </div>
              </div>
              <div className="theme-editor__field">
                <label className="set-label">正文字色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.textColor} onChange={e => updateVar('textColor', e.target.value)} />
                  <input className="mem-input" value={vars.textColor} onChange={e => updateVar('textColor', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">标题色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.headingColor} onChange={e => updateVar('headingColor', e.target.value)} />
                  <input className="mem-input" value={vars.headingColor} onChange={e => updateVar('headingColor', e.target.value)} />
                </div>
              </div>
              <div className="theme-editor__field">
                <label className="set-label">链接色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.linkColor} onChange={e => updateVar('linkColor', e.target.value)} />
                  <input className="mem-input" value={vars.linkColor} onChange={e => updateVar('linkColor', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">代码背景</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.codeBg} onChange={e => updateVar('codeBg', e.target.value)} />
                  <input className="mem-input" value={vars.codeBg} onChange={e => updateVar('codeBg', e.target.value)} />
                </div>
              </div>
              <div className="theme-editor__field">
                <label className="set-label">代码文字色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.codeText} onChange={e => updateVar('codeText', e.target.value)} />
                  <input className="mem-input" value={vars.codeText} onChange={e => updateVar('codeText', e.target.value)} />
                </div>
              </div>
            </div>
            <div className="theme-editor__field-row">
              <div className="theme-editor__field">
                <label className="set-label">引用边框色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.blockquoteBorder} onChange={e => updateVar('blockquoteBorder', e.target.value)} />
                  <input className="mem-input" value={vars.blockquoteBorder} onChange={e => updateVar('blockquoteBorder', e.target.value)} />
                </div>
              </div>
              <div className="theme-editor__field">
                <label className="set-label">引用背景色</label>
                <div className="theme-editor__color-row">
                  <input type="color" value={vars.blockquoteBg} onChange={e => updateVar('blockquoteBg', e.target.value)} />
                  <input className="mem-input" value={vars.blockquoteBg} onChange={e => updateVar('blockquoteBg', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <div className="theme-editor__actions">
            <button className="btn" onClick={() => onSave(initial as ArticleTheme)}>取消</button>
            <button className="btn btn--primary" onClick={handleSave} disabled={!label.trim()}>
              <Check size={12} /> 保存主题
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
