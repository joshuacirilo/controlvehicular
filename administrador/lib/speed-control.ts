export type ControlAuthor = { id: string; username: string; nombre: string };
export type SpeedControl = {
  velocidadPromedio: number;
  fechaModificacion: string;
  modificadoPor: ControlAuthor;
  velocidadAnterior: number | null;
  autorAnterior: ControlAuthor | null;
};

export function validControlSpeed(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 300 &&
    value === Math.round(value * 10) / 10;
}
