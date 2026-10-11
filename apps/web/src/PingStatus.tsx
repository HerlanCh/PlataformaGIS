import type { EstadoPing } from './usePing.js';

const hora = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz' });

export function PingStatus({ estado }: { estado: EstadoPing }) {
  const { conectado, ultimo } = estado;

  return (
    <aside className="ping" role="status" data-conectado={conectado}>
      <strong>{conectado ? 'Conectado' : 'Sin conexión'}</strong>
      <span>
        {ultimo ? `Ping n.º ${ultimo.seq} a las ${hora(ultimo.at)}` : 'Esperando el primer ping…'}
      </span>
    </aside>
  );
}
