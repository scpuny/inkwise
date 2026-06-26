import { useState, useCallback, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { Provider } from "../../lib/storage/providerModels";
import { BUILTIN_PROVIDERS, getProvidersSync, saveProvidersSync, defaultModels } from "../../lib/storage/providerModels";
import { InlineConfirmButton } from "../common/InlineConfirmButton";
import { tryInvoke, isTauriEnv, TauriCommands } from "../../lib/bridge/tauri";
import { SettingsPage, SettingsSection, SettingsField } from "./SettingsPageLayout";

/* ═══════════════════════════════════════════════════════════════════
   MODELS SECTION — exact Reasonix copy (adapted for mock backend)
   ═══════════════════════════════════════════════════════════════════ */

type ModelPickerOption = { ref: string; provider: string; model: string; keySet: boolean };

type ProviderAccessGroup = {
  id: string; label: string; description: string; builtIn: boolean;
  providers: Provider[]; apiKeyEnv: string; keySet: boolean; baseUrl: string; kind: string; models: string[];
};

type ProviderFetchResult = { kind: "ok" | "warn"; text: string };
type ProviderModelDraft = { providerName: string; candidates: string[]; selected: string[] };
type AddProviderMode = null | "official" | "custom";
type OfficialProviderKind = "deepseek" | "openai" | "anthropic";

/* ─── Helpers ─── */
function uniqueStrings(arr: string[]): string[] { return [...new Set(arr.filter(Boolean))]; }

function modelOptionFromRef(ref: string, providers: Provider[]): ModelPickerOption | null {
  if (!ref) return null;
  const [pid, ...rest] = ref.split("/");
  return { ref, provider: pid, model: rest.join("/"), keySet: !!providers.find((p) => p.id === pid)?.apiKey };
}

function modelOptionMeta(option: ModelPickerOption): string {
  return option.provider;
}

function providerAccessGroups(providers: Provider[]): ProviderAccessGroup[] {
  return providers.map((p) => ({
    id: p.id, label: p.label,
    description: `${p.kind} · ${p.baseUrl || "无地址"}`,
    builtIn: p.builtin, providers: [p],
    apiKeyEnv: p.id.toUpperCase() + "_API_KEY",
    keySet: !!p.apiKey, baseUrl: p.baseUrl ?? "", kind: p.kind, models: p.models,
  }));
}

function isLikelyChatModel(model: string): boolean {
  const lower = model.toLowerCase();
  const exclude = ["text-embedding","speech","tts","stt","whisper","embedding","moderation","rerank","dall","transcription"];
  return !exclude.some((t) => lower.includes(t));
}

function providerModelCandidates(current: string[], fetched: string[]): string[] {
  return uniqueStrings([...current, ...fetched]).filter(isLikelyChatModel);
}

function mergedFetchedProviderModels(current: string[], fetched: string[], opts: { preserveCurated?: boolean } = {}): string[] {
  return opts.preserveCurated && current.length > 0 ? current : uniqueStrings([...current, ...fetched]);
}

function providerDefaultModel(currentDefault: string, models: string[]): string {
  return currentDefault && models.includes(currentDefault) ? currentDefault : models[0] ?? "";
}
export function ModelsSection() {
  const [subtab, setSubtab] = useState<"usage" | "access">("usage");
  const [providers, setProviders] = useState<Provider[]>(() => getProvidersSync());
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState<AddProviderMode>(null);
  const [fetchingProvider, setFetchingProvider] = useState<string | null>(null);
  const [fetchResults, setFetchResults] = useState<Record<string, ProviderFetchResult>>({});
  const [modelDrafts, setModelDrafts] = useState<Record<string, ProviderModelDraft>>({});

  const handleSave = useCallback(async (updated: Provider[]) => { 
    setProviders(updated); 
    saveProvidersSync(updated);
    // Sync to Tauri backend
    try { await tryInvoke(TauriCommands.SetProviders, { providers: updated }); } catch { /* browser mode */ }
  }, []);

  const groups = providerAccessGroups(providers);

  const setGroupFetchResult = (groupID: string, result: ProviderFetchResult | null) => {
    setFetchResults((prev) => { const n = { ...prev }; if (result) n[groupID] = result; else delete n[groupID]; return n; });
  };
  const setGroupModelDraft = (groupID: string, draft: ProviderModelDraft | null) => {
    setModelDrafts((prev) => { const n = { ...prev }; if (draft) n[groupID] = draft; else delete n[groupID]; return n; });
  };

  const modelDraftForFetch = (name: string, currentModels: string[], fetched: string[]): ProviderModelDraft => {
    const candidates = providerModelCandidates(currentModels, fetched);
    const selected = mergedFetchedProviderModels(currentModels, fetched, { preserveCurated: true });
    return { providerName: name, candidates, selected: candidates.filter((m) => selected.includes(m)) };
  };

  const refreshModels = async (provider: Provider) => {
    setFetchingProvider(provider.id);
    setGroupFetchResult(provider.id, null);
    setGroupModelDraft(provider.id, null);
    try {
      const fetched = await tryInvoke<string[]>(TauriCommands.FetchModels, { providerId: provider.id });
      if (!fetched || fetched.length === 0) {
        setGroupFetchResult(provider.id, { kind: "warn", text: `未获取到模型` });
        setFetchingProvider(null); return;
      }
      const draft = modelDraftForFetch(provider.id, provider.models, fetched);
      setGroupModelDraft(provider.id, draft);
      setGroupFetchResult(provider.id, { kind: "ok", text: `获取到 ${draft.candidates.length} 个模型候选` });
    } catch (e: any) {
      setGroupFetchResult(provider.id, { kind: "warn", text: `获取模型失败: ${e?.message ?? e}` });
    }
    setFetchingProvider(null);
  };

  const saveProviderKey = async (apiKeyEnv: string, value: string) => {
    const p = providers.find((pr) => pr.id === apiKeyEnv.replace("_API_KEY","").toLowerCase());
    if (p) handleSave(providers.map((x) => x.id === p.id ? { ...x, apiKey: value } : x));
  };
  const clearProviderKey = async (apiKeyEnv: string) => {
    const p = providers.find((pr) => pr.id === apiKeyEnv.replace("_API_KEY","").toLowerCase());
    if (p) handleSave(providers.map((x) => x.id === p.id ? { ...x, apiKey: undefined } : x));
    setGroupFetchResult(p?.id ?? "", null);
    setGroupModelDraft(p?.id ?? "", null);
  };
  const saveModelDraft = async (provider: Provider) => {
    const draft = modelDrafts[provider.id];
    if (!draft || draft.selected.length === 0) return;
    handleSave(providers.map((x) => x.id === provider.id ? { ...x, models: draft.selected } : x));
    setGroupModelDraft(provider.id, null);
    setGroupFetchResult(provider.id, { kind: "ok", text: `已保存 ${draft.selected.length} 个模型` });
  };

  const allRefs = providers.filter((p) => p.enabled).flatMap((p) => p.models.map((m) => `${p.id}/${m}`));
  const pickerOptions: ModelPickerOption[] = allRefs.map((ref) => {
    const pid = ref.split("/")[0];
    return { ref, provider: pid, model: ref.slice(pid.length + 1), keySet: !!providers.find((x) => x.id === pid)?.apiKey };
  });
  // Read saved model from localStorage for display
  const [selectedModelRef, setSelectedModelRef] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("aiwriter-default-model");
      if (saved) {
        const match = allRefs.find(r => r.endsWith("/" + saved) || r === saved);
        if (match) return match;
      }
    } catch {}
    return pickerOptions[0]?.ref ?? "";
  });

  return (
    <SettingsPage title="模型" desc="配置 AI 写作模型和提供商">
      <div className="settings-subtabs">
        <button type="button" className={`settings-subtab${subtab === "usage" ? " settings-subtab--active" : ""}`} aria-selected={subtab === "usage"} onClick={() => setSubtab("usage")}>使用设置</button>
        <button type="button" className={`settings-subtab${subtab === "access" ? " settings-subtab--active" : ""}`} aria-selected={subtab === "access"} onClick={() => setSubtab("access")}>接入设置</button>
      </div>
      {subtab === "usage" ? (
        <>
          <SettingsSection title="模型选择">
            <SettingsField label="默认模型">
              <ModelPicker providers={providers} refs={allRefs} value={selectedModelRef} onPick={(ref) => { setSelectedModelRef(ref); try { const parts = ref.split("/"); const modelName = parts.slice(1).join("/"); localStorage.setItem("aiwriter-default-model", modelName || ref); window.dispatchEvent(new CustomEvent("providers-changed")); } catch {} }} />
            </SettingsField>
          </SettingsSection>
          <SettingsSection title="生成参数">
            <SettingsField label="温度" hint="控制输出的随机性（0=确定，2=创意）">
              <input type="range" min="0" max="2" step="0.1" defaultValue={0.7} className="range-input" />
            </SettingsField>
            <SettingsField label="最大 Token" hint="每次生成的最大长度">
              <input type="range" min="256" max="8192" step="256" defaultValue={2048} className="range-input" />
            </SettingsField>
          </SettingsSection>
        </>
      ) : (
        <SettingsSection
          title="提供商接入"
          desc="配置 AI 模型提供商"
          actions={<button type="button" className="btn btn--small" disabled={adding !== null} onClick={() => setAdding("official")}>添加提供商</button>}
        >
          <div className="provider-access-grid">
            {groups.length === 0 && adding === null && (
              <div className="provider-empty">
                <div className="provider-empty__row">
                  <div className="provider-empty__text">
                    <strong>尚未配置提供商</strong>
                    <br />
                    <span>添加一个提供商以开始使用 AI 模型。</span>
                  </div>
                  <button type="button" className="btn btn--small" onClick={() => setAdding("official")}>官方模板</button>
                  <button type="button" className="btn btn--small" onClick={() => setAdding("custom")}>自定义</button>
                </div>
              </div>
            )}
            {adding !== null && (
              <div className="provider-add-panel">
                <div className="provider-add-panel__head">
                  <div><strong>添加提供商</strong><span>选择提供商类型</span></div>
                  <button type="button" className="btn btn--small" onClick={() => setAdding(null)}>取消</button>
                </div>
                <div className="provider-add-segmented" role="tablist">
                  <button type="button" role="tab" aria-selected={adding === "official"} className={adding === "official" ? "provider-add-segmented__item provider-add-segmented__item--active" : "provider-add-segmented__item"} onClick={() => setAdding("official")}>官方模板</button>
                  <button type="button" role="tab" aria-selected={adding === "custom"} className={adding === "custom" ? "provider-add-segmented__item provider-add-segmented__item--active" : "provider-add-segmented__item"} onClick={() => setAdding("custom")}>自定义</button>
                </div>
                {adding === "official" ? (
                  <OfficialProviderChooser
                    onAdd={(kind, apiKey) => {
                      const builtin = BUILTIN_PROVIDERS.find((b) => b.id === kind);
                      if (!builtin) { setAdding(null); return; }
                      const newProvider: Provider = {
                        id: kind,
                        label: builtin.label,
                        kind: builtin.kind,
                        baseUrl: builtin.baseUrl,
                        models: defaultModels(kind),
                        enabled: true,
                        builtin: false,
                        apiKey: apiKey || undefined,
                      };
                      handleSave([...providers, newProvider]);
                      setAdding(null);
                    }}
                  />
                ) : (
                  <CustomProviderEditor onSave={(p) => { handleSave([...providers, p]); setAdding(null); }} onCancel={() => setAdding(null)} />
                )}
              </div>
            )}
            {adding === null && groups.map((group) => (
              <ProviderAccessCard
                key={group.id} group={group}
                busy={false} fetching={fetchingProvider === group.id}
                fetchResult={fetchResults[group.id]} modelDraft={modelDrafts[group.id]}
                defaultProvider={providers[0]?.id ?? ""}
                editing={editing} kinds={["openai","anthropic","deepseek","custom"]}
                onEdit={setEditing} onCancelEdit={() => setEditing(null)}
                onSave={(p) => handleSave(providers.map((x) => x.id === p.id ? { ...x, label: p.label, baseUrl: p.baseUrl, apiKey: p.apiKey, models: p.models } : p))}
                onRefresh={() => { const pp = providers.find((x) => x.id === group.id); if (pp) refreshModels(pp); }}
                onToggleDraftModel={(model) => {
                  const d = modelDrafts[group.id]; if (!d) return;
                  const selected = d.selected.includes(model) ? d.selected.filter((m) => m !== model) : [...d.selected, model];
                  setModelDrafts((prev) => ({ ...prev, [group.id]: { ...d, selected } }));
                }}
                onSelectAllDraftModels={() => { const d = modelDrafts[group.id]; if (d) setModelDrafts((prev) => ({ ...prev, [group.id]: { ...d, selected: [...d.candidates] } })); }}
                onClearDraftModels={() => { const d = modelDrafts[group.id]; if (d) setModelDrafts((prev) => ({ ...prev, [group.id]: { ...d, selected: [] } })); }}
                onCancelDraftModels={() => setModelDrafts((prev) => { const n = { ...prev }; delete n[group.id]; return n; })}
                onSaveDraftModels={() => { const pp = providers.find((x) => x.id === group.id); if (pp) saveModelDraft(pp); }}
                onSaveEditorKey={(env, value) => saveProviderKey(env, value)}
                onClearEditorKey={(env) => clearProviderKey(env)}
                onDelete={(p) => handleSave(providers.filter((x) => x.id !== p.id))}
              />
            ))}
          </div>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}

/* ─── ModelPicker（Reasonix 完全一致）─── */
function ModelPicker({ providers, refs, value, onPick, disabled, includeSameDefault, emptyOptionLabel, emptyOptionHint }: {
  providers: Provider[]; refs: string[]; value: string; onPick: (ref: string) => void; disabled?: boolean;
  includeSameDefault?: boolean; emptyOptionLabel?: string; emptyOptionHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = refs.includes(value) ? modelOptionFromRef(value, providers) : null;
  const selectedLabel = value === "" && emptyOptionLabel ? emptyOptionLabel : selected?.model || value || "未选择";
  const selectedMeta = value === "" && emptyOptionLabel ? (emptyOptionHint || "") : selected ? modelOptionMeta(selected) : "未配置";
  const emptyOptionVisible = Boolean(emptyOptionLabel) && (!query.trim() || `${emptyOptionLabel} ${emptyOptionHint || ""}`.toLowerCase().includes(query.trim().toLowerCase()));

  const q = query.trim().toLowerCase();
  const filtered = providers.filter((p) => p.enabled && p.models.length > 0).map((p) => ({
    groupID: p.id, label: p.label, keySet: !!p.apiKey,
    options: p.models.filter((m) => {
      const ref = `${p.id}/${m}`;
      return !q || ref.toLowerCase().includes(q) || m.toLowerCase().includes(q);
    }).map((m) => ({ ref: `${p.id}/${m}`, model: m, provider: p.id, keySet: !!p.apiKey })),
  })).filter((g) => g.options.length > 0);

  useEffect(() => {
    if (!open) return;
    const pd = (e: PointerEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node) && triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false); };
    const ek = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    requestAnimationFrame(() => { document.addEventListener("pointerdown", pd); document.addEventListener("keydown", ek); });
    return () => { document.removeEventListener("pointerdown", pd); document.removeEventListener("keydown", ek); };
  }, [open]);
  useEffect(() => { if (!open) setQuery(""); }, [open]);

  const pick = (ref: string) => { setOpen(false); if (ref !== value) onPick(ref); };

  return (
    <div className="settings-model-picker">
      <button ref={triggerRef} type="button" className="settings-model-picker__trigger" disabled={disabled || (!includeSameDefault && !emptyOptionLabel && refs.length === 0)} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((next) => !next)}>
        <span className="settings-model-picker__selected">
          <span>{selectedLabel}</span>
          <small>{selectedMeta}</small>
        </span>
        <ChevronDown size={16} className={`settings-model-picker__chev${open ? " settings-model-picker__chev--open" : ""}`} />
      </button>
      {open && (
        <div ref={menuRef} className="settings-model-picker__menu" style={{ width: triggerRef.current?.getBoundingClientRect().width }}>
          <div className="settings-model-picker__search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索模型…" autoFocus />
          </div>
          <div className="settings-model-picker__list" role="listbox">
            {emptyOptionVisible && (
              <button type="button" role="option" aria-selected={value === ""}
                className={`settings-model-picker__option settings-model-picker__option--pinned${value === "" ? " settings-model-picker__option--selected" : ""}`}
                onClick={() => pick("")}>
                <span><strong>{emptyOptionLabel}</strong>{emptyOptionHint && <small>{emptyOptionHint}</small>}</span>
                {value === "" && <Check size={14} />}
              </button>
            )}
            {filtered.map((group) => (
              <div className="settings-model-picker__group" key={group.groupID}>
                <div className="settings-model-picker__group-title">
                  <span>{group.label}</span>
                  <small>{group.keySet ? "已配置" : "未配置"}</small>
                </div>
                {group.options.map((opt) => (
                  <button key={opt.ref} type="button" role="option" aria-selected={opt.ref === value}
                    className={`settings-model-picker__option${opt.ref === value ? " settings-model-picker__option--selected" : ""}`}
                    onClick={() => pick(opt.ref)}>
                    <span><strong>{opt.model}</strong><small>{modelOptionMeta(opt)}</small></span>
                    {opt.ref === value && <Check size={14} />}
                  </button>
                ))}
              </div>
            ))}
            {!emptyOptionVisible && filtered.length === 0 && <div className="settings-model-picker__empty">无匹配模型</div>}
          </div>
        </div>
      )}
    </div>
  );
}


