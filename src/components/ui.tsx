import { type ReactNode } from "react";

export function Logo({
  size = 40,
  width,
  height,
  className = "",
}: {
  size?: number;
  width?: number;
  height?: number;
  className?: string;
}) {
  const logoWidth = width ?? size;
  const logoHeight = height ?? size;

  return (
    <img
      src="/logo.png"
      alt="Nature Biotic"
      width={logoWidth}
      height={logoHeight}
      className={`shrink-0 ${className}`}
      style={{
        width: logoWidth,
        height: logoHeight,
        objectFit: "contain",
        backgroundColor: "white",
      }}
    />
  );
}

export function LogoFull({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Logo size={size} />
      <div className="leading-tight">
        <p
          className="font-bold text-slate-800 tracking-tight"
          style={{ fontSize: size * 0.36 }}
        >
          Nature Biotic
        </p>
        <p
          className="text-slate-400 font-medium"
          style={{ fontSize: size * 0.24 }}
        >
          CRM Platform
        </p>
      </div>
    </div>
  );
}

export function Icon({
  name,
  className = "",
  fill = false,
  size = 22,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`material-symbols-rounded ${fill ? "ms-fill" : ""} ${className}`}
      style={{ fontSize: size }}
    >
      {name}
    </span>
  );
}

export function Card({
  children,
  className = "",
  onClick,
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl shadow-card border border-slate-100 ${hover ? "transition-base hover:shadow-elevated hover:border-slate-200 cursor-pointer" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  type = "button",
  disabled = false,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
}) {
  const variants = {
    primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
    secondary:
      "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-base disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  color = "green",
}: {
  children: ReactNode;
  color?: "green" | "red" | "amber" | "slate" | "blue";
}) {
  const colors = {
    green: "bg-brand-50 text-brand-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-600",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colors[color]}`}
    >
      {children}
    </span>
  );
}

export function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  icon,
  required = false,
  readOnly = false,
  className = "",
}: {
  label?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: string;
  required?: boolean;
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span
            className="material-symbols-rounded absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            style={{ fontSize: 20 }}
          >
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          readOnly={readOnly}
          className={`w-full ${icon ? "pl-11" : "pl-4"} pr-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus ${readOnly ? "bg-slate-50 text-slate-500 cursor-default" : ""}`}
        />
      </div>
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full pl-4 pr-10 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus appearance-none cursor-pointer"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          className="material-symbols-rounded absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          style={{ fontSize: 20 }}
        >
          expand_more
        </span>
      </div>
    </div>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  rows = 3,
  className = "",
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 transition-base focus:outline-none focus:border-brand-500 focus:shadow-focus resize-none"
      />
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl" | "2xl";
}) {
  if (!open) return null;
  const sizeClass = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
    "2xl": "max-w-6xl",
  }[size];
  return (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    {/* Background */}
    <div
      className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    />

    {/* Popup */}
    <div
      className={`relative bg-white rounded-2xl shadow-elevated w-full ${sizeClass} animate-scale-in`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h3 className="text-lg font-bold text-slate-800">
          {title}
        </h3>

        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 transition-base p-1 rounded-lg hover:bg-slate-100"
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: 22 }}
          >
            close
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="px-6 py-5">
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          {footer}
        </div>
      )}
    </div>
  </div>
);
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendUp,
  color = "brand",
}: {
  label: string;
  value: string;
  icon: string;
  trend?: string;
  trendUp?: boolean;
  color?: "brand" | "blue" | "amber" | "red" | "purple";
}) {
  const colors: Record<string, string> = {
    brand: "bg-brand-50 text-brand-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <Card className="p-5" hover>
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1.5 tracking-tight">
            {value}
          </p>
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendUp ? "text-brand-600" : "text-red-500"}`}
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 14 }}
              >
                {trendUp ? "trending_up" : "trending_down"}
              </span>
              {trend}
            </div>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colors[color]}`}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 24 }}>
            {icon}
          </span>
        </div>
      </div>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <span
          className="material-symbols-rounded text-slate-400"
          style={{ fontSize: 32 }}
        >
          {icon}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-block animate-spin rounded-full border-2 border-slate-200 border-t-brand-500 ${className}`}
      style={{ width: "1em", height: "1em" }}
    />
  );
}

export function SectionTitle({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
        <span
          className="material-symbols-rounded text-brand-600"
          style={{ fontSize: 20 }}
        >
          {icon}
        </span>
      </div>
      <div>
        <h2 className="font-bold text-slate-800">{title}</h2>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
    </div>
  );
}
