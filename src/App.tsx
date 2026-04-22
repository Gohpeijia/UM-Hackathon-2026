import { useState } from 'react';
import LoadingScreen from './components/LoadingScreen';
import Dashboard from './components/Dashboard';

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);

  if (!isLoaded) {
    return <LoadingScreen onComplete={() => setIsLoaded(true)} />;
  }

  return <Dashboard />;
}
