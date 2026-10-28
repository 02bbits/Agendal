// Styles: src/app/globals.css imports ./theme.css (Tailwind CSS + daisyUI themes).

export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from "./components/Button";
export { IconButton, type IconButtonProps } from "./components/IconButton";
export { TextField, type TextFieldProps } from "./components/TextField";
export { Chip, type ChipProps } from "./components/Chip";
export { Sheet, type SheetProps } from "./components/Sheet";
export { Dialog, type DialogProps } from "./components/Dialog";
export {
  Toast,
  TOAST_DURATION_MS,
  type ToastProps,
  type ToastData,
} from "./components/Toast";
export { EmptyState, type EmptyStateProps } from "./components/EmptyState";
export * from "./components/icons";

/** The 8 project colours, in picker order (PJ-1). Use as `var(--project-<name>)`. */
export const PROJECT_COLORS = [
  "blue",
  "red",
  "orange",
  "yellow",
  "green",
  "teal",
  "purple",
  "gray",
] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];
