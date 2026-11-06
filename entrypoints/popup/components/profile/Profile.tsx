import { useState, useEffect } from "react";
import { fetchUserProfile } from "../../services";
import type { UserProfileData } from "../../services";

interface ProfileProps {
  userId: string | null;
  onProfileLoaded?: (profile: UserProfileData) => void;
  actions?: React.ReactNode;
}

export function Profile({ userId, onProfileLoaded, actions }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<boolean>(false);

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
        setAvatarError(false);
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

  if (!userId) return null;

  const avatarBox =
    "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-brand";

  return (
    <div className="flex w-full flex-col gap-3">
      {loading && !profile && (
        <div className="text-sm text-zinc-400">Loading profile...</div>
      )}
      {error && !profile && <div className="text-sm text-red-400">{error}</div>}
      {profile && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
          <div
            className={
              avatarBox +
              " " +
              (profile.profilePicUrl && !avatarError
                ? "bg-zinc-700"
                : "bg-zinc-700 text-lg font-bold text-zinc-100")
            }
          >
            {profile.profilePicUrl && !avatarError ? (
              <img
                src={profile.profilePicUrl}
                alt={profile.username}
                className="h-full w-full object-cover"
                onError={() => setAvatarError(true)}
              />
            ) : (
              profile.username[0]?.toUpperCase()
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
          {actions && <div className="flex shrink-0 items-center">{actions}</div>}
        </div>
      )}
    </div>
  );
}

export default Profile;
