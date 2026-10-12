import type { EstadoDelPing } from './usePing.js';

const hora = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es-BO', { timeZone: 'America/La_Paz' });

export function EstadoDePing({ estado }: { estado: EstadoDelPing }) {
  const { conectado, ultimo } = estado;

  return (
    <aside className="ping" role="status" data-conectado={conectado}>
      <strong>{conectado ? 'Conectado' : 'Sin conexión'}</strong>
      <span>
        {ultimo
          ? `Ping n.º ${ultimo.secuencia} a las ${hora(ultimo.en)}`
          : 'Esperando el primer ping…'}
      </span>
    </aside>
  );
}
