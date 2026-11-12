import type { TimeFormat, WeekStart } from "../../domain/types";
import type { AccountSettings } from "../shell/AccountScreen";
import type { Navigate } from "../shell/routes";

export interface SetupPayload {
  display_name?: string;
  week_start: WeekStart;
  time_format: TimeFormat;
  timezone?: string;
  timezone_auto?: boolean;
  two_factor_enabled?: boolean;
}

export interface SetupScreenProps {
  initialName?: string;
  initialWeekStart?: WeekStart;
  initialTimeFormat?: TimeFormat;
  initialTimeZone?: string;
  onContinue?: (values: SetupPayload) => Promise<void> | void;
  onSkip?: () => void;
  navigate?: Navigate;
  showToast?: (message: string) => void;
  changeSettings?: (patch: Partial<AccountSettings>) => void;
}