/* ─── OfficialProviderChooser ─── */
function OfficialProviderChooser({ onAdd }: { onAdd: (kind: OfficialProviderKind, key: string) => void }) {
  const [officialKind, setOfficialKind] = useState<OfficialProviderKind>("deepseek");
  const [key, setKey] = useState("");
  const choices: Array<{ kind: OfficialProviderKind; label: string; desc: string; keyEnv: string }> = [
    { kind: "deepseek", label: "DeepSeek", desc: "DeepSeek API，支持 chat 和 coder 模型", keyEnv: "DEEPSEEK_API_KEY" },
    { kind: "openai", label: "OpenAI", desc: "OpenAI API，支持 GPT-4o 系列模型", keyEnv: "OPENAI_API_KEY" },
    { kind: "anthropic", label: "Anthropic", desc: "Anthropic API，支持 Claude 系列模型", keyEnv: "ANTHROPIC_API_KEY" },
  ];
  const selected = choices.find((c) => c.kind === officialKind) ?? choices[0];
  return (
    <>
      <div className="provider-add-panel__hint">选择一个官方提供商模板快速接入</div>
      <div className="provider-template-grid">
        {choices.map((c) => (
          <button key={c.kind} type="button" className={`provider-template-card${officialKind === c.kind ? " provider-template-card--active" : ""}`} onClick={() => setOfficialKind(c.kind)}>
            <strong>{c.label}</strong>
            <span>{c.desc}</span>
          </button>
        ))}
      </div>
      <label className="set-label">API Key（可选）</label>
      <input className="mem-input" type="password" placeholder={`设置 Key（${selected.keyEnv}）`} value={key} onChange={(e) => setKey(e.target.value)} />
      <div className="prov-card__actions">
        <button type="button" className="btn btn--primary btn--small" onClick={() => onAdd(officialKind, key.trim())}>确认添加</button>
      </div>
    </>
  );
}

