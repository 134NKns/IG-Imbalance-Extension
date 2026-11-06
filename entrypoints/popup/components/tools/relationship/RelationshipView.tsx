import { useState, useMemo, useEffect, useRef } from "react";
import { type RelationshipTab, computeRelationshipSets } from "../../../services";
import { useRelationshipScan } from "../../../hooks/useRelationshipScan";
import { UserList } from "./UserList";

interface RelationshipViewProps {
  userId: string | null;
}

const FOLLOW_TABS: { id: RelationshipTab; label: string }[] = [
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
];

const TOOLS_MENU: { id: RelationshipTab; label: string }[] = [
  { id: "fans", label: "Fans" },
  { id: "mutual", label: "Mutual" },
  { id: "notFollowingBack", label: "Not Following Back" },
];

const TAB_LABELS: Record<RelationshipTab, string> = {
  followers: "Followers",
  following: "Following",
  fans: "Fans",
  mutual: "Mutual",
  notFollowingBack: "Not Following Back",
};

export function RelationshipView({ userId }: RelationshipViewProps) {
  const [activeTab, setActiveTab] = useState<RelationshipTab>("followers");
  const [searchQuery, setSearchQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  const {
    progress,
    isScanning,
    isCompleted,
    hasData,
    scanMessage,
    handleStartScan,
    handleReset,
  } = useRelationshipScan(userId);

  const relationshipSets = useMemo(() => {
    if (!progress) {
      return {
        notFollowingBack: [],
        fans: [],
        mutual: [],
        following: [],
        followers: [],
      };
    }
    return computeRelationshipSets(progress);
  }, [progress]);

  const progressPct = useMemo(() => {
    if (!progress) return 0;
    if (progress.done.following && progress.done.followers) return 100;
    const cap = 49;
    // hook scans "following" phase first, then "followers"
    const loaded = progress.done.following
      ? progress.followers.length
      : progress.following.length;
    const phaseOffset = progress.done.following ? 50 : 0;
    return phaseOffset + Math.min(cap, Math.round((loaded / 60) * cap));
  }, [progress]);

  const filteredUsers = useMemo(() => {
    const list = relationshipSets[activeTab] || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q)),
    );
  }, [relationshipSets, activeTab, searchQuery]);

  const btnBase =
    "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none";
  const btnPrimary = `${btnBase} bg-brand text-white hover:bg-brand/90`;
  const btnGhost = `${btnBase} border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100`;
  const btnClear = `${btnGhost} text-red-400 hover:bg-red-950/50`;

  if (!userId) {
    return (
      <div className="relationship-empty-box">
        Please log in to Instagram to scan relationships.
      </div>
    );
  }

  return (
    <div className="relationship-container">
      {/* Scan progress — hidden when scan completed */}
      {!isCompleted && progress && (
        <div className="flex flex-col gap-1">
          <div className="h-4 w-full overflow-hidden rounded-full bg-neutral-800">
            <div
              className="flex h-4 items-center justify-center rounded-full bg-brand p-0.5 text-center text-[10px] font-medium leading-none text-white"
              style={{ width: `${progressPct}%` }}
            >
              {progressPct}%
            </div>
          </div>
          {scanMessage && progress.status !== "scanning" && (
            <p className="text-[11px] leading-tight text-zinc-400">
              {scanMessage}
            </p>
          )}
        </div>
      )}

      {/* Scan controls */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasData ? (
          <button
            type="button"
            className={btnGhost}
            onClick={() => handleStartScan(true)}
            disabled={isScanning}
          >
            {isScanning ? "Scanning…" : "Re-scan"}
          </button>
        ) : (
          <button
            type="button"
            className={btnPrimary}
            onClick={() => handleStartScan()}
            disabled={isScanning}
          >
            {isScanning ? "Scanning…" : "Scan"}
          </button>
        )}

        <button
          type="button"
          className={btnClear}
          onClick={handleReset}
          disabled={isScanning}
        >
          Clear
        </button>

        {/* Follow tab counts — same row as scan controls */}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {FOLLOW_TABS.map((tab) => {
            const count = relationshipSets[tab.id].length;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`scan-count-badge ${isActive ? "active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}: {count}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search and Action Bar */}
      <div className="toolbar-row">
        <input
          type="text"
          className="search-input"
          placeholder={`Search ${TAB_LABELS[activeTab]}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="relative">
          <button
            type="button"
            className={`${btnPrimary} h-full`}
            onClick={() => setMenuOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            Tools
            <svg
              className="h-3.5 w-3.5"
              aria-hidden="true"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="m19 9-7 7-7-7"
              />
            </svg>
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-zinc-700 bg-zinc-800 shadow-lg"
            >
              <ul
                className="p-1 text-xs font-medium text-zinc-300"
                aria-labelledby="tools-dropdown"
              >
                {TOOLS_MENU.map((item) => {
                  const count = relationshipSets[item.id].length;
                  const isActive = activeTab === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(item.id);
                          setMenuOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 rounded p-1.5 text-left transition-colors hover:bg-zinc-700 hover:text-zinc-100"
                      >
                        <span
                          className={isActive ? "text-brand" : "text-zinc-300"}
                        >
                          {item.label}
                        </span>
                        <span className="text-zinc-500">{count}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* User List */}
      <UserList
        users={filteredUsers}
        emptyMessage={`No ${TAB_LABELS[activeTab]} found.`}
      />
    </div>
  );
}

export default RelationshipView;
