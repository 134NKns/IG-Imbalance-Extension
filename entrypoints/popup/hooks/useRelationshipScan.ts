import { useState, useEffect, useRef, useCallback } from "react";
import {
  type ScanProgress,
  type FriendshipKind,
  loadScanProgress,
  saveScanProgress,
  clearScanProgress,
  fetchFriendshipPage,
  sleep,
  getJitterDelay,
} from "../services";

export function useRelationshipScan(userId: string | null) {
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string>("");
  const cancelScanRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProgress(null);
      return;
    }

    loadScanProgress(userId).then((loaded) => {
      if (active) {
        setProgress(loaded);
      }
    });

    return () => {
      active = false;
    };
  }, [userId]);

  const isCompleted = Boolean(
    progress && progress.done.followers && progress.done.following
  );

  const hasData = Boolean(
    progress && (progress.following.length > 0 || progress.followers.length > 0)
  );

  const handleStartScan = useCallback(
    async (rescan = false) => {
      if (!userId) return;

      if (isScanning) {
        cancelScanRef.current = true;
        setScanMessage("Pausing scan...");
        return;
      }

      cancelScanRef.current = false;
      setIsScanning(true);

      let current: ScanProgress;
      if (rescan || isCompleted) {
        current = {
          userId,
          followers: [],
          following: [],
          next: {},
          done: { followers: false, following: false },
          status: "scanning",
          updatedAt: Date.now(),
        };
      } else {
        current = progress
          ? { ...progress, status: "scanning", error: null }
          : {
              userId,
              followers: [],
              following: [],
              next: {},
              done: { followers: false, following: false },
              status: "scanning",
              updatedAt: Date.now(),
            };
      }

      setProgress({ ...current });
      await saveScanProgress(current);

      const phases: FriendshipKind[] = ["following", "followers"];

      try {
        for (const kind of phases) {
          if (current.done[kind]) continue;

          const seenIds = new Set(current[kind].map((u) => u.pk));
          let cursor = current.next[kind];

          while (!current.done[kind]) {
            if (cancelScanRef.current) {
              current.status = "paused";
              current.updatedAt = Date.now();
              await saveScanProgress(current);
              setProgress({ ...current });
              setScanMessage("Scan paused. Click Resume to continue.");
              setIsScanning(false);
              return;
            }

            setScanMessage(
              `Scanning ${kind}... (${current[kind].length} loaded)`
            );

            const res = await fetchFriendshipPage(userId, kind, cursor, 50);

            if (!res.success) {
              const errMsg = res.error || "Failed to fetch";
              current.status = "error";
              current.error = errMsg;
              current.updatedAt = Date.now();
              await saveScanProgress(current);
              setProgress({ ...current });
              setScanMessage(
                res.rateLimited
                  ? "Rate limit reached. Paused for safety."
                  : `Error: ${errMsg}`
              );
              setIsScanning(false);
              return;
            }

            const newUsers = res.users ?? [];
            for (const u of newUsers) {
              if (!seenIds.has(u.pk)) {
                seenIds.add(u.pk);
                current[kind].push(u);
              }
            }

            const nextCursor = res.nextMaxId;
            if (!nextCursor || nextCursor === cursor) {
              current.done[kind] = true;
              current.next[kind] = undefined;
            } else {
              cursor = nextCursor;
              current.next[kind] = nextCursor;
            }

            current.updatedAt = Date.now();
            await saveScanProgress(current);
            setProgress({ ...current });

            if (!current.done[kind]) {
              const delay = getJitterDelay(1500, 2500);
              await sleep(delay);
            }
          }
        }

        current.status = "completed";
        current.updatedAt = Date.now();
        await saveScanProgress(current);
        setProgress({ ...current });
        setScanMessage("Scan completed successfully!");
      } catch (err: any) {
        current.status = "error";
        current.error = String(err);
        current.updatedAt = Date.now();
        await saveScanProgress(current);
        setProgress({ ...current });
        setScanMessage(`Error: ${String(err)}`);
      } finally {
        setIsScanning(false);
      }
    },
    [userId, isScanning, isCompleted, progress]
  );

  const handleReset = useCallback(async () => {
    if (!userId) return;
    if (confirm("Are you sure you want to clear saved scan data?")) {
      await clearScanProgress(userId);
      setProgress(null);
      setScanMessage("");
    }
  }, [userId]);

  return {
    progress,
    isScanning,
    isCompleted,
    hasData,
    scanMessage,
    handleStartScan,
    handleReset,
  };
}
