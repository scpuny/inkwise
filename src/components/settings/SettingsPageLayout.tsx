import type { ReactNode } from "react";

/* ─── Shared settings page layout helpers ─── */

export function SettingsPage({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <section className="settings-page">
      <header className="settings-page__head">
        <div className="settings-page__title">{title}</div>
        {desc && <div className="settings-page__desc">{desc}</div>}
      </header>
      <div className="settings-page__body">{children}</div>
    </section>
  );
}

export function SettingsSection({ title, desc, children, actions }: { title: string; desc?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="settings-section">
      <div className="settings-section__head">
        <div>
          <div className="settings-section__title">{title}</div>
          {desc && <div className="settings-section__desc">{desc}</div>}
        </div>
        {actions && <div className="settings-section__actions">{actions}</div>}
      </div>
      <div className="settings-section__body">{children}</div>
    </section>
  );
}

export function SettingsField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-field">
      <div className="settings-field__copy">
        <div className="settings-field__label">{label}</div>
        {hint && <div className="settings-field__hint">{hint}</div>}
      </div>
      <div className="settings-field__control">{children}</div>
    </div>
  );
}
