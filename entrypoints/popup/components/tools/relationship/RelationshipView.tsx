import { useState, useMemo } from "react";
import {
  type ScanProgress,
  type RelationshipTab,
  computeRelationshipSets,
  exportUsersToCsv,
} from "../../../services";
import { UserList } from "./UserList";

interface RelationshipViewProps {
  userId: string | null;
  progress: ScanProgress | null;
  scanMessage?: string;
}

const TABS: { id: RelationshipTab; label: string }[] = [
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
  // { id: "notFollowingBack", label: "Don't follow back" },
  // { id: "fans", label: "Fans" },
  // { id: "mutual", label: "Mutual" },
];

export function RelationshipView({
  userId,
  progress,
  scanMessage,
}: RelationshipViewProps) {
  const [activeTab, setActiveTab] = useState<RelationshipTab>("followers");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredUsers = useMemo(() => {
    const list = relationshipSets[activeTab] || [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.fullName && u.fullName.toLowerCase().includes(q))
    );
  }, [relationshipSets, activeTab, searchQuery]);

  const handleExportCsv = () => {
    if (!filteredUsers.length) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `ig_${activeTab}_${dateStr}.csv`;
    exportUsersToCsv(filename, filteredUsers);
  };

  if (!userId) {
    return (
      <div className="relationship-empty-box">
        Please log in to Instagram to scan relationships.
      </div>
    );
  }

  return (
    <div className="relationship-container">
      {scanMessage && (
        <div
          className={`scan-status-banner ${
            progress?.status === "error" ? "error" : ""
          }`}
        >
          {scanMessage}
        </div>
      )}

      {/* Tabs */}
      <div className="tabs-container">
        {TABS.map((tab) => {
          const count = relationshipSets[tab.id].length;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${isActive ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-label">{tab.label}</span>
              <span className="tab-badge">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Search and Action Bar */}
      <div className="toolbar-row">
        <input
          type="text"
          className="search-input"
          placeholder={`Search ${activeTab}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className="csv-btn"
          onClick={handleExportCsv}
          disabled={filteredUsers.length === 0}
          title="Export current tab list to CSV"
        >
          Export CSV
        </button>
      </div>

      {/* User List */}
      <UserList users={filteredUsers} emptyMessage={`No ${activeTab} found.`} />
    </div>
  );
}

export default RelationshipView;
