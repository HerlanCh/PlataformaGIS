/**
 * Aviso, dentro del proceso, de que se guardaron eventos en el outbox. Despierta al
 * `DespachadorDeSalida` para que los entregue enseguida sin consultar la base sin parar: así Neon
 * puede suspender su cómputo cuando no hay actividad (RSK-02).
 *
 * El aviso puede llegar antes del COMMIT de la transacción que guardó los eventos; el despachador
 * lo cubre repitiendo la pasada durante una breve ventana.
 */
type Oyente = () => void;

const oyentes = new Set<Oyente>();

/** Registra un oyente y devuelve la función que lo quita. */
export function escucharSalida(oyente: Oyente): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Avisa a los oyentes de que hay eventos nuevos en el outbox. */
export function avisarSalida(): void {
  for (const oyente of oyentes) oyente();
}
