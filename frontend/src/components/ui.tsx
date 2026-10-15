/**
 * Shared presentational primitives for OneHealth AI.
 *
 * Polished, accessible, production-grade clinical SaaS design system.
 * High-contrast readability, soft elevations, refined micro-interactions,
 * and seamless light & dark mode support.
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
  glass?: boolean;
  hover?: boolean;
}> = ({ className = '', children, as: Tag = 'div', glass, hover }) => (
  <Tag
    className={`panel ${glass ? 'glass' : ''} ${hover ? 'card-hover' : ''} ${className}`}
  >
    {children}
  </Tag>
);

export const PanelHeader: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ElementType;
  badge?: React.ReactNode;
}> = ({ title, description, actions, icon: Icon, badge }) => (
  <div className="panel-header">
    <div className="min-w-0 flex items-center gap-3">
      {Icon && (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-dark dark:text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-ink truncate tracking-tight">{title}</h2>
          {badge}
        </div>
        {description && <p className="text-xs text-muted mt-0.5 truncate">{description}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

/** Page title block. */
export const PageHeader: React.FC<{
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  badge?: React.ReactNode;
}> = ({ title, description, actions, breadcrumb, badge }) => (
  <header className="mb-6">
    {breadcrumb && <div className="mb-3">{breadcrumb}</div>}
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-2xl sm:text-3xl leading-tight font-bold text-ink tracking-tight text-balance">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1.5 text-sm text-muted max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-1 lg:pt-0">{actions}</div>}
    </div>
  </header>
);

export const Breadcrumb: React.FC<{ to: string; children: React.ReactNode }> = ({ to, children }) => (
  <Link
    to={to}
    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-primary transition-colors"
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
  <Loader2 className={`${className} animate-spin text-primary`} aria-hidden="true" />
);