/* ─── CustomProviderEditor ─── */
function CustomProviderEditor({ onSave, onCancel }: { onSave: (p: Provider) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [models, setModels] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [balanceUrl, setBalanceUrl] = useState("");
  const [ctx, setCtx] = useState("");
  const [reasoningProtocol, setReasoningProtocol] = useState("");
  const [supportedEfforts, setSupportedEfforts] = useState<string[]>([]);
  const [customEffortDraft, setCustomEffortDraft] = useState("");
  const [defaultEffort, setDefaultEffort] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const presetEfforts = supportedEfforts.filter((e) => EFFORT_PRESETS.includes(e));
  const customEfforts = supportedEfforts.filter((e) => !EFFORT_PRESETS.includes(e));
  const canFetch = Boolean(name.trim() && baseUrl.trim() && keyDraft.trim());
  const modelNames = models.split("\n").concat(models.split(",")).map((s) => s.trim()).filter(Boolean);

  const togglePreset = (level: string) => {
    const has = presetEfforts.includes(level);
    const nextPresets = has ? presetEfforts.filter((e) => e !== level) : [...presetEfforts, level];
    setSupportedEfforts([...nextPresets, ...customEfforts]);
    if (has && defaultEffort === level) setDefaultEffort("");
  };

  const addCustomEffort = () => {
    const v = customEffortDraft.trim().toLowerCase();
    if (!v || supportedEfforts.includes(v)) { setCustomEffortDraft(""); return; }
    setSupportedEfforts([...presetEfforts, ...customEfforts, v]);
    setCustomEffortDraft("");
  };

  const removeCustomEffort = (level: string) => {
    setSupportedEfforts(supportedEfforts.filter((e) => e !== level));
    if (defaultEffort === level) setDefaultEffort("");
  };

  const fetchModels = async () => {
    setFetchingModels(true); setFetchStatus(null); setFetchErr(null);
    if (!name.trim() || !baseUrl.trim() || !keyDraft.trim()) {
      setFetchErr("请填写名称、Base URL 和 API Key"); setFetchingModels(false); return;
    }
    if (!isTauriEnv()) {
      setFetchErr("获取模型仅在桌面应用中可用"); setFetchingModels(false); return;
    }
    try {
      const fetched = await tryInvoke<string[]>(TauriCommands.FetchModelsFromUrl, { kind: "custom", baseUrl: baseUrl.trim(), apiKey: keyDraft.trim() });
      if (fetched.length > 0) {
        setModels(fetched.filter(Boolean).join(",\n"));
        setFetchStatus(`获取到 ${fetched.length} 个模型`);
      } else {
        setFetchErr("未获取到模型");
      }
    } catch (e: any) {
      setFetchErr(`获取失败: ${e?.message ?? e}`);
    }
    setFetchingModels(false);
  };

  const protocolField = (
    <div className="provider-readonly-field provider-readonly-field--stacked" aria-readonly="true">
      <strong>OpenAI</strong>
      <span>兼容 OpenAI API 协议的提供商，如 DeepSeek、Groq 等</span>
    </div>
  );

  const advancedFields = (
    <details className="provider-editor-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
      <summary>高级设置</summary>
      <div className="provider-editor-advanced__body">
        <label className="set-label">API Key 环境变量名</label>
        <input className="mem-input" placeholder={apiKeyEnvFromProviderName(name)} value={apiKeyEnv} onChange={(e) => setApiKeyEnv(e.target.value)} />
        <div className="mem-hint">留空自动生成。设置后可在系统环境变量中配置 Key。</div>
        <label className="set-label">余额查询 URL</label>
        <input className="mem-input" placeholder="https://api.example.com/v1/dashboard/billing" value={balanceUrl} onChange={(e) => setBalanceUrl(e.target.value)} />
        <div className="mem-hint">用于在状态栏显示账户余额。</div>
        <label className="set-label">上下文窗口</label>
        <input className="mem-input" placeholder="例如 128000（0 表示使用模型默认值）" value={ctx} onChange={(e) => setCtx(e.target.value)} inputMode="numeric" />
        <div className="mem-hint">模型的最大上下文长度（token）。仅影响用量显示。</div>
        <label className="set-label">推理协议</label>
        <select className="mem-select" value={reasoningProtocol} onChange={(e) => setReasoningProtocol(e.target.value)}>
          {REASONING_PROTOCOLS.map((protocol) => (
            <option key={protocol || "auto"} value={protocol}>
              {protocol === "" ? "自动" : protocol === "none" ? "无" : protocol.charAt(0).toUpperCase() + protocol.slice(1)}
            </option>
          ))}
        </select>
        <div className="mem-hint">控制如何解析模型的推理过程。</div>
        <label className="set-label">支持的努力程度</label>
        {EFFORT_PRESETS.map((level) => (
          <label key={level} className="set-check">
            <input type="checkbox" checked={presetEfforts.includes(level)} onChange={() => togglePreset(level)} />
            {level}
          </label>
        ))}
        <div className="set-row">
          <input className="mem-input set-grow" placeholder="自定义努力程度…" value={customEffortDraft}
            onChange={(e) => setCustomEffortDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEffort(); } }} />
          <button type="button" className="btn btn--small" disabled={!customEffortDraft.trim() || supportedEfforts.includes(customEffortDraft.trim().toLowerCase())} onClick={addCustomEffort}>添加</button>
        </div>
        {customEfforts.length > 0 && (
          <div className="set-rules__chips">
            {customEfforts.map((level) => (
              <span className="set-rule" key={level}>
                {level}
                <button type="button" className="set-rule__x" onClick={() => removeCustomEffort(level)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="mem-hint">模型支持的努力程度。选中预设值或添加自定义值。</div>
        <label className="set-label">默认努力程度</label>
        {supportedEfforts.length > 0 ? (
          <select className="mem-select" value={defaultEffort} onChange={(e) => setDefaultEffort(e.target.value)}>
            <option value="">自动</option>
            {supportedEfforts.map((level) => (<option key={level} value={level}>{level}</option>))}
          </select>
        ) : (
          <select className="mem-select" value="" disabled><option value="">自动</option></select>
        )}
        <div className="mem-hint">未指定努力程度时的默认值。</div>
      </div>
    </details>
  );

  const ms = models.split("\n").map((s) => s.trim()).filter(Boolean).length > 0
    ? models.split("\n").map((s) => s.trim()).filter(Boolean)
    : models.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <>
      <div className="provider-add-panel__hint">手动输入自定义提供商信息</div>
      <div className="provider-editor">
        <label className="set-label">名称</label>
        <input className="mem-input" placeholder="我的提供商" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="set-label">协议</label>
        {protocolField}
        <label className="set-label">Base URL</label>
        <input className="mem-input" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
        <label className="set-label">API Key</label>
        <input className="mem-input" type="password" placeholder="sk-..." value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
        <div className="provider-model-fetch-row">
          <button type="button" className="btn btn--small" disabled={fetchingModels || !canFetch} onClick={() => void fetchModels()}>
            {fetchingModels ? "获取中…" : "测试并获取模型"}
          </button>
          <span>填写名称、Base URL 和 API Key 后即可测试连接并获取可用模型。</span>
        </div>
        {fetchStatus && <div className="provider-fetch-status provider-fetch-status--ok">{fetchStatus}</div>}
        {fetchErr && <div className="provider-fetch-status provider-fetch-status--error">{fetchErr}</div>}
        {modelNames.length > 0 && (
          <div className="provider-card-block">
            <div className="provider-card-block__label">可用模型</div>
            <div className="provider-model-chips">
              {modelNames.slice(0, 8).map((model) => (<span className="provider-model-chip" key={model}>{model}</span>))}
              {modelNames.length > 8 && <span className="provider-model-chip provider-model-chip--more">+{modelNames.length - 8}</span>}
            </div>
          </div>
        )}
        <label className="set-label">手动输入模型</label>
        <textarea className="settings-textarea" rows={3} value={models} onChange={(e) => setModels(e.target.value)} placeholder="每行一个模型名称，或逗号分隔" />
        <div className="mem-hint">模型名称列表。可从上方获取结果中自动填入，也可手动输入。</div>
        {advancedFields}
        <div className="prov-card__actions">
          <button type="button" className="btn btn--small" onClick={onCancel}>取消</button>
          <button type="button" className="btn btn--primary btn--small" disabled={!name.trim() || !baseUrl.trim() || !models.trim()} onClick={() => onSave({ id: "custom-"+Date.now(), label: name.trim() || "新提供商", kind: "custom", baseUrl: baseUrl.trim() || undefined, apiKey: keyDraft.trim() || undefined, models: models.split("\n").map((s) => s.trim()).filter(Boolean).length > 0 ? models.split("\n").map((s) => s.trim()).filter(Boolean) : models.split(",").map((s) => s.trim()).filter(Boolean), enabled: true, builtin: false })}>确认添加</button>
        </div>
      </div>
    </>
  );
}

/* ─── ProviderModelDraftPicker (Reasonix exact) ─── */
function ProviderModelDraftPicker({ draft, busy, fetching, onToggle, onSelectAll, onClear, onCancel, onSave }: {
  draft: ProviderModelDraft; busy: boolean; fetching: boolean;
  onToggle: (model: string) => void; onSelectAll: () => void; onClear: () => void; onCancel: () => void; onSave: () => void;
}) {
  const [query, setQuery] = useState("");
  const selected = new Set(draft.selected);
  const q = query.trim().toLowerCase();
  const visible = q ? draft.candidates.filter((m) => m.toLowerCase().includes(q)) : draft.candidates;
  const disabled = busy || fetching;
  return (
    <div className="provider-model-draft">
      <div className="provider-model-draft__head">
        <div>
          <div className="provider-card-block__label">模型候选</div>
          <span>已选 {draft.selected.length} 个</span>
        </div>
        <div className="provider-model-draft__tools">
          <button type="button" className="btn btn--small" disabled={disabled || draft.selected.length === draft.candidates.length} onClick={onSelectAll}>全选</button>
          <button type="button" className="btn btn--small" disabled={disabled || draft.selected.length === 0} onClick={onClear}>清空</button>
        </div>
      </div>
      <input className="mem-input provider-model-draft__search" placeholder="搜索模型…" value={query} disabled={disabled} onChange={(e) => setQuery(e.target.value)} />
      <div className="provider-model-draft__list" role="list">
        {visible.map((model) => (
          <label className="provider-model-draft__option" key={model}>
            <input type="checkbox" checked={selected.has(model)} disabled={disabled} onChange={() => onToggle(model)} />
            <span>{model}</span>
          </label>
        ))}
        {visible.length === 0 && <div className="provider-model-draft__empty">无匹配模型</div>}
      </div>
      <div className="provider-model-draft__actions">
        <button type="button" className="btn btn--small" disabled={disabled} onClick={onCancel}>取消</button>
        <button type="button" className="btn btn--small btn--primary" disabled={disabled || draft.selected.length === 0} onClick={onSave}>保存已选模型</button>
      </div>
    </div>
  );
}

/* ─── ProviderAccessCard (Reasonix exact) ─── */
function ProviderAccessCard({ group, busy, fetching, fetchResult, modelDraft, defaultProvider, editing, kinds, onEdit, onCancelEdit, onSave, onRefresh, onToggleDraftModel, onSelectAllDraftModels, onClearDraftModels, onCancelDraftModels, onSaveDraftModels, onSaveEditorKey, onClearEditorKey, onDelete }: {
  group: ProviderAccessGroup; busy: boolean; fetching: boolean;
  fetchResult?: ProviderFetchResult; modelDraft?: ProviderModelDraft;
  defaultProvider: string; editing: string | null; kinds: string[];
  onEdit: (name: string | null) => void; onCancelEdit: () => void;
  onSave: (p: Provider) => void; onRefresh: () => void;
  onToggleDraftModel: (model: string) => void; onSelectAllDraftModels: () => void; onClearDraftModels: () => void;
  onCancelDraftModels: () => void; onSaveDraftModels: () => void;
  onSaveEditorKey: (env: string, value: string) => void; onClearEditorKey: (env: string) => void;
  onDelete: (p: Provider) => void;
}) {
  const provider = group.providers[0];
  const isDefault = group.id === defaultProvider;
  const editingProvider = editing === group.id;
  const visibleModels = group.models.slice(0, 6);
  const hiddenModelCount = Math.max(0, group.models.length - visibleModels.length);

  return (
    <article className={`provider-access-card${group.builtIn ? " provider-access-card--builtin" : ""}`}>
      <div className="provider-access-card__head">
        <div className="provider-access-card__identity">
          <div className="provider-access-card__title">
            {group.label}
            <span className={`badge ${group.builtIn ? "badge--project" : "badge--neutral"}`}>{group.builtIn ? "内置" : "自定义"}</span>
            <span className={`badge ${group.keySet ? "badge--project" : "badge--feedback"}`}>{group.keySet ? "已配置" : "未配置"}</span>
          </div>
          <div className="provider-access-card__desc">{group.description}</div>
        </div>
        <div className="provider-access-card__actions">
          <button className="btn btn--small" disabled={busy} aria-expanded={editingProvider} onClick={() => editingProvider ? onCancelEdit() : onEdit(group.id)}>{editingProvider ? "收起" : "配置"}</button>
          <button className="btn btn--small" disabled={busy || fetching || !group.baseUrl || !group.apiKeyEnv || !group.keySet} onClick={onRefresh}>{fetching ? "获取中…" : "获取模型"}</button>
          {provider && onDelete && !group.builtIn && (
            <InlineConfirmButton label="删除" confirmLabel="确认删除" cancelLabel="取消" danger onConfirm={() => onDelete(provider)} />
          )}
        </div>
      </div>

      <div className="provider-access-meta">
        <span>{group.kind}</span>
        <span>{group.baseUrl}</span>
        <span>{group.apiKeyEnv || "无"}</span>
      </div>

      <div className="provider-card-block">
        <div className="provider-card-block__label">{group.keySet ? "已启用模型" : "模型列表"}</div>
        <div className="provider-model-chips" aria-label={group.keySet ? "已启用模型" : "模型列表"}>
          {visibleModels.length > 0
            ? visibleModels.map((model) => (<span className="provider-model-chip" key={model}>{model}</span>))
            : <span className="provider-model-chip provider-model-chip--empty">未配置模型</span>}
          {hiddenModelCount > 0 && <span className="provider-model-chip provider-model-chip--more">+{hiddenModelCount}</span>}
        </div>
        {!group.keySet && <div className="provider-card-status provider-card-status--warn">需配置 API Key 后方可使用</div>}
        {fetchResult && <div className={`provider-card-status provider-card-status--${fetchResult.kind}`}>{fetchResult.text}</div>}
      </div>

      {modelDraft && (
        <ProviderModelDraftPicker draft={modelDraft} busy={busy} fetching={fetching}
          onToggle={onToggleDraftModel} onSelectAll={onSelectAllDraftModels} onClear={onClearDraftModels}
          onCancel={onCancelDraftModels} onSave={onSaveDraftModels} />
      )}

      {group.providers.length > 1 && (
        <div className="provider-profiles">
          {group.providers.map((p) => (
            <div className="provider-profile-row" key={p.id}>
              <span>{p.label}</span>
              <span>{p.models.join(", ") || "无"}</span>
              <button className="btn btn--small" disabled={busy} aria-expanded={editing === p.id} onClick={() => editing === p.id ? onCancelEdit() : onEdit(p.id)}>{editing === p.id ? "收起" : "配置"}</button>
            </div>
          ))}
        </div>
      )}

      {editingProvider && provider && (
        <ProviderEditor provider={provider} onSave={onSave} onSaveKey={onSaveEditorKey} onClearKey={onClearEditorKey} group={group} />
      )}
    </article>
  );
}

/* ─── Constants & helpers (Reasonix exact) ─── */
const EFFORT_PRESETS: readonly string[] = ["low", "medium", "high", "xhigh", "max"];
const REASONING_PROTOCOLS: readonly string[] = ["", "deepseek", "openai", "none"];

function normalizeReasoningProtocol(protocol: string | undefined): string {
  return REASONING_PROTOCOLS.includes(protocol ?? "") ? protocol ?? "" : "";
}

function apiKeyEnvFromProviderName(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]/g, "_") + "_API_KEY";
}

/* ─── ProviderEditor (Reasonix 完全一致) ─── */
function ProviderEditor({ provider, onSave, onSaveKey, onClearKey, group, onCancel }: {
  provider: Provider; onSave: (p: Provider) => void;
  onSaveKey?: (env: string, value: string) => void; onClearKey?: (env: string) => void;
  group: ProviderAccessGroup; onCancel?: () => void;
}) {
  const builtIn = provider.builtin;
  // All hooks at top
  const [val, setVal] = useState("");
  const [name, setName] = useState(provider.label);
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl ?? "");
  const [models, setModels] = useState(provider.models.join(", "));
  const [keyDraft, setKeyDraft] = useState("");
  const [apiKeyEnv, setApiKeyEnv] = useState("");
  const [balanceUrl, setBalanceUrl] = useState("");
  const [ctx, setCtx] = useState("");
  const [reasoningProtocol, setReasoningProtocol] = useState("");
  const [supportedEfforts, setSupportedEfforts] = useState<string[]>([]);
  const [customEffortDraft, setCustomEffortDraft] = useState("");
  const [defaultEffort, setDefaultEffort] = useState("");
  const [fetchingModels, setFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string | null>(null);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [kind, setKind] = useState("openai");

  const presetEfforts = supportedEfforts.filter((e) => EFFORT_PRESETS.includes(e));
  const customEfforts = supportedEfforts.filter((e) => !EFFORT_PRESETS.includes(e));
  const canFetch = Boolean(name.trim() && baseUrl.trim() && (keyDraft.trim() || apiKeyEnv.trim()));
  const modelNames = models.split(",").map((s) => s.trim()).filter(Boolean);

  const togglePreset = (level: string) => {
    const has = presetEfforts.includes(level);
    const nextPresets = has ? presetEfforts.filter((e) => e !== level) : [...presetEfforts, level];
    setSupportedEfforts([...nextPresets, ...customEfforts]);
    if (has && defaultEffort === level) setDefaultEffort("");
  };

  const addCustomEffort = () => {
    const v = customEffortDraft.trim().toLowerCase();
    if (!v || supportedEfforts.includes(v)) { setCustomEffortDraft(""); return; }
    setSupportedEfforts([...presetEfforts, ...customEfforts, v]);
    setCustomEffortDraft("");
  };

  const removeCustomEffort = (level: string) => {
    setSupportedEfforts(supportedEfforts.filter((e) => e !== level));
    if (defaultEffort === level) setDefaultEffort("");
  };

  const fetchModels = async () => {
    setFetchingModels(true); setFetchStatus(null); setFetchErr(null);
    if (!name.trim() || !baseUrl.trim()) { setFetchErr("请填写名称和 Base URL"); setFetchingModels(false); return; }
    if (!isTauriEnv()) {
      setFetchErr("获取模型仅在桌面应用中可用"); setFetchingModels(false); return;
    }
    const effectiveKey = keyDraft.trim() || "(stored)";
    try {
      const fetched = await tryInvoke<string[]>(TauriCommands.FetchModelsFromUrl, { kind: "custom", baseUrl: baseUrl.trim(), apiKey: effectiveKey });
      if (fetched.length > 0) {
        setModels(fetched.filter(Boolean).join(", "));
        setFetchStatus(`获取到 ${fetched.length} 个模型`);
      } else {
        setFetchErr("未获取到模型");
      }
    } catch (e: any) {
      setFetchErr(`获取失败: ${e?.message ?? e}`);
    }
    setFetchingModels(false);
  };

  if (builtIn) {
    return (
      <div className="provider-editor provider-editor--builtin provider-editor--key-only">
        <div className="provider-key-status provider-key-status--managed provider-key-status--compact">
          <span>{group.keySet ? `已配置 Key（${group.apiKeyEnv}）` : `未配置 Key（${group.apiKeyEnv}）`}</span>
          {group.keySet && <InlineConfirmButton label="清除 Key" confirmLabel="确认清除" cancelLabel="取消" danger onConfirm={() => onClearKey?.(group.apiKeyEnv)} />}
        </div>
        <div className="set-key">
          <input className="mem-input" type="password" placeholder={group.keySet ? "更新 API Key" : "设置 API Key"} value={val} onChange={(e) => setVal(e.target.value)} />
          <button className="btn btn--small btn--primary" disabled={!val.trim()} onClick={() => { onSaveKey?.(group.apiKeyEnv, val.trim()); setVal(""); }}>{group.keySet ? "更新" : "保存"}</button>
        </div>
      </div>
    );
  }

  const protocolField = (
    <div className="provider-readonly-field provider-readonly-field--stacked" aria-readonly="true">
      <strong>OpenAI</strong>
      <span>兼容 OpenAI API 协议的提供商，如 DeepSeek、Groq 等</span>
    </div>
  );

  const advancedFields = (
    <details className="provider-editor-advanced" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
      <summary>高级设置</summary>
      <div className="provider-editor-advanced__body">
        <label className="set-label">API Key 环境变量名</label>
        <input className="mem-input" placeholder={apiKeyEnvFromProviderName(name)} value={apiKeyEnv} onChange={(e) => setApiKeyEnv(e.target.value)} />
        <div className="mem-hint">留空自动生成。设置后可在系统环境变量中配置 Key。</div>
        <label className="set-label">余额查询 URL</label>
        <input className="mem-input" placeholder="https://api.example.com/v1/dashboard/billing" value={balanceUrl} onChange={(e) => setBalanceUrl(e.target.value)} />
        <div className="mem-hint">用于在状态栏显示账户余额。</div>
        <label className="set-label">上下文窗口</label>
        <input className="mem-input" placeholder="例如 128000（0 表示使用模型默认值）" value={ctx} onChange={(e) => setCtx(e.target.value)} inputMode="numeric" />
        <div className="mem-hint">模型的最大上下文长度（token）。仅影响用量显示。</div>
        <label className="set-label">推理协议</label>
        <select className="mem-select" value={reasoningProtocol} onChange={(e) => setReasoningProtocol(e.target.value)}>
          {REASONING_PROTOCOLS.map((protocol) => (
            <option key={protocol || "auto"} value={protocol}>
              {protocol === "" ? "自动" : protocol === "none" ? "无" : protocol.charAt(0).toUpperCase() + protocol.slice(1)}
            </option>
          ))}
        </select>
        <div className="mem-hint">控制如何解析模型的推理过程。</div>
        <label className="set-label">支持的努力程度</label>
        {EFFORT_PRESETS.map((level) => (
          <label key={level} className="set-check">
            <input type="checkbox" checked={presetEfforts.includes(level)} onChange={() => togglePreset(level)} />
            {level}
          </label>
        ))}
        <div className="set-row">
          <input className="mem-input set-grow" placeholder="自定义努力程度…" value={customEffortDraft}
            onChange={(e) => setCustomEffortDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomEffort(); } }} />
          <button type="button" className="btn btn--small" disabled={!customEffortDraft.trim() || supportedEfforts.includes(customEffortDraft.trim().toLowerCase())} onClick={addCustomEffort}>添加</button>
        </div>
        {customEfforts.length > 0 && (
          <div className="set-rules__chips">
            {customEfforts.map((level) => (
              <span className="set-rule" key={level}>
                {level}
                <button type="button" className="set-rule__x" onClick={() => removeCustomEffort(level)}>×</button>
              </span>
            ))}
          </div>
        )}
        <div className="mem-hint">模型支持的努力程度。选中预设值或添加自定义值。</div>
        <label className="set-label">默认努力程度</label>
        {supportedEfforts.length > 0 ? (
          <select className="mem-select" value={defaultEffort} onChange={(e) => setDefaultEffort(e.target.value)}>
            <option value="">自动</option>
            {supportedEfforts.map((level) => (<option key={level} value={level}>{level}</option>))}
          </select>
        ) : (
          <select className="mem-select" value="" disabled><option value="">自动</option></select>
        )}
        <div className="mem-hint">未指定努力程度时的默认值。</div>
      </div>
    </details>
  );

  return (
    <div className="provider-editor">
      <label className="set-label">名称</label>
      <input className="mem-input" placeholder="我的提供商" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="set-label">协议</label>
      {protocolField}
      <label className="set-label">Base URL</label>
      <input className="mem-input" placeholder="https://api.example.com/v1" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
      <label className="set-label">API Key</label>
      <input className="mem-input" type="password" placeholder={provider.apiKey ? "（已配置，留空则不变）" : "sk-..."} value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} />
      <div className="provider-model-fetch-row">
        <button type="button" className="btn btn--small" disabled={fetchingModels || !canFetch} onClick={() => void fetchModels()}>
          {fetchingModels ? "获取中…" : "测试并获取模型"}
        </button>
        <span>填写名称、Base URL 和 API Key 后即可测试连接并获取可用模型。</span>
      </div>
      {fetchStatus && <div className="provider-fetch-status provider-fetch-status--ok">{fetchStatus}</div>}
      {fetchErr && <div className="provider-fetch-status provider-fetch-status--error">{fetchErr}</div>}
      {modelNames.length > 0 && (
        <div className="provider-card-block">
          <div className="provider-card-block__label">可用模型</div>
          <div className="provider-model-chips">
            {modelNames.slice(0, 8).map((model) => (<span className="provider-model-chip" key={model}>{model}</span>))}
            {modelNames.length > 8 && <span className="provider-model-chip provider-model-chip--more">+{modelNames.length - 8}</span>}
          </div>
        </div>
      )}
      <label className="set-label">手动输入模型</label>
      <input className="mem-input" placeholder="模型名称，用逗号分隔" value={models} onChange={(e) => setModels(e.target.value)} />
      <div className="mem-hint">模型名称列表。可从上方获取结果中自动填入，也可手动输入。</div>
      {advancedFields}
      <div className="prov-card__actions">
        {onCancel && <button className="btn btn--small" onClick={onCancel}>取消</button>}
        <button className="btn btn--primary btn--small" disabled={!name.trim() || !baseUrl.trim()} onClick={() => {
          const newApiKey = keyDraft.trim();
          if (newApiKey && group.apiKeyEnv) onSaveKey?.(group.apiKeyEnv, newApiKey);
          onSave({ 
            ...provider, 
            label: name.trim() || provider.id, 
            baseUrl: baseUrl.trim() || undefined, 
            apiKey: newApiKey || provider.apiKey,
            models: models.split(",").map((s) => s.trim()).filter(Boolean) 
          });
        }}>保存</button>
      </div>
    </div>
  );
}
