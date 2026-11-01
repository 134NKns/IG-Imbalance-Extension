export interface IgFriendUser {
  pk: string;
  username: string;
  fullName: string;
  profilePicUrl?: string;
  isVerified?: boolean;
  isPrivate?: boolean;
}

export type FriendshipKind = "followers" | "following";

export interface ScanProgress {
  userId: string;
  followers: IgFriendUser[];
  following: IgFriendUser[];
  next: {
    followers?: string;
    following?: string;
  };
  done: {
    followers: boolean;
    following: boolean;
  };
  status: "idle" | "scanning" | "paused" | "completed" | "error";
  currentPhase?: FriendshipKind;
  error?: string | null;
  updatedAt: number;
}

export type RelationshipTab =
  | "notFollowingBack"
  | "fans"
  | "mutual"
  | "following"
  | "followers";

export interface RelationshipSets {
  notFollowingBack: IgFriendUser[];
  fans: IgFriendUser[];
  mutual: IgFriendUser[];
  following: IgFriendUser[];
  followers: IgFriendUser[];
}

export function computeRelationshipSets(data: {
  followers: IgFriendUser[];
  following: IgFriendUser[];
}): RelationshipSets {
  const followerMap = new Map(data.followers.map((u) => [u.pk, u]));
  const followingMap = new Map(data.following.map((u) => [u.pk, u]));

  // notFollowingBack: we follow them, but they don't follow back (following - followers)
  const notFollowingBack = data.following.filter((u) => !followerMap.has(u.pk));

  // fans: they follow us, but we don't follow back (followers - following)
  const fans = data.followers.filter((u) => !followingMap.has(u.pk));

  // mutual: both follow each other (followers ∩ following)
  const mutual = data.following.filter((u) => followerMap.has(u.pk));

  return {
    notFollowingBack,
    fans,
    mutual,
    following: data.following,
    followers: data.followers,
  };
}

const storageKey = (userId: string) => `ig_relationship_${userId}`;

export async function loadScanProgress(userId: string): Promise<ScanProgress> {
  try {
    const key = storageKey(userId);
    const result = await browser.storage.local.get(key);
    if (result && result[key]) {
      return result[key] as ScanProgress;
    }
  } catch (err) {
    console.error("Failed to load scan progress:", err);
  }
  return {
    userId,
    followers: [],
    following: [],
    next: {},
    done: { followers: false, following: false },
    status: "idle",
    updatedAt: 0,
  };
}

export async function saveScanProgress(progress: ScanProgress): Promise<void> {
  try {
    const key = storageKey(progress.userId);
    await browser.storage.local.set({ [key]: progress });
  } catch (err) {
    console.error("Failed to save scan progress:", err);
  }
}

export async function clearScanProgress(userId: string): Promise<void> {
  try {
    const key = storageKey(userId);
    await browser.storage.local.remove(key);
  } catch (err) {
    console.error("Failed to clear scan progress:", err);
  }
}

export interface FetchFriendshipPageResult {
  success: boolean;
  users?: IgFriendUser[];
  nextMaxId?: string;
  error?: string;
  status?: number;
  rateLimited?: boolean;
}

export async function fetchFriendshipPage(
  userId: string,
  kind: FriendshipKind,
  maxId?: string,
  count = 50
): Promise<FetchFriendshipPageResult> {
  const tabs = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  const tabId = tabs[0]?.id;
  if (!tabId) {
    return { success: false, error: "No active Instagram tab found" };
  }

  // 1. Try sending message to content script
  try {
    const res = await browser.tabs.sendMessage(tabId, {
      type: "FETCH_FRIENDSHIP_PAGE",
      userId,
      kind,
      maxId: maxId ?? null,
      count,
    });
    if (res) return res;
  } catch {
    // Content script not ready; fallback to scripting API
  }

  // 2. Fallback via scripting API
  const browserObj = typeof browser !== "undefined" ? (browser as any) : null;
  const chromeObj =
    typeof globalThis !== "undefined" ? (globalThis as any).chrome : null;
  const scriptingApi = browserObj?.scripting || chromeObj?.scripting;

  if (!scriptingApi) {
    return {
      success: false,
      error: "Could not communicate with Instagram tab. Please refresh page.",
    };
  }

  const results = await scriptingApi.executeScript({
    target: { tabId },
    func: async (uid: string, k: string, cursor: string | null, cnt = 50) => {
      function getCookie(name: string): string | null {
        const match = document.cookie.match(
          new RegExp("(^|;\\s*)(" + name + ")=([^;]*)")
        );
        return match && match[3] ? decodeURIComponent(match[3]) : null;
      }
      const csrf = getCookie("csrftoken") || "";
      let claim = "0";
      try {
        claim = sessionStorage.getItem("www-claim-v2") || "0";
      } catch {}

      const qs = new URLSearchParams({ count: String(cnt) });
      if (cursor) qs.set("max_id", cursor);

      const url = `https://www.instagram.com/api/v1/friendships/${uid}/${k}/?${qs.toString()}`;
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: {
            "x-ig-app-id": "936619743392459",
            "x-csrftoken": csrf,
            "x-asbd-id": "359341",
            "x-ig-www-claim": claim,
            "x-requested-with": "XMLHttpRequest",
            accept: "*/*",
            referer: "https://www.instagram.com/",
          },
          credentials: "include",
        });

        if (res.status === 429) {
          return {
            success: false,
            status: 429,
            error: "Rate limited by Instagram (429)",
            rateLimited: true,
          };
        }
        if (res.status === 401) {
          return { success: false, status: 401, error: "Login required" };
        }

        const json = await res.json();
        if (!res.ok || json.status === "fail") {
          const isSpam =
            json.spam === true ||
            /feedback_required|checkpoint_required/i.test(json.message || "");
          return {
            success: false,
            status: res.status,
            error: json.message || "Failed",
            rateLimited: isSpam,
          };
        }

        const users = (json.users ?? []).map((u: any) => ({
          pk: String(u.pk ?? u.id),
          username: u.username,
          fullName: u.full_name ?? "",
          profilePicUrl: u.profile_pic_url ?? "",
          isVerified: Boolean(u.is_verified),
          isPrivate: Boolean(u.is_private),
        }));
        const nextMaxId =
          json.next_max_id != null && json.next_max_id !== ""
            ? String(json.next_max_id)
            : undefined;
        return { success: true, status: res.status, users, nextMaxId };
      } catch (e: any) {
        return { success: false, error: String(e) };
      }
    },
    args: [userId, kind, maxId ?? null, count],
  });

  return (
    results[0]?.result ?? { success: false, error: "Execution result empty" }
  );
}

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export function getJitterDelay(minMs = 1500, maxMs = 2500): number {
  return minMs + Math.floor(Math.random() * (maxMs - minMs));
}

/**
 * Escapes CSV cells to prevent CSV formula injection (OWASP guideline).
 */
export function exportUsersToCsv(filename: string, users: IgFriendUser[]) {
  const escapeCell = (val: string) => {
    const str = val == null ? "" : String(val);
    const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
    return `"${safeStr.replace(/"/g, '""')}"`;
  };

  const headers = [
    "User ID",
    "Username",
    "Full Name",
    "Profile URL",
    "Verified",
    "Private",
  ];
  const rows = users.map((u) =>
    [
      escapeCell(u.pk),
      escapeCell(u.username),
      escapeCell(u.fullName || ""),
      escapeCell(`https://www.instagram.com/${u.username}/`),
      escapeCell(u.isVerified ? "yes" : "no"),
      escapeCell(u.isPrivate ? "yes" : "no"),
    ].join(",")
  );

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
