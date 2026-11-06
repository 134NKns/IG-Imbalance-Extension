import { useState, useEffect, useCallback } from "react";
import { getCurrentTabUrl, isInstagramUrl, getDsUserId } from "./services";
import { Profile, Tools } from "./components";
import { useRelationshipScan } from "./hooks/useRelationshipScan";
import "./App.css";

function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isInstagram, setIsInstagram] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(true);

  const { progress, scanMessage } = useRelationshipScan(userId);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const url = await getCurrentTabUrl();
      const isIg = isInstagramUrl(url);
      const currentUserId = await getDsUserId();

      setCurrentUrl(url);
      setIsInstagram(isIg);
      setUserId(currentUserId);
    } catch (err) {
      console.error("Error checking Instagram status:", err);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleOpenInstagram = () => {
    browser.tabs.create({ url: "https://www.instagram.com/" });
  };

  const primaryBtn =
    "bg-brand text-white rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-brand/90";

  return (
    <main className="flex flex-1 flex-col gap-3">
      {/* Top Header */}
      <header className="flex items-center justify-between border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-2">
          <h1 className="m-0 bg-linear-to-r from-[#f09433] via-[#dc2743] to-[#bc1888] bg-clip-text text-base font-bold text-transparent">
            IMBALANCE
          </h1>
        </div>
      </header>

      {/* Main Body */}
      {checking ? (
        <article className="p-3.5" aria-busy="true">
          Checking connection...
        </article>
      ) : !isInstagram ? (
        <article className="p-3.5 text-center">
          <h3 className="mb-2 text-amber-400">Not on Instagram</h3>
          <p className="mb-3.5 text-xs text-zinc-400">
            Please open an Instagram tab.
          </p>
          <button className={primaryBtn} onClick={handleOpenInstagram}>
            Open Instagram
          </button>
        </article>
      ) : !userId ? (
        <article className="p-3.5 text-center">
          <h3 className="mb-2 text-amber-400">Not Logged In</h3>
          <p className="mb-3.5 text-xs text-zinc-400">
            Please log in to your Instagram account on the active tab
          </p>
          <button className={primaryBtn} onClick={checkStatus}>
            Refresh
          </button>
        </article>
      ) : (
        <section className="mt-1 flex flex-1 flex-col gap-3">
          <Profile userId={userId} />
          <Tools
            userId={userId}
            progress={progress}
            scanMessage={scanMessage}
          />
        </section>
      )}
    </main>
  );
}

export default App;
