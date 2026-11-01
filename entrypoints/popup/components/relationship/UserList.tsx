import { useState } from "react";
import type { IgFriendUser } from "../../services";

interface UserAvatarProps {
  url?: string;
  username: string;
}

function UserAvatar({ url, username }: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);

  if (!url || hasError) {
    return (
      <div className="user-avatar placeholder">
        {username[0]?.toUpperCase() || "?"}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      className="user-avatar"
      loading="lazy"
      onError={() => setHasError(true)}
    />
  );
}

interface UserListProps {
  users: IgFriendUser[];
  emptyMessage?: string;
}

export function UserList({
  users,
  emptyMessage = "No users found in this list.",
}: UserListProps) {
  if (users.length === 0) {
    return <div className="userlist-empty">{emptyMessage}</div>;
  }

  return (
    <div className="userlist-scroll">
      {users.slice(0, 500).map((u) => (
        <div key={u.pk} className="user-item">
          <UserAvatar url={u.profilePicUrl} username={u.username} />
          <div className="user-info">
            <div className="user-handle-row">
              <a
                href={`https://www.instagram.com/${u.username}/`}
                target="_blank"
                rel="noreferrer"
                className="user-username"
              >
                @{u.username}
              </a>
              {u.isVerified && (
                <span className="verified-badge" title="Verified">
                  ✓
                </span>
              )}
              {u.isPrivate && (
                <span className="private-badge" title="Private account">
                  🔒
                </span>
              )}
            </div>
            {u.fullName && <div className="user-fullname">{u.fullName}</div>}
          </div>
        </div>
      ))}
      {users.length > 500 && (
        <div className="userlist-hint">
          Showing 500 of {users.length}. Export CSV to view all users.
        </div>
      )}
    </div>
  );
}

export default UserList;
