import { motion } from "framer-motion";
import type { ReactNode } from "react";

type Size = "sm" | "md" | "lg";
type Tone = "ghost" | "primary" | "danger";

interface IconButtonProps {
  /** Spanish text used for the accessible name and tooltip. */
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: Size;
  tone?: Tone;
  /** For toggle buttons: sets aria-pressed and the "on" look. */
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}

const SIZES: Record<Size, string> = {
  sm: "size-9",
  md: "size-11",
  lg: "size-14",
};

const TONES: Record<Tone, string> = {
  ghost: "text-ink-700 hover:bg-sage-200/70",
  primary: "bg-sage-700 text-sand-50 shadow-lift hover:bg-sage-800",
  danger: "text-ink-500 hover:bg-clay-100 hover:text-clay-600",
};

export function IconButton({
  label,
  onClick,
  disabled = false,
  size = "md",
  tone = "ghost",
  pressed,
  className = "",
  children,
}: IconButtonProps) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? undefined : { scale: 1.06 }}
      whileTap={disabled ? undefined : { scale: 0.92 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lavender-500 disabled:cursor-not-allowed disabled:opacity-40 ${SIZES[size]} ${TONES[tone]} ${pressed ? "bg-sage-200 text-sage-800 ring-1 ring-sage-300" : ""} ${className}`}
    >
      {children}
    </motion.button>
  );
}
