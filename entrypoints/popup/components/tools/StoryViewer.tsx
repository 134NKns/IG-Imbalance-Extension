import { useState, useEffect, useCallback } from "react";
import {
  fetchViewedProfileDom,
  fetchStory,
} from "../../services";
import type { StoryMediaItem } from "../../services";

interface StoryViewerProps {
  viewingProfile?: string | null;
}

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready" };

const primaryBtn =
  "bg-brand text-white rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-brand/90";
const ghostBtn =
  "rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40";

export function StoryViewer({ viewingProfile }: StoryViewerProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [username, setUsername] = useState<string | null>(null);
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [items, setItems] = useState<StoryMediaItem[]>([]);
  const [index, setIndex] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const loadStory = useCallback(async () => {
    if (!viewingProfile) return;
    setState({ status: "loading" });
    setItems([]);
    setIndex(0);
    setVideoError(false);
    try {
      // Resolve pk (numeric user id) from the open profile page DOM
      const dom = await fetchViewedProfileDom();
      if (dom.success && dom.data) {
        setUsername(dom.data.username);
        if (dom.data.profilePicUrl) setPicUrl(dom.data.profilePicUrl);
      }
      const pk = dom.success ? dom.data?.userId : null;
      if (!pk) {
        setState({
          status: "error",
          message:
            "Could not resolve user id from the profile page. Make sure you are on that user's profile.",
        });
        return;
      }
      const res = await fetchStory(pk);
      if (!res.success || !res.data) {
        setState({ status: "error", message: res.error || "Failed to load story" });
        return;
      }
      if (res.data.items.length === 0) {
        setState({
          status: "error",
          message: "No active story right now.",
        });
        return;
      }
      setItems(res.data.items);
      setState({ status: "ready" });
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
  }, [viewingProfile]);

  useEffect(() => {
    if (viewingProfile) loadStory();
  }, [viewingProfile, loadStory]);

  const current = items[index];
  const isVideo = current?.mediaType === "video";

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {picUrl ? (
            <img
              src={picUrl}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300">
              {username?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate text-xs font-bold text-white">
              @{username ?? viewingProfile}
            </div>
            {state.status === "ready" && items.length > 1 && (
              <div className="text-[10px] text-zinc-500">
                {index + 1} / {items.length}
              </div>
            )}
          </div>
        </div>
        <button type="button" className={ghostBtn} onClick={loadStory}>
          Reload
        </button>
      </div>

      {/* Progress segments for each story item */}
      {state.status === "ready" && items.length > 1 && (
        <div className="flex gap-1">
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              className={`h-1 flex-1 rounded-full transition-colors ${
                i === index ? "bg-brand" : "bg-zinc-700 hover:bg-zinc-600"
              }`}
              onClick={() => setIndex(i)}
              aria-label={`Story ${i + 1}`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {state.status === "loading" && (
          <div className="text-sm text-zinc-400">Loading story...</div>
        )}
        {state.status === "error" && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
            <div className="text-sm text-red-400">{state.message}</div>
            <div>
              <button type="button" className={primaryBtn} onClick={loadStory}>
                Try again
              </button>
            </div>
          </div>
        )}

        {state.status === "ready" && current && (
          <>
            {isVideo ? (
              <video
                key={current.id}
                src={current.videoUrl}
                poster={current.imageUrl}
                controls
                autoPlay
                muted
                loop
                playsInline
                className="max-h-[300px] w-full rounded-lg border border-zinc-800 bg-black object-contain"
                onError={() => setVideoError(true)}
              />
            ) : (
              <img
                key={current.id}
                src={current.imageUrl}
                alt=""
                className="max-h-[300px] w-full rounded-lg border border-zinc-800 bg-black object-contain"
              />
            )}
            {isVideo && videoError && (
              <div className="text-xs text-amber-400">
                Video failed to load — it may have expired. Reload to retry.
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className={ghostBtn}
                disabled={items.length <= 1}
                onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
              >
                ←
              </button>
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                {isVideo ? "Video" : "Photo"}
              </div>
              <button
                type="button"
                className={ghostBtn}
                disabled={items.length <= 1}
                onClick={() => setIndex((i) => (i + 1) % items.length)}
              >
                →
              </button>
            </div>
          </>
        )}

        {state.status === "idle" && (
          <div className="text-sm text-zinc-400">
            Open a profile page to see active stories anonymously.
          </div>
        )}
      </div>
    </div>
  );
}

export default StoryViewer;
