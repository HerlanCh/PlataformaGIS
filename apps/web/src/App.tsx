import { MapView } from './MapView.js';
import { PingStatus } from './PingStatus.js';
import { usePing } from './usePing.js';

export function App({ apiUrl }: { apiUrl: string }) {
  const estado = usePing(apiUrl);

  return (
    <main className="app">
      <MapView />
      <PingStatus estado={estado} />
    </main>
  );
}
