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
  } catch (e) {
    console.warn('Ignoring unreadable saved accounts', e);
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
  } catch (e) {
    console.warn('Ignoring unreadable portal accounts', e);
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

  writeSavedAccounts(current);
}

function writeSavedAccounts(accounts: SavedAccount[]) {
  try {
    localStorage.setItem(STORAGE_KEY_SAVED_ACCOUNTS, JSON.stringify(accounts));
  } catch (e) {
    console.warn('Failed to persist saved accounts', e);
  }
}

export function removeSavedAccount(email: string) {
  writeSavedAccounts(getSavedAccounts().filter((a) => a.email.toLowerCase() !== email.toLowerCase()));
}

/**
 * 로그아웃한 계정의 토큰을 저장소(게시판 + 포털 공유)에서 지운다. 계정 정보(이름 등)는 남겨 두어
 * 계정 선택 화면에는 계속 보이지만, 다시 들어가려면 비밀번호가 필요하다.
 * 토큰이 남아 있으면 로그아웃 후에도 "원클릭 로그인"으로 같은 기기의 누구나 접근할 수 있다.
 */
export function clearSavedAccountTokens(email: string) {
  const emailKey = email.toLowerCase();

  writeSavedAccounts(
    getSavedAccounts().map((a) => (a.email.toLowerCase() === emailKey ? { ...a, accessToken: undefined, refreshToken: undefined } : a)),
  );

  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLATFORM_ACCOUNTS);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) {
      const scrubbed = parsed.map((item: Record<string, unknown>) => {
        if (typeof item.email === 'string' && item.email.toLowerCase() === emailKey) {
          const identity = { ...item };
          delete identity.accessToken;
          delete identity.refreshToken;
          return identity;
        }
        return item;
      });
      localStorage.setItem(STORAGE_KEY_PLATFORM_ACCOUNTS, JSON.stringify(scrubbed));
    }
  } catch (e) {
    console.warn('Failed to clear portal account tokens', e);
  }
}
