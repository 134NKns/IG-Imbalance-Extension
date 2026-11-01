import { useState, useEffect, useCallback } from "react";
import { getCurrentTabUrl, isInstagramUrl, getDsUserId } from "./services";
import { Profile, RelationshipView } from "./components";
import { useRelationshipScan } from "./hooks/useRelationshipScan";
import "./App.css";

function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isInstagram, setIsInstagram] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState<boolean>(true);

  const {
    progress,
    isScanning,
    isCompleted,
    hasData,
    scanMessage,
    handleStartScan,
    handleReset,
  } = useRelationshipScan(userId);

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

  return (
    <main className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="app-branding">
          <h1 className="app-title">IMBALANCE</h1>
        </div>
      </header>

      {/* Main Body */}
      {checking ? (
        <article className="app-card status-loading" aria-busy="true">
          Checking connection...
        </article>
      ) : !isInstagram ? (
        <article className="app-card warning-card">
          <h3>Not on Instagram</h3>
          <p className="app-hint">Please open an Instagram tab.</p>
          <button onClick={handleOpenInstagram}>Open Instagram</button>
        </article>
      ) : !userId ? (
        <article className="app-card warning-card">
          <h3>Not Logged In</h3>
          <p className="app-hint">
            Please log in to your Instagram account on the active tab
          </p>
          <button onClick={checkStatus}>Refresh</button>
        </article>
      ) : (
        <section className="app-content">
          <Profile
            userId={userId}
            actions={
              <div className="scan-actions" role="group">
                <button
                  className={isScanning ? "contrast" : "primary"}
                  onClick={() => handleStartScan(false)}
                >
                  {isScanning
                    ? "Pause"
                    : isCompleted
                      ? "Rescan"
                      : hasData
                        ? "Resume"
                        : "Scan"}
                </button>
                {hasData && !isScanning && (
                  <button
                    className="btn-clear"
                    onClick={handleReset}
                    title="Clear cached scan data"
                  >
                    Clear
                  </button>
                )}
              </div>
            }
          />
          {/* <RelationshipView
            userId={userId}
            progress={progress}
            scanMessage={scanMessage}
          /> */}
        </section>
      )}
    </main>
  );
}

export default App;
