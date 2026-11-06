import { useState, useEffect, useCallback } from "react";
import { fetchPost, downloadMedia } from "../../services";
import type { PostMediaItem } from "../../services";

interface PostViewerProps {
  postShortcode?: string | null;
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

function safeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60);
}

export function PostViewer({ postShortcode }: PostViewerProps) {
  const [state, setState] = useState<LoadState>({ status: "idle" });
  const [username, setUsername] = useState<string | null>(null);
  const [items, setItems] = useState<PostMediaItem[]>([]);
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const loadPost = useCallback(async () => {
    if (!postShortcode) return;
    setState({ status: "loading" });
    setUsername(null);
    setItems([]);
    setNotice(null);
    try {
      const res = await fetchPost(postShortcode);
      if (!res.success || !res.data) {
        setState({ status: "error", message: res.error || "Failed to load post" });
        return;
      }
      setUsername(res.data.username ?? null);
      if (res.data.items.length === 0) {
        setState({ status: "error", message: "No media found in this post." });
        return;
      }
      setItems(res.data.items);
      setState({ status: "ready" });
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
  }, [postShortcode]);

  useEffect(() => {
    if (postShortcode) loadPost();
  }, [postShortcode, loadPost]);

  const handleDownload = async (item: PostMediaItem, i: number) => {
    const url = item.videoUrl || item.imageUrl;
    if (!url) return;
    setNotice(null);
    setDownloading((d) => ({ ...d, [item.id]: true }));
    try {
      const ext = item.mediaType === "video" ? "mp4" : "jpg";
      const name = `${safeFilename(username ?? "ig")}_${postShortcode}_${i + 1}.${ext}`;
      const res = await downloadMedia(url, name);
      if (!res.success) setNotice(res.error || "Download failed");
    } catch (err) {
      setNotice(String(err));
    } finally {
      setDownloading((d) => ({ ...d, [item.id]: false }));
    }
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {state.status === "ready" && (
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-xs font-bold text-white">
            {username ? `@${username}` : postShortcode}
          </div>
          <button type="button" className={ghostBtn} onClick={loadPost}>
            Reload
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {state.status === "loading" && (
          <div className="text-sm text-zinc-400">Loading post...</div>
        )}
        {state.status === "error" && (
          <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2.5">
            <div className="text-sm text-red-400">{state.message}</div>
            <div>
              <button type="button" className={primaryBtn} onClick={loadPost}>
                Try again
              </button>
            </div>
          </div>
        )}
        {notice && <div className="text-xs text-amber-400">{notice}</div>}

        {state.status === "ready" && items.length > 0 && (
          <div className="flex flex-col gap-2">
            {items.map((item, i) => (
              <div
                key={item.id}
                className="flex flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 p-2"
              >
                {item.mediaType === "video" ? (
                  <video
                    src={item.videoUrl}
                    poster={item.imageUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-[260px] w-full rounded-md border border-zinc-800 bg-black object-contain"
                  />
                ) : (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="max-h-[260px] w-full rounded-md border border-zinc-800 bg-black object-contain"
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                    {item.mediaType === "video" ? "Video" : "Photo"}
                    {items.length > 1 ? ` ${i + 1}/${items.length}` : ""}
                  </span>
                  <button
                    type="button"
                    className={primaryBtn}
                    disabled={downloading[item.id]}
                    onClick={() => handleDownload(item, i)}
                  >
                    {downloading[item.id] ? "..." : "Download"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {state.status === "idle" && (
          <div className="text-sm text-zinc-400">
            Open an Instagram post (e.g. /p/...) to download its media.
          </div>
        )}
      </div>
    </div>
  );
}

export default PostViewer;
