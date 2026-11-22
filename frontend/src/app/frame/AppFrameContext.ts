import { createContext, useContext } from "react";
import type { AccountSettings, Navigate, NoteResult, SettingsTab } from "@/ui";
import type { OpenNewTaskFn } from "../useNewTask";
import type { SignedInUser } from "./signedInUser";
import type { ShowToast } from "./useToast";

export interface AppFrameValue {
  navigate: Navigate;
  back: () => void;
  /** Loaded from `GET /me` and saved with `PATCH /me`; every device follows them. */
  settings: AccountSettings;
  changeSettings: (patch: Partial<AccountSettings>) => void;
  /** One app-wide toast; it survives navigation, e.g. the welcome after sign-up (UX-04). */
  showToast: ShowToast;
  /** Opens the full-screen note editor (NC-1) from the capture bar or the Notes tab. */
  openNoteEditor: () => void;
  editFollowupNote: (note: NoteResult["note"]) => void;
  /** Opens the search popup or navigates to search. */
  openSearch: () => void;
  /** Opens the settings popup. */
  openSettings: (tab?: SettingsTab) => void;
  /** Closes the settings popup. */
  closeSettings: () => void;
  /** Opens the new task bottom sheet. */
  openNewTask: OpenNewTaskFn;
  /** Null until the session check answers, or when signed out. */
  user: SignedInUser | null;
  /** Takes an account the server answered with: claims the device, keeps it, applies its settings. */
  adoptUser: (user: SignedInUser) => Promise<void>;
  /** Sets or updates the signed-in user in AppFrame state. */
  setUser: (user: SignedInUser | null) => void;
  /** AA-5: ends the session (every session with `everywhere`), wipes the device, opens Sign in. */
  signOut: (everywhere?: boolean) => Promise<void>;
}

export const AppFrameContext = createContext<AppFrameValue | null>(null);

export function useAppFrame(): AppFrameValue {
  const value = useContext(AppFrameContext);
  if (!value) throw new Error("useAppFrame needs <AppFrame>");
  return value;
}
