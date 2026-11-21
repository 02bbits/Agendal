import { useCallback, useRef, useState } from "react";
import type { SignedInUser } from "./signedInUser";

/**
 * The signed-in user, null until the session check answers or when signed out. The ref is for
 * handlers that mustn't wait for a render (session expired, saving settings).
 */
export function useSignedInUser() {
  const [user, setUserState] = useState<SignedInUser | null>(null);
  const userRef = useRef<SignedInUser | null>(null);
  const setUser = useCallback((next: SignedInUser | null) => {
    userRef.current = next;
    setUserState(next);
  }, []);
  return { user, userRef, setUser };
}
