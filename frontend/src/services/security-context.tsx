/**
 * Security (master password) context.
 *
 * Hosts the unlock modal at the app root and wires it into the API layer: any
 * 423 from the backend triggers the modal, and the promise returned by the
 * failing request resolves once the user unlocks (or rejects on cancel).
 */

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  securityApi,
  setLockedHandler,
  type SecurityStatus,
} from "./api";
import UnlockModal from "../components/UnlockModal";

interface SecurityContextValue {
  status: SecurityStatus | null;
  refresh: () => Promise<void>;
  promptUnlock: () => Promise<boolean>;
}

const SecurityContext = createContext<SecurityContextValue | null>(null);

export function useSecurity(): SecurityContextValue {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error("useSecurity must be used within SecurityProvider");
  return ctx;
}

export function SecurityProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const pendingRef = useRef<((unlocked: boolean) => void) | null>(null);

  const refresh = useCallback(async () => {
    try {
      setStatus(await securityApi.getStatus());
    } catch {
      // ignore — status not critical
    }
  }, []);

  const promptUnlock = useCallback((): Promise<boolean> => {
    if (pendingRef.current) {
      // Another prompt is already in flight — chain onto the same resolution.
      return new Promise((resolve) => {
        const prev = pendingRef.current;
        pendingRef.current = (unlocked) => {
          prev?.(unlocked);
          resolve(unlocked);
        };
      });
    }
    return new Promise((resolve) => {
      pendingRef.current = resolve;
      setModalOpen(true);
    });
  }, []);

  const handleUnlocked = useCallback(async () => {
    setModalOpen(false);
    pendingRef.current?.(true);
    pendingRef.current = null;
    await refresh();
  }, [refresh]);

  const handleCancel = useCallback(() => {
    setModalOpen(false);
    pendingRef.current?.(false);
    pendingRef.current = null;
  }, []);

  useEffect(() => {
    setLockedHandler(promptUnlock);
    return () => setLockedHandler(null);
  }, [promptUnlock]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SecurityContext.Provider value={{ status, refresh, promptUnlock }}>
      {children}
      <UnlockModal
        open={modalOpen}
        onUnlocked={handleUnlocked}
        onCancel={handleCancel}
      />
    </SecurityContext.Provider>
  );
}
