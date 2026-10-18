// Cliente del protocolo de tiempo real de la API (Fase 7): conexión con el JWT, la ventana del mapa
// como salas de celdas y los eventos públicos. Si una reconexión no recupera lo perdido, avisa para
// que la app vuelva a pedir los reportes de la ventana.
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { EventoPublico } from '../domain/reportes.js';

export type EstadoDeConexion = 'conectando' | 'en-vivo' | 'sin-conexion';

export interface OyentesTiempoReal {
  readonly alEvento: (evento: EventoPublico) => void;
  readonly alEstado: (estado: EstadoDeConexion) => void;
  /** Se reconectó sin recuperar los eventos perdidos: hay que volver a cargar la ventana. */
  readonly alPerderEventos: () => void;
}

export type ObtenerToken = (opciones?: { forzar?: boolean }) => Promise<string>;

export class ConexionTiempoReal {
  private readonly socket: Socket;
  private bbox: string | null = null;
  private forzarToken = false;
  private primeraConexion = true;

  constructor(urlApi: string, obtenerToken: ObtenerToken, oyentes: OyentesTiempoReal) {
    this.socket = io(urlApi, {
      transports: ['websocket'],
      autoConnect: false,
      // Se evalúa en cada intento: un token vencido se renueva antes de reconectar.
      auth: (responder) => {
        const forzar = this.forzarToken;
        this.forzarToken = false;
        obtenerToken({ forzar }).then(
          (token) => responder({ token }),
          () => responder({}),
        );
      },
    });

    this.socket.on('connect', () => {
      oyentes.alEstado('en-vivo');
      if (this.bbox) void this.enviarVentana();
      if (!this.primeraConexion && !this.socket.recovered) oyentes.alPerderEventos();
      this.primeraConexion = false;
    });
    this.socket.on('disconnect', () => oyentes.alEstado('sin-conexion'));
    this.socket.on('connect_error', (error: Error) => {
      if (error.message.startsWith('TOKEN_')) this.forzarToken = true;
      oyentes.alEstado('sin-conexion');
    });
    this.socket.on('evento', (evento: EventoPublico) => oyentes.alEvento(evento));
  }

  conectar(): void {
    this.socket.connect();
  }

  /** Cambia las celdas que se escuchan. Se recuerda para reenviarla al reconectar. */
  actualizarVentana(bbox: string): void {
    this.bbox = bbox;
    if (this.socket.connected) void this.enviarVentana();
  }

  cerrar(): void {
    this.socket.close();
  }

  private async enviarVentana(): Promise<void> {
    await this.socket
      .timeout(5000)
      .emitWithAck('viewport:actualizar', { bbox: this.bbox })
      .catch(() => undefined);
  }
}
