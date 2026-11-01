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

  return (
    <div className="profile-container">
      {loading && !profile && (
        <div className="profile-status">Loading profile...</div>
      )}
      {error && !profile && <div className="profile-error">{error}</div>}
      {profile && (
        <div className="profile-card">
          {profile.profilePicUrl && !avatarError ? (
            <img
              src={profile.profilePicUrl}
              alt={profile.username}
              className="profile-avatar"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="profile-avatar placeholder">
              {profile.username[0]?.toUpperCase()}
            </div>
          )}
          <div className="profile-info">
            <div className="profile-username-row">
              <span className="profile-username">@{profile.username}</span>
            </div>
            {profile.fullName && (
              <div className="profile-fullname">{profile.fullName}</div>
            )}
            <div className="profile-counts">
              {profile.followingCount !== undefined && (
                <span>
                  <strong>{profile.followingCount}</strong> following
                </span>
              )}
              {profile.followerCount !== undefined && (
                <span>
                  <strong>{profile.followerCount}</strong> followers
                </span>
              )}
            </div>
          </div>
          {actions && <div className="profile-actions">{actions}</div>}
        </div>
      )}
    </div>
  );
}

export default Profile;
