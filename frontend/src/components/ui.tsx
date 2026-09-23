/**
 * Shared presentational primitives.
 *
 * Every page composes from this file rather than styling its own boxes, so the
 * product reads as one designed system instead of a set of similar-looking
 * screens. Status colour is always paired with a word or an icon — colour is
 * never the only carrier of clinical meaning.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle, AlertTriangle, ArrowLeft, CalendarX2, Check, CheckCircle2, ChevronRight,
  Clock, FileX, Info, Loader2, MinusCircle, QrCode, ShieldCheck, ShieldX, X,
} from 'lucide-react';
import type { ParameterStatus, RecordStatus } from '../lib/format';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const Panel: React.FC<{
  className?: string;
  children: React.ReactNode;
  as?: 'div' | 'section' | 'article';
}> = ({ className = '', children, as: Tag = 'div' }) => (
  <Tag className={`panel ${className}`}>{children}</Tag>
);

export const PanelHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ElementType;
}> = ({ title, description, actions, icon: Icon }) => (
  <div className="panel-header">
    <div className="min-w-0 flex items-center gap-3">
      {Icon && <Icon className="h-5 w-5 shrink-0 text-muted" aria-hidden="true" />}
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-ink truncate tracking-tight">{title}</h2>
        {description && <p className="text-sm text-muted mt-0.5 truncate">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** Page title block. One per page, always the first thing in the content area. */
export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
}> = ({ title, description, actions, breadcrumb }) => (
  <header className="mb-6">
    {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
    {/* Stack until lg: with the fixed sidebar visible from md, the content column
        is too narrow at tablet widths for a title plus several actions on one row. */}
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl leading-tight font-semibold text-ink tracking-tight text-balance">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted max-w-2xl">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  </header>
);

/** A single back-link, for the `breadcrumb` slot of PageHeader. */
export const Breadcrumb: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-ink transition-colors"
  >
    <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    {children}
  </Link>
);

export const Divider: React.FC<{ className?: string }> = ({ className = '' }) => (
  <hr className={`border-0 border-t border-line ${className}`} />
);

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export const Spinner: React.FC<{ className?: string }> = ({ className = 'h-4 w-4' }) => (
  <Loader2 className={`${className} animate-spin`} aria-hidden="true" />
);

export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <div className="min-h-[45vh] flex flex-col items-center justify-center gap-3 text-muted">
    <Spinner className="h-7 w-7 text-primary" />
    <p className="text-sm">{label}…</p>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`shimmer rounded bg-line-soft ${className}`} />
);

