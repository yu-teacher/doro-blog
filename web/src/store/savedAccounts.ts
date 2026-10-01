const STORAGE_KEY_SAVED_ACCOUNTS = 'doro_saved_accounts';
/** DORO 포털이 같은 기기에 저장해 두는 계정 목록 (같은 계정이면 토큰을 공유한다). */
const STORAGE_KEY_PLATFORM_ACCOUNTS = 'doro_auth_accounts';

export interface SavedAccount {
  userId: string;
  email: string;
  name: string;
  nickname?: string;
  profileImageUrl?: string | null;
  accessToken?: string;
  refreshToken?: string;
  lastUsedAt?: number;
}

export function getSavedAccounts(): SavedAccount[] {
  const accountMap = new Map<string, SavedAccount>();

  // 1. Read from blog's saved accounts
  try {
    const rawBlog = localStorage.getItem(STORAGE_KEY_SAVED_ACCOUNTS);
    if (rawBlog) {
      const parsed: SavedAccount[] = JSON.parse(rawBlog);
      parsed.forEach((acc) => {
        if (acc.email) accountMap.set(acc.email.toLowerCase(), acc);
      });
    }
  } catch {
    // ignore
  }

  // 2. Read from DORO IAM portal standard accounts (doro_auth_accounts)
  try {
    const rawPortal = localStorage.getItem(STORAGE_KEY_PLATFORM_ACCOUNTS);
    if (rawPortal) {
      const parsed = JSON.parse(rawPortal);
      if (Array.isArray(parsed)) {
        parsed.forEach((item: Record<string, unknown>) => {
          const email = typeof item.email === 'string' ? item.email : null;
          if (email) {
            const emailKey = email.toLowerCase();
            const existing = accountMap.get(emailKey);
            accountMap.set(emailKey, {
              userId: (typeof item.userId === 'string' ? item.userId : '') || existing?.userId || '',
              email: email,
              name: (typeof item.fullName === 'string' ? item.fullName : (typeof item.name === 'string' ? item.name : '')) || existing?.name || email.split('@')[0],
              nickname: existing?.nickname,
              profileImageUrl: (typeof item.profileImageUrl === 'string' ? item.profileImageUrl : null) || existing?.profileImageUrl,
              accessToken: (typeof item.accessToken === 'string' ? item.accessToken : undefined) || existing?.accessToken,
              refreshToken: (typeof item.refreshToken === 'string' ? item.refreshToken : undefined) || existing?.refreshToken,
              lastUsedAt: existing?.lastUsedAt || Date.now(),
            });
          }
        });
      }
    }
  } catch {
    // ignore
  }

  return Array.from(accountMap.values()).sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
}

export function saveAccountHistory(account: Partial<SavedAccount> & { email: string }) {
  const current = getSavedAccounts();
  const emailKey = account.email.toLowerCase();
  const existingIdx = current.findIndex((a) => a.email.toLowerCase() === emailKey);

  const updated: SavedAccount = {
    userId: account.userId || (existingIdx >= 0 ? current[existingIdx].userId : ''),
    email: account.email,
    name: account.name || (existingIdx >= 0 ? current[existingIdx].name : account.email.split('@')[0]),
    nickname: account.nickname || (existingIdx >= 0 ? current[existingIdx].nickname : undefined),
    profileImageUrl: account.profileImageUrl !== undefined ? account.profileImageUrl : (existingIdx >= 0 ? current[existingIdx].profileImageUrl : undefined),
    accessToken: account.accessToken || (existingIdx >= 0 ? current[existingIdx].accessToken : undefined),
    refreshToken: account.refreshToken || (existingIdx >= 0 ? current[existingIdx].refreshToken : undefined),
    lastUsedAt: Date.now(),
  };

  if (existingIdx >= 0) {
    current[existingIdx] = updated;
  } else {
    current.unshift(updated);
  }

  try {
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function removeSavedAccount(email: string) {
  const current = getSavedAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase());
  try {
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(current));
  } catch {
    // ignore
  }
}
