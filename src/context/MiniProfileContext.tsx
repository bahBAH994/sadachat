import React, { createContext, useCallback, useContext, useState } from 'react';
import type { User } from '../types';

interface MiniProfileContextValue {
  selectedUserId: string | null;
  previewUser: Partial<User> | null;
  openMiniProfile: (userId: string, preview?: Partial<User>) => void;
  closeMiniProfile: () => void;
}

const MiniProfileContext = createContext<MiniProfileContextValue>({
  selectedUserId: null,
  previewUser: null,
  openMiniProfile: () => {},
  closeMiniProfile: () => {},
});

export const MiniProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [previewUser, setPreviewUser] = useState<Partial<User> | null>(null);

  const openMiniProfile = useCallback((userId: string, preview?: Partial<User>) => {
    if (!userId) return;
    setSelectedUserId(userId);
    setPreviewUser(preview || null);
  }, []);

  const closeMiniProfile = useCallback(() => {
    setSelectedUserId(null);
    setPreviewUser(null);
  }, []);

  return (
    <MiniProfileContext.Provider
      value={{ selectedUserId, previewUser, openMiniProfile, closeMiniProfile }}
    >
      {children}
    </MiniProfileContext.Provider>
  );
};

export function useMiniProfile() {
  return useContext(MiniProfileContext);
}
