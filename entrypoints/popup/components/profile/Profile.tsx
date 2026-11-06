import { useState, useEffect } from "react";
import {
  fetchUserProfile,
  fetchViewedProfileDom,
  loadScanProgress,
} from "../../services";
import type { UserProfileData, ViewedProfileData, ScanProgress } from "../../services";

interface ProfileProps {
  userId: string | null;
  /** Profile page username currently open in the tab (e.g. /cristiano/) */
  viewingProfile?: string | null;
  onProfileLoaded?: (profile: UserProfileData) => void;
  actions?: React.ReactNode;
}

const avatarBox =
  "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand";

function Avatar({
  profilePicUrl,
  username,
  fallbackBg,
}: {
  profilePicUrl?: string;
  username: string;
  fallbackBg: string;
}) {
  const [avatarError, setAvatarError] = useState(false);
  return (
    <div
      className={
        avatarBox +
        " " +
        (profilePicUrl && !avatarError ? fallbackBg : fallbackBg + " text-lg font-bold text-zinc-100")
      }
    >
      {profilePicUrl && !avatarError ? (
        <img
          src={profilePicUrl}
          alt={username}
          className="h-full w-full object-cover"
          onError={() => setAvatarError(true)}
        />
      ) : (
        username[0]?.toUpperCase()
      )}
    </div>
  );
}

const badgeBase =
  "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold";

interface RelationshipState {
  pills: { label: string; cls: string }[];
}

function computeRelationshipState(scan: ScanProgress | null, username: string): RelationshipState {
  const u = username.toLowerCase();
  const inFollowing = scan?.following.some((x) => x.username.toLowerCase() === u) ?? false;
  const inFollowers = scan?.followers.some((x) => x.username.toLowerCase() === u) ?? false;

  const pills: { label: string; cls: string }[] = [];
  if (inFollowing && inFollowers) {
    pills.push({ label: "Mutual", cls: "border-brand/40 bg-brand/20 text-brand" });
  } else if (inFollowing) {
    pills.push({ label: "Not following back", cls: "border-sky-500/30 bg-sky-500/15 text-sky-400" });
  } else if (inFollowers) {
    pills.push({ label: "Follows you", cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400" });
  } else if (scan && (scan.following.length > 0 || scan.followers.length > 0)) {
    pills.push({ label: "No relationship", cls: "border-zinc-600 bg-zinc-700/40 text-zinc-400" });
  } else {
    pills.push({ label: "No scan data — run a scan", cls: "border-amber-500/30 bg-amber-500/15 text-amber-400" });
  }
  return { pills };
}

function findMatchedUser(scan: ScanProgress | null, username: string) {
  const u = username.toLowerCase();
  return (
    scan?.following.find((x) => x.username.toLowerCase() === u) ||
    scan?.followers.find((x) => x.username.toLowerCase() === u)
  );
}

export function Profile({ userId, viewingProfile, onProfileLoaded, actions }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [viewProfile, setViewProfile] = useState<ViewedProfileData | null>(null);
  const [viewLoading, setViewLoading] = useState<boolean>(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Own profile (logged-in user)
  useEffect(() => {
    let isActive = true;
    if (!userId) {
      setProfile(null);
      return;
    }
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchUserProfile(userId);
        if (!isActive) return;
        if (res.success && res.data) {
          setProfile(res.data);
          onProfileLoaded?.(res.data);
        } else {
          setError(res.error || "Failed to load profile");
        }
      } catch (err) {
        if (!isActive) return;
        setError(String(err));
      } finally {
        if (isActive) setLoading(false);
      }
    };
    load();
    return () => {
      isActive = false;
    };
  }, [userId]);

  // Our scan data (following/followers) to look the viewed user up against
  useEffect(() => {
    let isActive = true;
    if (!userId) {
      setScan(null);
      return;
    }
    loadScanProgress(userId).then((loaded) => {
      if (isActive) setScan(loaded);
    });
    return () => {
      isActive = false;
    };
  }, [userId]);

  // Viewed profile: pull name + pic from the page DOM only (no API)
  useEffect(() => {
    let isActive = true;
    setViewProfile(null);
    setViewError(null);
    if (!viewingProfile) return;
    setViewLoading(true);
    fetchViewedProfileDom()
      .then((res) => {
        if (!isActive) return;
        setViewLoading(false);
        if (res.success && res.data) setViewProfile(res.data);
        else setViewError(res.error || "Failed to read profile from page");
      })
      .catch((err) => {
        if (!isActive) return;
        setViewLoading(false);
        setViewError(String(err));
      });
    return () => {
      isActive = false;
    };
  }, [viewingProfile]);

  // Viewed-profile branch
  if (viewingProfile) {
    const matched = viewProfile ? findMatchedUser(scan, viewProfile.username) : undefined;
    const isSelf =
      !!profile &&
      !!viewProfile &&
      profile.username.toLowerCase() === viewProfile.username.toLowerCase();
    const pills: { label: string; cls: string }[] = [];
    if (matched?.isVerified) {
      pills.push({ label: "Verified ✓", cls: "border-sky-500/30 bg-sky-500/15 text-sky-400" });
    }
    if (matched?.isPrivate) {
      pills.push({ label: "Private", cls: "border-amber-500/30 bg-amber-500/15 text-amber-400" });
    }
    if (!isSelf && viewProfile) {
      pills.push(...computeRelationshipState(scan, viewProfile.username).pills);
    }
    const picUrl = viewProfile?.profilePicUrl || matched?.profilePicUrl;

    if (viewLoading && !viewProfile) {
      return <div className="text-sm text-zinc-400">Loading profile...</div>;
    }
    if (viewError && !viewProfile) {
      return <div className="text-sm text-red-400">{viewError}</div>;
    }

    return (
      <div className="flex w-full">
        {viewProfile && (
          <div className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar
                profilePicUrl={picUrl}
                username={viewProfile.username}
                fallbackBg="bg-zinc-700"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold text-white">
                  @{viewProfile.username}
                </span>
                {matched?.fullName && (
                  <span className="truncate text-xs text-zinc-400">
                    {matched.fullName}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {pills.length > 0 && (
                <div className="flex flex-col items-end gap-1">
                  {pills.map((p) => (
                    <span key={p.label} className={`${badgeBase} ${p.cls}`}>
                      {p.label}
                    </span>
                  ))}
                </div>
              )}
              {actions && <div className="flex shrink-0 items-center">{actions}</div>}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Own profile branch
  if (!userId) return null;

  return (
    <div className="flex w-full flex-col gap-3">
      {loading && !profile && (
        <div className="text-sm text-zinc-400">Loading profile...</div>
      )}
      {error && !profile && <div className="text-sm text-red-400">{error}</div>}
      {profile && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              profilePicUrl={profile.profilePicUrl}
              username={profile.username}
              fallbackBg="bg-zinc-700"
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-bold text-white">
                  @{profile.username}
                </span>
              </div>
              {profile.fullName && (
                <div className="truncate text-xs text-zinc-400">
                  {profile.fullName}
                </div>
              )}
              <div className="mt-0.5 flex gap-2.5 text-xs text-zinc-400">
                {profile.followingCount !== undefined && (
                  <span>
                    <strong className="text-white">
                      {profile.followingCount}
                    </strong>{" "}
                    following
                  </span>
                )}
                {profile.followerCount !== undefined && (
                  <span>
                    <strong className="text-white">
                      {profile.followerCount}
                    </strong>{" "}
                    followers
                  </span>
                )}
              </div>
            </div>
          </div>
          {actions && (
            <div className="flex shrink-0 items-center">{actions}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Profile;