export const PageLoader: React.FC<{ label?: string }> = ({ label = 'Loading' }) => (
  <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3.5 text-muted animate-in">
    <div className="relative">
      <div className="absolute inset-0 rounded-full bg-primary/20 blur-md animate-pulse" />
      <div className="relative grid h-12 w-12 place-items-center rounded-2xl bg-surface border border-line shadow-sm">
        <Spinner className="h-6 w-6 text-primary" />
      </div>
    </div>
    <p className="text-sm font-medium text-ink-soft">{label}…</p>
  </div>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => (
  <div className={`shimmer rounded-lg bg-line/80 ${className}`} />
);

export const Alert: React.FC<{
  tone?: 'error' | 'warning' | 'info' | 'success';
  title?: string;
  children?: React.ReactNode;
  className?: string;
  onDismiss?: () => void;
}> = ({ tone = 'info', title, children, className = '', onDismiss }) => {
  const tones = {
    error: {
      box: 'bg-high-soft border-high-line text-high',
      iconColor: 'text-high',
      Icon: AlertTriangle,
    },
    warning: {
      box: 'bg-low-soft border-low-line text-low',
      iconColor: 'text-low',
      Icon: AlertCircle,
    },
    info: {
      box: 'bg-primary-soft border-primary-line text-primary-ink dark:text-primary',
      iconColor: 'text-primary',
      Icon: Info,
    },
    success: {
      box: 'bg-normal-soft border-normal-line text-normal',
      iconColor: 'text-normal',
      Icon: CheckCircle2,
    },
  }[tone];
  const Icon = tones.Icon;

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-4 backdrop-blur-sm transition-all ${tones.box} ${className}`}
      role="alert"
    >
      <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${tones.iconColor}`} aria-hidden="true" />
      <div className="min-w-0 flex-1 text-sm">
        {title && <p className="font-semibold leading-snug">{title}</p>}
        {children && <div className={`text-ink-soft leading-relaxed ${title ? 'mt-1' : ''}`}>{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss alert"
          className="shrink-0 p-1 rounded-md text-muted hover:text-ink hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
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
  <div className={`text-center px-6 ${compact ? 'py-8' : 'py-14'} animate-in`}>
    <div className="mx-auto h-13 w-13 rounded-2xl bg-primary-soft border border-primary-line/40 grid place-items-center mb-3.5 shadow-sm">
      <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
    </div>
    <h3 className="text-base font-semibold text-ink">{title}</h3>
    {description && (
      <p className="mt-1.5 text-sm text-muted max-w-md mx-auto leading-relaxed">{description}</p>
    )}
    {action && <div className="mt-5 flex justify-center">{action}</div>}
  </div>
);

// ---------------------------------------------------------------------------
// Status Chips & Badges
// ---------------------------------------------------------------------------

export const StatusChip: React.FC<{ status: ParameterStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const map: Record<ParameterStatus, { label: string; classes: string; Icon: React.ElementType }> = {
    NORMAL: {
      label: 'In range',
      classes: 'bg-normal-soft text-normal border-normal-line',
      Icon: CheckCircle2,
    },
    HIGH: {
      label: 'High',
      classes: 'bg-high-soft text-high border-high-line',
      Icon: AlertTriangle,
    },
    LOW: {
      label: 'Low',
      classes: 'bg-low-soft text-low border-low-line',
      Icon: AlertCircle,
    },
    UNKNOWN: {
      label: 'Not compared',
      classes: 'bg-unknown-soft text-unknown border-unknown-line',
      Icon: MinusCircle,
    },
  };
  const entry = map[status] ?? map.UNKNOWN;
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-xs transition-colors ${entry.classes} ${className}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {entry.label}
    </span>
  );
};

export const RecordStatusChip: React.FC<{ status: RecordStatus; className?: string }> = ({
  status,
  className = '',
}) => {
  const map: Record<string, { label: string; classes: string; Icon: React.ElementType; spin?: boolean }> = {
    PENDING: { label: 'Queued', classes: 'bg-unknown-soft text-unknown border-unknown-line', Icon: Clock },
    PROCESSING: { label: 'Analysing', classes: 'bg-primary-soft text-primary-ink dark:text-primary border-primary-line', Icon: Loader2, spin: true },
    DONE: { label: 'Analysed', classes: 'bg-normal-soft text-normal border-normal-line', Icon: CheckCircle2 },
    FAILED: { label: 'Failed', classes: 'bg-high-soft text-high border-high-line', Icon: AlertTriangle },
    DELETED: { label: 'Deleted', classes: 'bg-unknown-soft text-unknown border-unknown-line', Icon: FileX },
  };
  const entry = map[status] ?? map.PENDING;
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap shadow-xs ${entry.classes} ${className}`}
    >
      <Icon className={`h-3 w-3 shrink-0 ${entry.spin ? 'animate-spin' : ''}`} aria-hidden="true" />
      {entry.label}
    </span>
  );
};

export type SemanticTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

export const TONE_CLASSES: Record<SemanticTone, string> = {
  neutral: 'bg-sunken text-ink-soft border-line',
  primary: 'bg-primary-soft text-primary-ink dark:text-primary border-primary-line',
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
    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap shadow-xs ${TONE_CLASSES[tone]} ${className}`}
  >
    {children}
  </span>
);

type StatusEntry = { label: string; tone: SemanticTone; icon: React.ElementType };

const CONSENT_STATUS: Record<string, StatusEntry> = {
  ACTIVE:   { label: 'Active',                 tone: 'success', icon: ShieldCheck },
  APPROVED: { label: 'Active',                 tone: 'success', icon: ShieldCheck },
  PENDING:  { label: 'Awaiting your decision', tone: 'warning', icon: Clock },
  DECLINED: { label: 'Declined',               tone: 'neutral', icon: ShieldX },
  REVOKED:  { label: 'Revoked',                tone: 'danger',  icon: ShieldX },
  EXPIRED:  { label: 'Expired',                tone: 'neutral', icon: CalendarX2 },
};

const SHARE_STATUS: Record<string, StatusEntry> = {
  ACTIVE:  { label: 'Active',    tone: 'success', icon: QrCode },
  USED:    { label: 'Used',      tone: 'primary', icon: Check },
  REVOKED: { label: 'Cancelled', tone: 'neutral', icon: X },
  EXPIRED: { label: 'Expired',   tone: 'neutral', icon: CalendarX2 },
};

