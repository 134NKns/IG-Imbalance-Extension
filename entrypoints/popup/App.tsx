import { useState, useEffect } from 'react';
import {
  getCurrentTabUrl,
  isInstagramUrl,
  getDsUserId,
  getUsernameFromUrl,
  getUserInfo,
} from './services';
import './App.css';

function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isInstagram, setIsInstagram] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      try {
        setStatus('checking tab...');
        const url = await getCurrentTabUrl();
        const isIg = isInstagramUrl(url);
        const currentUserId = await getDsUserId();

        if (!isActive) return;

        setCurrentUrl(url);
        setIsInstagram(isIg);
        setUserId(currentUserId);

        if (!isIg) {
          setStatus('not on instagram');
          return;
        }

        if (!currentUserId) {
          setStatus('no user id found');
          return;
        }

        const usernameFromUrl = getUsernameFromUrl(url);

        setStatus('fetching user profile...');
        const res = await getUserInfo(usernameFromUrl || undefined);
        if (!isActive) return;

        if (res.success && res.user) {
          setProfile(res.user);
          setStatus('ready');
        } else {
          setStatus(
            `failed: status=${res.status ?? 'unknown'} error=${res.error || res.body || ''}`
          );
        }
      } catch (err) {
        if (!isActive) {
          setStatus(`error: ${String(err)}`);
        }
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
      <div>Status: {status}</div>
      {profile && (
        <div>
          <div>Username: {profile.username}</div>
          <div>Followers: {profile.followerCount}</div>
          <div>Following: {profile.followingCount}</div>
        </div>
      )}
    </div>
  );
}

export default App;
