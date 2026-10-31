import { useState, useEffect } from "react";
import { fetchUserProfile } from "../../services";
import type { UserProfileData } from "../../services";

interface ProfileProps {
  userId: string | null;
}

export function Profile({ userId }: ProfileProps) {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [status, setStatus] = useState<string>("idle");

  useEffect(() => {
    let isActive = true;

    if (!userId) {
      setStatus("no user id");
      return;
    }

    const load = async () => {
      try {
        setStatus("loading profile...");
        const res = await fetchUserProfile(userId);
        if (!isActive) return;

        if (res.success && res.data) {
          setProfile(res.data);
          setStatus("ready");
        } else {
          setStatus(`failed: ${res.error || "unknown"}`);
        }
      } catch (err) {
        if (!isActive) return;
        setStatus(`error: ${String(err)}`);
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, [userId]);

  return (
    <div className="profile-container">
      <div>Profile Status: {status}</div>
      {profile && (
        <div className="profile-info">
          <div>Username: @{profile.username}</div>
          <div>Name: {profile.fullName || "-"}</div>
        </div>
      )}
    </div>
  );
}

export default Profile;
