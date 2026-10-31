import { useState, useEffect } from 'react';
import {
  getCurrentTabUrl,
  isInstagramUrl,
  getDsUserId,
} from './services';
import { Profile } from './components';
import './App.css';

function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isInstagram, setIsInstagram] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      try {
        const url = await getCurrentTabUrl();
        const isIg = isInstagramUrl(url);
        const currentUserId = await getDsUserId();

        if (!isActive) return;

        setCurrentUrl(url);
        setIsInstagram(isIg);
        setUserId(currentUserId);
      } catch (err) {
        console.error(err);
      }
    };

    run();

    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="container">
      <div>URL: {currentUrl || 'none'}</div>
      <div>Is IG: {String(isInstagram)}</div>
      <div>User ID: {userId || 'none'}</div>
      <Profile userId={userId} />
    </div>
  );
}

export default App;