export const Alert: React.FC<{
  tone?: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  children?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}> = ({ tone = 'info', title, children, className = '', onDismiss }) => {
  const tones = {
    error: { box: 'bg-high-soft border-high-line', text: 'text-high', Icon: AlertTriangle },
    warning: { box: 'bg-low-soft border-low-line', text: 'text-low', Icon: AlertCircle },
    info: { box: 'bg-primary-soft border-primary-line', text: 'text-primary-ink', Icon: Info },
    success: { box: 'bg-normal-soft border-normal-line', text: 'text-normal', Icon: CheckCircle2 },
  }[tone];
  const Icon = tones.Icon;
  return (
    <div className={`flex gap-3 rounded-md border p-3.5 ${tones.box} ${className}`} role="alert">
      <Icon className={`h-4.5 w-4.5 shrink-0 mt-0.5 ${tones.text}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className={`font-semibold ${tones.text}`}>{title}</p>}
        {children && <div className={`text-ink-soft ${title ? 'mt-0.5' : ''}`}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-muted hover:text-ink transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export const EmptyState: React.FC<{
  icon?: React.ElementType;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}> = ({ icon: Icon = FileX, title, description, action, compact }) => (
  <div className={`text-center px-6 ${compact ? 'py-10' : 'py-16'}`}>
    <div className="mx-auto h-11 w-11 rounded-full bg-sunken border border-line flex items-center justify-center mb-4">
      <Icon className="h-5 w-5 text-faint" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {description && (
      <p className="mt-1.5 text-sm text-muted max-w-md mx-auto leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Status of a single laboratory parameter. */
export const StatusChip: React.FC<{ status: ParameterStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const map: Record<ParameterStatus, { label: string; classes: string; Icon: React.ElementType }> = {
    NORMAL: { label: 'In range', classes: 'bg-normal-soft text-normal border-normal-line', Icon: CheckCircle2 },
    HIGH: { label: 'High', classes: 'bg-high-soft text-high border-high-line', Icon: AlertTriangle },
    LOW: { label: 'Low', classes: 'bg-low-soft text-low border-low-line', Icon: AlertCircle },
    UNKNOWN: { label: 'Not compared', classes: 'bg-unknown-soft text-unknown border-unknown-line', Icon: MinusCircle },
  };
  const entry = map[status] ?? map.UNKNOWN;
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${entry.classes} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {entry.label}
    </span>
  );
};

/** Processing status of a whole report. */
export const RecordStatusChip: React.FC<{ status: RecordStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const map: Record<string, { label: string; classes: string; Icon: React.ElementType; spin?: boolean }> = {
    PENDING: { label: 'Queued', classes: 'bg-unknown-soft text-unknown border-unknown-line', Icon: Clock },
    PROCESSING: { label: 'Analysing', classes: 'bg-primary-soft text-primary-ink border-primary-line', Icon: Loader2, spin: true },
    DONE: { label: 'Analysed', classes: 'bg-normal-soft text-normal border-normal-line', Icon: CheckCircle2 },
    FAILED: { label: 'Failed', classes: 'bg-high-soft text-high border-high-line', Icon: AlertTriangle },
    DELETED: { label: 'Deleted', classes: 'bg-unknown-soft text-unknown border-unknown-line', Icon: FileX },
  };
  const entry = map[status] ?? map.PENDING;
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${entry.classes} ${className}`}
    >
      <Icon className={`h-3.5 w-3.5 shrink-0 ${entry.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      {entry.label}
    </span>
  );
};

/**
 * The five semantic tones every status in the product resolves to. This is the
 * single source of truth for status colour — chips, badges and alerts all draw
 * from it, so an "active" consent and an "in-range" value read as the same green
 * everywhere. See the mapping comment in index.css.
 */
export type SemanticTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const TONE_CLASSES: Record<SemanticTone, string> = {
  neutral: 'bg-sunken text-ink-soft border-line',
  primary: 'bg-primary-soft text-primary-ink border-primary-line',
  success: 'bg-normal-soft text-normal border-normal-line',
  warning: 'bg-low-soft text-low border-low-line',
  danger: 'bg-high-soft text-high border-high-line',
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: SemanticTone;
  className?: string;
}> = ({ children, tone = 'neutral', className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
  >
    {children}
  </span>
);

type StatusEntry = { label: string; tone: SemanticTone; icon: React.ElementType };

/** Consent lifecycle, as the patient experiences it. */
const CONSENT_STATUS: Record<string, StatusEntry> = {
  ACTIVE:   { label: 'Active',                 tone: 'success', icon: ShieldCheck },
  APPROVED: { label: 'Active',                 tone: 'success', icon: ShieldCheck },
  PENDING:  { label: 'Awaiting your decision', tone: 'warning', icon: Clock },
  DECLINED: { label: 'Declined',               tone: 'neutral', icon: ShieldX },
  REVOKED:  { label: 'Revoked',                tone: 'danger',  icon: ShieldX },
  EXPIRED:  { label: 'Expired',                tone: 'neutral', icon: CalendarX2 },
};

/** QR / short-lived share sessions. */
const SHARE_STATUS: Record<string, StatusEntry> = {
  ACTIVE:  { label: 'Active',    tone: 'success', icon: QrCode },
  USED:    { label: 'Used',      tone: 'primary', icon: Check },
  REVOKED: { label: 'Cancelled', tone: 'neutral', icon: X },
  EXPIRED: { label: 'Expired',   tone: 'neutral', icon: CalendarX2 },
};

const STATUS_SETS = { consent: CONSENT_STATUS, share: SHARE_STATUS };

/**
 * Renders a consent or share-session status as a labelled, icon-bearing badge.
 * Replaces the ad-hoc, colour-only, lowercased status pills that used to be
 * written inline at each call site, so REVOKED/EXPIRED/DECLINED read
 * consistently instead of falling through to a bare neutral chip.
 */
export const StatusBadge: React.FC<{
  kind: keyof typeof STATUS_SETS;
  status: string;
  className?: string;
}> = ({ kind, status, className }) => {
  const entry =
    STATUS_SETS[kind][status] ??
    ({
      label: status.charAt(0) + status.slice(1).toLowerCase(),
      tone: 'neutral',
      icon: MinusCircle,
    } as StatusEntry);
  const Icon = entry.icon;
  return (
    <Badge tone={entry.tone} className={className}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {entry.label}
    </Badge>
  );
};

/**
 * The count of abnormal values in an analysed report, as one consistent pill.
 * Loud (red + warning icon) when something is outside range, quiet (green) when
 * everything is in range — the canonical replacement for the hand-rolled spans
 * that were duplicated across the dashboard and record lists.
 */
export const FindingsBadge: React.FC<{ abnormalCount: number; className?: string }> = ({
  abnormalCount,
  className = '',
}) =>
  abnormalCount > 0 ? (
    <Badge tone="danger" className={className}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {abnormalCount} flagged
    </Badge>
  ) : (
    <Badge tone="success" className={className}>
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      All in range
    </Badge>
  );

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
  loading?: boolean;
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
  'disabled:opacity-55 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap';

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm border border-transparent',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken shadow-sm',
  subtle: 'bg-sunken text-ink-soft border border-transparent hover:bg-line hover:text-ink',
  ghost: 'text-muted hover:text-ink hover:bg-sunken border border-transparent',
  danger: 'bg-surface text-high border border-high-line hover:bg-high-soft shadow-sm',
};

const BUTTON_SIZES = { sm: 'px-2.5 py-1.5 text-xs', md: 'px-3.5 py-2 text-sm' };

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  className = '',
  disabled,
  ...props
}) => (
  <button
    className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    disabled={disabled || loading}
    {...props}
  >
    {loading && <Spinner className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    {children}
  </button>
);

/** Anchor styled as a button, for links that navigate rather than act. */
export const LinkButton: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: keyof typeof BUTTON_VARIANTS;
    size?: 'sm' | 'md';
  }
> = ({ variant = 'secondary', size = 'md', className = '', children, ...props }) => (
  <a
    className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </a>
);

const ICON_BUTTON_SIZES = { sm: 'h-7 w-7', md: 'h-9 w-9' };

/**
 * A square, icon-only button. `label` is required and becomes the accessible
 * name, so an icon-only control is never unlabelled — the single sanctioned way
 * to render an action with no visible text.
 */
export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: keyof typeof BUTTON_VARIANTS;
    size?: 'sm' | 'md';
  }
> = ({ label, variant = 'ghost', size = 'md', className = '', children, ...props }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${ICON_BUTTON_SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const Field: React.FC<{
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ label, htmlFor, hint, error, required, children, className = '' }) => (
  <div className={className}>
    <label htmlFor={htmlFor} className="block text-[13px] font-medium text-ink-soft mb-1.5">
      {label}
      {required && <span className="text-high ml-0.5">*</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1.5 text-xs text-high">{error}</p>
    ) : hint ? (
      <p className="mt-1.5 text-xs text-muted">{hint}</p>
    ) : null}
  </div>
);

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...props
}) => <input className={`field-input ${className}`} {...props} />;

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...props
}) => <textarea className={`field-input resize-y ${className}`} {...props} />;

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  children,
  ...props
}) => (
  <select className={`field-input ${className}`} {...props}>
    {children}
  </select>
);

export const Checkbox: React.FC<{
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  hint?: React.ReactNode;
  disabled?: boolean;
}> = ({ checked, onChange, label, hint, disabled }) => (
  <label className={`flex gap-2.5 items-start ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <span className="relative flex h-4 w-4 shrink-0 mt-0.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4 w-4 appearance-none rounded border border-line bg-surface
                   checked:bg-primary checked:border-primary transition-colors cursor-pointer
                   disabled:cursor-not-allowed"
      />
      <Check
        className="pointer-events-none absolute inset-0 h-4 w-4 p-0.5 text-white opacity-0 peer-checked:opacity-100"
        aria-hidden="true"
      />
    </span>
    <span className="min-w-0">
      <span className="block text-sm text-ink">{label}</span>
      {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
    </span>
  </label>
);

/** Two-to-four mutually exclusive options, shown inline. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className = '',
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ElementType }[];
  size?: 'sm' | 'md';
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-md border border-line bg-sunken p-0.5 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded font-medium transition-colors ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'
            } ${active ? 'bg-surface text-ink shadow-raised' : 'text-muted hover:text-ink'}`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined page-level tabs. */
export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number }[];
  className?: string;
}) {
  return (
    <div className={`border-b border-line ${className}`}>
      <div className="flex gap-1 -mb-px scroll-x" role="tablist">
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-ink hover:border-line'
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`rounded-full px-1.5 py-px text-[11px] tabular ${
                    active ? 'bg-primary-soft text-primary-ink' : 'bg-sunken text-muted'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export const StatTile: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ElementType;
  tone?: 'default' | 'alert' | 'good';
  loading?: boolean;
  onClick?: () => void;
}> = ({ label, value, hint, icon: Icon, tone = 'default', loading, onClick }) => {
  const accent = { default: 'text-muted', alert: 'text-high', good: 'text-normal' }[tone];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon className={`h-4 w-4 shrink-0 ${accent}`} aria-hidden="true" />}
      </div>
      <div className="mt-2.5">
        {loading ? (
          <Skeleton className="h-7 w-12" />
        ) : (
          <p
            className={`text-[26px] leading-none font-semibold tabular ${
              tone === 'alert' ? 'text-high' : 'text-ink'
            }`}
          >
            {value}
          </p>
        )}
        {hint && <p className="mt-1.5 text-xs text-muted truncate">{hint}</p>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="p-5 text-left transition-colors hover:bg-sunken"
      >
        {body}
      </button>
    );
  }
  return <div className="p-5">{body}</div>;
};

/** Label/value pairs. The canonical way this product renders record metadata. */
export const DefinitionList: React.FC<{
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}> = ({ items, columns = 3, className = '' }) => {
  const cols = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <dl className={`grid grid-cols-1 ${cols} gap-x-6 gap-y-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="eyebrow">{item.label}</dt>
          <dd className="mt-1 text-sm text-ink break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};

/** Value shown when the patient has not supplied something. Never invented. */
export const NotProvided: React.FC = () => (
  <span className="text-faint italic">Not provided</span>
);

export const ListRow: React.FC<{
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, children, className = '' }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-4 px-5 py-3.5 ${
      onClick ? 'cursor-pointer hover:bg-sunken transition-colors' : ''
    } ${className}`}
  >
    {children}
    {onClick && <ChevronRight className="h-4 w-4 shrink-0 text-faint" aria-hidden="true" />}
  </div>
);

export const Avatar: React.FC<{ name: string; className?: string }> = ({ name, className = '' }) => {
  const initials = (name || '?')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span
      className={`grid place-items-center rounded-full bg-primary-soft text-primary-ink border border-primary-line text-xs font-semibold shrink-0 ${className || 'h-8 w-8'}`}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}> = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    // Remember what was focused so it can be restored when the dialog closes,
    // and move focus into the dialog on open — both required for a keyboard or
    // screen-reader user not to be stranded behind the modal.
    const trigger = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    // Focus the first meaningful control, or the dialog itself as a fallback.
    window.setTimeout(() => (focusables()[0] ?? dialogRef.current)?.focus(), 0);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      // Trap Tab within the dialog.
      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // Prevent the page behind the dialog from scrolling with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      trigger?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-ink/35 animate-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${widths} bg-surface border border-line rounded-t-xl sm:rounded-lg
                    shadow-overlay animate-in max-h-[92vh] flex flex-col
                    focus:outline-none`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-line">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <IconButton label="Close" size="sm" onClick={onClose} className="shrink-0 -mr-1">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-line bg-sunken rounded-b-lg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Clinical
// ---------------------------------------------------------------------------

/** The medical disclaimer. Rendered wherever AI output is shown. */
export const MedicalDisclaimer: React.FC<{ text?: string; className?: string }> = ({
  text,
  className = '',
}) => (
  <div
    className={`flex items-start gap-2.5 rounded-md border border-low-line bg-low-soft px-3.5 py-3 ${className}`}
    role="note"
  >
    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-low" aria-hidden="true" />
    <div className="text-sm min-w-0">
      <p className="font-semibold text-low">Not a medical diagnosis</p>
      <p className="mt-0.5 text-ink-soft leading-relaxed">
        {text ||
          'AI-generated information is for informational purposes only and does not constitute ' +
            'medical diagnosis or treatment. Please consult a qualified healthcare professional ' +
            'for interpretation of your results.'}
      </p>
    </div>
  </div>
);

/** Where a value sits inside its reference range. Decorative; never the only cue. */
export const RangeMeter: React.FC<{
  position: number | null;
  status: ParameterStatus;
  className?: string;
}> = ({ position, status, className = '' }) => {
  if (position === null) return null;
  const dot =
    status === 'NORMAL' ? 'bg-normal' : status === 'HIGH' ? 'bg-high' : status === 'LOW' ? 'bg-low' : 'bg-unknown';
  return (
    <div className={`relative h-2 w-full rounded-full bg-line-soft ${className}`} aria-hidden="true">
      {/* The shaded band is the reference interval. */}
      <div className="absolute inset-y-0 left-[20%] right-[20%] rounded-full bg-normal/40 ring-1 ring-inset ring-normal-line" />
      <div
        className={`absolute top-1/2 h-3.5 w-[3px] -translate-y-1/2 rounded-full ring-1 ring-surface ${dot}`}
        style={{ left: `calc(${position * 100}% - 1.5px)` }}
      />
    </div>
  );
};
