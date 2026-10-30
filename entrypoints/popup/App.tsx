import { useState, useEffect } from 'react';
import { getCurrentTabUrl, isInstagramUrl } from './services';
import './App.css';

function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isInstagram, setIsInstagram] = useState<boolean>(false);

  useEffect(() => {
    const checkTab = async () => {
      const url = await getCurrentTabUrl();
      const isIg = isInstagramUrl(url);

      setCurrentUrl(url);
      setIsInstagram(isIg);

      console.log('[IG-Imbalance] URL:', url, '| Is Instagram:', isIg);
    };

    checkTab();

    const handleUpdated = (_tabId: number, changeInfo: { url?: string }) => {
      if (changeInfo.url) {
        checkTab();
      }
    };

    browser.tabs.onUpdated.addListener(handleUpdated);
    return () => {
      browser.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  return (
    <div className="container">
      <h1>IG-IMBALANCE</h1>
    </div>
  );
}

export default App;
