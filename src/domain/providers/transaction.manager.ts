/**
 * Puerto para ejecutar varias operaciones de repositorio dentro de una única
 * transacción atómica. El handle `tx` es opaco para el dominio (`unknown`): cada
 * repositorio de infraestructura lo castea a su cliente concreto. Los métodos de
 * repositorio que aceptan `tx?: unknown` lo usan si viene, o caen al cliente por
 * defecto si no.
 */
export interface TransactionManager {
  run<T>(work: (tx: unknown) => Promise<T>): Promise<T>;
}

export const TRANSACTION_MANAGER = Symbol('TransactionManager');