const STATUS_SETS = { consent: CONSENT_STATUS, share: SHARE_STATUS };

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
    <Badge tone={entry.tone} className={`rounded-full px-2.5 ${className || ''}`}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
      {entry.label}
    </Badge>
  );
};

export const FindingsBadge: React.FC<{ abnormalCount: number; className?: string }> = ({
  abnormalCount,
  className = '',
}) =>
  abnormalCount > 0 ? (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-high-soft text-high border-high-line shadow-xs ${className}`}
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {abnormalCount} flagged
    </span>
  ) : (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-normal-soft text-normal border-normal-line shadow-xs ${className}`}
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      All in range
    </span>
  );

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap active:scale-[0.98] cursor-pointer';

const BUTTON_VARIANTS = {
  primary:
    'bg-gradient-to-r from-sky-600 to-sky-500 hover:from-sky-700 hover:to-sky-600 text-white shadow-sm hover:shadow border border-sky-400/20',
  secondary:
    'bg-surface text-ink border border-line hover:bg-sunken hover:border-line-strong shadow-xs',
  subtle:
    'bg-primary-soft text-primary-ink dark:text-primary hover:bg-primary-line/40 border border-primary-line/50',
  ghost:
    'text-muted hover:text-ink hover:bg-sunken border border-transparent',
  danger:
    'bg-high-soft text-high border border-high-line hover:bg-rose-100 dark:hover:bg-rose-950/60 shadow-xs',
};

const BUTTON_SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

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

export const LinkButton: React.FC<
  React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: keyof typeof BUTTON_VARIANTS;
    size?: 'sm' | 'md' | 'lg';
  }
> = ({ variant = 'secondary', size = 'md', className = '', children, ...props }) => (
  <a
    className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
    {...props}
  >
    {children}
  </a>
);

const ICON_BUTTON_SIZES = { sm: 'h-8 w-8', md: 'h-9 w-9', lg: 'h-10 w-10' };

export const IconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    variant?: keyof typeof BUTTON_VARIANTS;
    size?: 'sm' | 'md' | 'lg';
  }
> = ({ label, variant = 'ghost', size = 'md', className = '', children, ...props }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${ICON_BUTTON_SIZES[size]} p-0 ${className}`}
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
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-ink-soft mb-1.5 uppercase tracking-wider">
      {label}
      {required && <span className="text-high ml-1">*</span>}
    </label>
    {children}
    {error ? (
      <p className="mt-1.5 text-xs text-high font-medium flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5" />
        {error}
      </p>
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
}) => <textarea className={`field-input resize-y min-h-[90px] ${className}`} {...props} />;

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
  <label className={`flex gap-3 items-start select-none ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
    <span className="relative flex h-4.5 w-4.5 shrink-0 mt-0.5">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer h-4.5 w-4.5 appearance-none rounded-md border border-line bg-surface
                   checked:bg-primary checked:border-primary transition-all cursor-pointer
                   focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed"
      />
      <Check
        className="pointer-events-none absolute inset-0 h-4.5 w-4.5 p-0.5 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
        aria-hidden="true"
      />
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-medium text-ink">{label}</span>
      {hint && <span className="block text-xs text-muted mt-0.5">{hint}</span>}
    </span>
  </label>
);

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
      className={`inline-flex items-center gap-1 rounded-xl border border-line bg-sunken/80 p-1 ${className}`}
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
            className={`inline-flex items-center gap-1.5 rounded-lg font-medium transition-all ${
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-3.5 py-1.5 text-xs'
            } ${
              active
                ? 'bg-surface text-ink shadow-xs font-semibold'
                : 'text-muted hover:text-ink'
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  className = '',
}: {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number; icon?: React.ElementType }[];
  className?: string;
}) {
  return (
    <div className={`border-b border-line ${className}`}>
      <div className="flex gap-2 -mb-px scroll-x" role="tablist">
        {tabs.map((tab) => {
          const active = tab.value === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={`inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-all ${
                active
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted hover:text-ink hover:border-line'
              }`}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {tab.label}
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs tabular font-semibold ${
                    active ? 'bg-primary-soft text-primary-ink dark:text-primary' : 'bg-sunken text-muted'
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
  tone?: 'default' | 'alert' | 'good' | 'primary';
  loading?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
}> = ({ label, value, hint, icon: Icon, tone = 'default', loading, onClick, badge }) => {
  const iconTones = {
    default: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    primary: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
    good: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    alert: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
  }[tone];

  const valueTones = {
    default: 'text-ink',
    primary: 'text-primary-dark dark:text-primary',
    good: 'text-normal',
    alert: 'text-high',
  }[tone];

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon && (
          <span className={`grid h-8 w-8 place-items-center rounded-xl ${iconTones}`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className={`text-2xl sm:text-3xl font-bold tabular tracking-tight ${valueTones}`}>
            {value}
          </p>
        )}
        {badge}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted truncate">{hint}</p>}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="panel p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
      >
        {body}
      </button>
    );
  }
  return <div className="panel p-5">{body}</div>;
};

export const DefinitionList: React.FC<{
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2 | 3 | 4;
  className?: string;
}> = ({ items, columns = 3, className = '' }) => {
  const cols = {
    1: 'sm:grid-cols-1',
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[columns];
  return (
    <dl className={`grid grid-cols-1 ${cols} gap-x-6 gap-y-4 ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="min-w-0">
          <dt className="eyebrow">{item.label}</dt>
          <dd className="mt-1 text-sm text-ink break-words font-medium">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};

