import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export interface Ping {
  readonly seq: number;
  readonly at: string;
}

export interface EstadoPing {
  readonly conectado: boolean;
  readonly ultimo: Ping | null;
}

/** Se conecta al servidor de tiempo real y conserva el último `ping` recibido. */
export function usePing(apiUrl: string): EstadoPing {
  const [estado, setEstado] = useState<EstadoPing>({ conectado: false, ultimo: null });

  useEffect(() => {
    const socket = io(apiUrl);
    socket.on('connect', () => setEstado((previo) => ({ ...previo, conectado: true })));
    socket.on('disconnect', () => setEstado((previo) => ({ ...previo, conectado: false })));
    socket.on('ping', (ping: Ping) => setEstado({ conectado: true, ultimo: ping }));

    return () => {
      socket.close();
    };
  }, [apiUrl]);

  return estado;
}
