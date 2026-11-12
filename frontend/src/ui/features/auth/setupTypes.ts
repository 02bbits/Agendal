import type { TimeFormat, WeekStart } from "../../domain/types";
import type { AccountSettings } from "../shell/AccountScreen";
import type { Navigate } from "../shell/routes";

export interface SetupScreenProps {
  initialWeekStart?: WeekStart;
  initialTimeFormat?: TimeFormat;
  initialTimeZone?: string;
  onContinue?: (values: {
    week_start: WeekStart;
    time_format: TimeFormat;
    timezone?: string;
    timezone_auto?: boolean;
  }) => Promise<void>;
  onSkip?: () => void;
  navigate?: Navigate;
  showToast?: (message: string) => void;
  changeSettings?: (patch: Partial<AccountSettings>) => void;
}