export const NotProvided: React.FC = () => (
  <span className="text-faint italic font-normal">Not provided</span>
);

export const ListRow: React.FC<{
  to?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}> = ({ onClick, children, className = '' }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
      onClick ? 'cursor-pointer hover:bg-sunken/60' : ''
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
      className={`grid place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 text-white font-semibold shadow-xs shrink-0 ${
        className || 'h-9 w-9 text-xs'
      }`}
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
    const trigger = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    window.setTimeout(() => (focusables()[0] ?? dialogRef.current)?.focus(), 0);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
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
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative w-full ${widths} bg-surface border border-line rounded-t-2xl sm:rounded-2xl
                    shadow-2xl animate-in max-h-[90vh] flex flex-col focus:outline-none overflow-hidden`}
      >
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-line bg-surface/50">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>}
          </div>
          <IconButton label="Close dialog" size="sm" onClick={onClose} className="shrink-0 -mr-1">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line bg-sunken/60">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Clinical Specials
// ---------------------------------------------------------------------------

export const MedicalDisclaimer: React.FC<{ text?: string; className?: string }> = ({
  text,
  className = '',
}) => (
  <div
    className={`flex items-start gap-3 rounded-xl border border-low-line bg-low-soft p-4 shadow-xs ${className}`}
    role="note"
  >
    <div className="p-1.5 rounded-lg bg-amber-500/10 text-low shrink-0 mt-0.5">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
    </div>
    <div className="text-xs min-w-0">
      <p className="font-bold text-low tracking-tight">Not a medical diagnosis</p>
      <p className="mt-0.5 text-ink-soft leading-relaxed">
        {text ||
          'AI-generated insights are for informational decision support only and do not replace professional medical advice. Always consult a qualified physician or healthcare specialist.'}
      </p>
    </div>
  </div>
);

export const RangeMeter: React.FC<{
  position: number | null;
  status: ParameterStatus;
  className?: string;
}> = ({ position, status, className = '' }) => {
  if (position === null) return null;
  const dotColor =
    status === 'NORMAL'
      ? 'bg-normal shadow-normal/50 ring-normal-soft'
      : status === 'HIGH'
      ? 'bg-high shadow-high/50 ring-high-soft'
      : status === 'LOW'
      ? 'bg-low shadow-low/50 ring-low-soft'
      : 'bg-unknown ring-unknown-soft';

  return (
    <div className={`relative h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 ${className}`} aria-hidden="true">
      {/* The shaded reference band */}
      <div className="absolute inset-y-0 left-[20%] right-[20%] rounded-full bg-emerald-500/25 border-x border-emerald-500/50" />
      {/* Dynamic indicator marker */}
      <div
        className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-surface shadow-md ring-2 transition-all ${dotColor}`}
        style={{ left: `${Math.max(4, Math.min(96, position * 100))}%` }}
      />
    </div>
  );
};
