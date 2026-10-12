import { VistaMapa } from './MapView.js';
import { EstadoDePing } from './PingStatus.js';
import { usePing } from './usePing.js';

export function App({ urlApi }: { urlApi: string }) {
  const estado = usePing(urlApi);

  return (
    <main className="app">
      <VistaMapa />
      <EstadoDePing estado={estado} />
    </main>
  );
}
