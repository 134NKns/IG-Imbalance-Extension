import { useState, useEffect } from 'react';
import {
  getCurrentTabUrl,
  isInstagramUrl,
  getDsUserId,
  testFetchFollowing,
} from './services';
import './App.css';

function App() {
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [isInstagram, setIsInstagram] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [sampleUsers, setSampleUsers] = useState<
    Array<{ username: string; fullName: string }>
  >([]);

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

        setStatus('testing API: friendships/following...');
        const res = await testFetchFollowing(currentUserId);
        if (!isActive) return;

        if (res.success && res.users) {
          setStatus(`success: status=${res.status} returned=${res.totalReturned}`);
          setSampleUsers(res.users);
        } else {
          setStatus(
            `failed: status=${res.status ?? 'unknown'} error=${res.error || res.body || ''}`
          );
        }
      } catch (err) {
        if (!isActive) return;
        setStatus(`error: ${String(err)}`);
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
      {sampleUsers.length > 0 && (
        <div>
          <div>Sample Following ({sampleUsers.length}):</div>
          {sampleUsers.slice(0, 5).map((u, i) => (
            <div key={i}>
              - @{u.username} ({u.fullName})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
