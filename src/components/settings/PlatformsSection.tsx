import { useState, useEffect } from "react";
import { tryInvoke, TauriCommands } from "../../lib/bridge/tauri";
import { getPlatformConfigs, savePlatformConfig, deletePlatformConfig, verifyPlatformCredentials } from "../../lib/storage/platforms";
import type { PlatformConfig } from "../../domain";
import { SettingsPage } from "./SettingsPageLayout";

/* ════════════════════════════════════════════════
   PLATFORMS — 发布平台配置
   ════════════════════════════════════════════════ */
export function PlatformsSection() {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingInitial, setEditingInitial] = useState<Partial<PlatformConfig> | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [publicIp, setPublicIp] = useState<string | null>(null);
  const [ipLoading, setIpLoading] = useState(false);

  // Fetch public IP for IP whitelist configuration
  useEffect(() => {
    let cancelled = false;
    setIpLoading(true);
    (async () => {
      try {
        const ip = await tryInvoke<string>(TauriCommands.CheckPublicIp, {});
        if (ip && !cancelled) setPublicIp(ip);
      } catch {}
      if (!cancelled) setIpLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    getPlatformConfigs().then((cfgs) => {
      setConfigs(cfgs);
      setLoaded(true);
    });
  }, []);

  const handleSave = async (cfg: PlatformConfig) => {
    await savePlatformConfig(cfg);
    const cfgs = await getPlatformConfigs();
    setConfigs(cfgs);
    setEditingId(null);
    setEditingInitial(null);
    setVerifyResult(null);
  };

  const handleDelete = async (id: string) => {
    await deletePlatformConfig(id);
    setConfigs((prev) => prev.filter((c) => c.id !== id));
  };

  const handleVerify = async (cfg: PlatformConfig) => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const ok = await verifyPlatformCredentials(cfg.platform, cfg.appId, cfg.appSecret);
      setVerifyResult(ok ? "✅ 凭据有效" : "❌ 凭据无效");
    } catch (e: any) {
      setVerifyResult("❌ 验证失败: " + (e?.message || "未知错误"));
    }
    setVerifying(false);
  };

  const startEdit = (cfg: Partial<PlatformConfig>) => {
    setEditingInitial(cfg);
    setEditingId(cfg.id || "new");
    setVerifyResult(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingInitial(null);
    setVerifyResult(null);
  };

  if (!loaded) return <div className="settings-page"><p>加载中...</p></div>;

  // ── Editing mode: show form instead of cards ──
  if (editingId !== null && editingInitial) {
    const isNew = editingId === "new" || !configs.some((c) => c.id === editingId);
    return (
      <SettingsPage
        title={isNew ? "添加平台" : "编辑平台"}
        desc="配置第三方平台接入凭据"
      >
        <PlatformConfigForm
          initial={editingInitial}
          onSave={handleSave}
          onCancel={cancelEdit}
          onVerify={handleVerify}
          verifying={verifying}
          verifyResult={verifyResult}
        />
      </SettingsPage>
    );
  }

  // ── List mode: show cards + add button ──
  return (
    <SettingsPage title="发布平台" desc="配置第三方平台的接入凭据">
      {/* IP whitelist hint */}
      <div className="platform-ip-hint">
        <span className="platform-ip-hint__label">本机公网 IP：</span>
        {ipLoading ? (
          <span className="platform-ip-hint__value">查询中...</span>
        ) : publicIp ? (
          <>
            <code className="platform-ip-hint__value">{publicIp}</code>
            <button
              type="button"
              className="btn btn--small"
              onClick={() => { navigator.clipboard.writeText(publicIp); }}
              title="复制 IP"
            >复制</button>
          </>
        ) : (
          <span className="platform-ip-hint__value platform-ip-hint__value--fail">获取失败</span>
        )}
        <span className="platform-ip-hint__note">用于配置公众号 IP 白名单</span>
      </div>
      {configs.length === 0 ? (
        <div className="provider-empty">
          <div className="provider-empty__row">
            <div className="provider-empty__text">
              <strong>尚未配置发布平台</strong>
              <span>添加微信公众号等平台的凭据以发布文章。</span>
            </div>
            <button type="button" className="btn btn--small" onClick={() => startEdit({ id: "", platform: "wechat", label: "", appId: "", appSecret: "", enabled: true })}>添加平台</button>
          </div>
        </div>
      ) : (
        <>
          <div className="platform-grid">
            {configs.map((cfg) => (
              <div key={cfg.id} className="platform-card">
                <div className="platform-card__head">
                  <strong>{cfg.label}</strong>
                  <span className="platform-card__badge">{cfg.platform === "wechat" ? "微信公众号" : cfg.platform}</span>
                </div>
                <div className="platform-card__info">
                  <span>AppID: {cfg.appId ? cfg.appId.slice(0, 8) + "..." : "未设置"}</span>
                  <span className={"platform-status" + (cfg.enabled ? " platform-status--ok" : "")}>
                    {cfg.enabled ? "已启用" : "已禁用"}
                  </span>
                </div>
                <div className="platform-card__actions">
                  <button type="button" className="btn btn--small" onClick={() => startEdit(cfg)}>编辑</button>
                  <button type="button" className="btn btn--small btn--danger" onClick={() => handleDelete(cfg.id)}>删除</button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn--small" style={{ marginTop: 12 }} onClick={() => startEdit({ id: "", platform: "wechat", label: "", appId: "", appSecret: "", enabled: true })}>
            添加平台
          </button>
        </>
      )}
    </SettingsPage>
  );
}

function PlatformConfigForm({
  initial, onSave, onCancel, onVerify, verifying, verifyResult,
}: {
  initial: Partial<PlatformConfig>;
  onSave: (cfg: PlatformConfig) => void;
  onCancel: () => void;
  onVerify: (cfg: PlatformConfig) => void;
  verifying: boolean;
  verifyResult: string | null;
}) {
  const [platform, setPlatform] = useState(initial.platform || "wechat");
  const [label, setLabel] = useState(initial.label || "");
  const [appId, setAppId] = useState(initial.appId || "");
  const [appSecret, setAppSecret] = useState(initial.appSecret || "");
  const [enabled, setEnabled] = useState(initial.enabled !== false);

  const currentCfg = (): PlatformConfig => ({
    id: initial.id || "new_draft",
    platform,
    label: label || (platform === "wechat" ? "微信公众号" : platform),
    appId,
    appSecret,
    enabled,
  });

  return (
    <div className="platform-form">
      <div className="platform-form__field">
        <label>平台类型</label>
        <select value={platform} onChange={(e) => setPlatform(e.target.value)} className="input">
          <option value="wechat">微信公众号</option>
          <option value="toutiao" disabled>今日头条（待实现）</option>
        </select>
      </div>
      <div className="platform-form__field">
        <label>显示名称</label>
        <input type="text" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={platform === "wechat" ? "微信公众号" : ""} />
      </div>
      <div className="platform-form__field">
        <label>AppID</label>
        <input type="text" className="input" value={appId} onChange={(e) => setAppId(e.target.value)} placeholder="输入 AppID" />
      </div>
      <div className="platform-form__field">
        <label>AppSecret</label>
        <input type="password" className="input" value={appSecret} onChange={(e) => setAppSecret(e.target.value)} placeholder="输入 AppSecret" />
      </div>
      <div className="platform-form__field">
        <label className="checkbox-label">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span>启用</span>
        </label>
      </div>
      <div className="platform-form__actions">
        <button type="button" className="btn btn--small" disabled={!appId || !appSecret || verifying} onClick={() => onVerify(currentCfg())}>
          {verifying ? "验证中..." : "验证凭据"}
        </button>
        {verifyResult && <span className="platform-verify-result">{verifyResult}</span>}
      </div>
      <div className="platform-form__actions" style={{ marginTop: 8 }}>
        <button type="button" className="btn btn--small btn--primary" disabled={!appId || !appSecret} onClick={() => onSave(currentCfg())}>保存</button>
        <button type="button" className="btn btn--small" onClick={onCancel}>取消</button>
      </div>
    </div>
  );
}
