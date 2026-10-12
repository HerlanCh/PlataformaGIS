import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export interface Ping {
  readonly secuencia: number;
  readonly en: string;
}

export interface EstadoDelPing {
  readonly conectado: boolean;
  readonly ultimo: Ping | null;
}

/** Se conecta al servidor de tiempo real y conserva el último `ping` recibido. */
export function usePing(urlApi: string): EstadoDelPing {
  const [estado, setEstado] = useState<EstadoDelPing>({ conectado: false, ultimo: null });

  useEffect(() => {
    const socket = io(urlApi);
    socket.on('connect', () => setEstado((previo) => ({ ...previo, conectado: true })));
    socket.on('disconnect', () => setEstado((previo) => ({ ...previo, conectado: false })));
    socket.on('ping', (ping: Ping) => setEstado({ conectado: true, ultimo: ping }));

    return () => {
      socket.close();
    };
  }, [urlApi]);

  return estado;
}
