import type { TimeFormat, WeekStart } from "../../domain/types";
import type { Navigate } from "../shell/routes";

export interface SetupPayload {
  display_name?: string;
  week_start: WeekStart;
  time_format: TimeFormat;
  two_factor_enabled?: boolean;
}

export interface SetupScreenProps {
  initialName?: string;
  initialWeekStart?: WeekStart;
  initialTimeFormat?: TimeFormat;
  onContinue?: (values: SetupPayload) => Promise<void> | void;
  onSkip?: () => void;
  navigate?: Navigate;
  showToast?: (message: string) => void;
  /** The account as `PATCH /me` answered it, after any 2FA change: the app takes it as is. */
  onSaved?: (account: { two_factor_enabled?: boolean }) => void;
}
