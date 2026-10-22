import 'server-only';
import { randomUUID } from 'node:crypto';
import { getDb, getMongoClient } from '@/server/db/mongo';
import { validControlSpeed, type ControlAuthor, type SpeedControl } from '@/lib/speed-control';

type ControlRecord = Omit<SpeedControl, 'fechaModificacion'> & {
  _id: string;
  tipo: 'actual' | 'cambio';
  fechaModificacion: Date;
};
const COLLECTION = 'speedControls';
const CURRENT_ID = 'actual';

function serialize(record: ControlRecord): SpeedControl {
  return {
    velocidadPromedio: record.velocidadPromedio,
    fechaModificacion: record.fechaModificacion.toISOString(),
    modificadoPor: record.modificadoPor,
    velocidadAnterior: record.velocidadAnterior,
    autorAnterior: record.autorAnterior,
  };
}

export async function getSpeedControl(): Promise<SpeedControl | null> {
  const record = await (await getDb()).collection<ControlRecord>(COLLECTION).findOne({ _id: CURRENT_ID });
  return record ? serialize(record) : null;
}

export async function saveSpeedControl(input: Record<string, unknown> | null, author: ControlAuthor) {
  if (!validControlSpeed(input?.velocidadPromedio)) {
    return { ok: false as const, status: 400, message: 'Ingresa una velocidad mayor que 0 y hasta 300 km/h, con un decimal como máximo.' };
  }
  const velocidadPromedio = input.velocidadPromedio;
  const collection = (await getDb()).collection<ControlRecord>(COLLECTION);
  const session = (await getMongoClient()).startSession();
  try {
    const saved = await session.withTransaction(async () => {
      const previous = await collection.findOne({ _id: CURRENT_ID }, { session });
      const record: ControlRecord = {
        _id: CURRENT_ID, tipo: 'actual', velocidadPromedio,
        fechaModificacion: new Date(), modificadoPor: author,
        velocidadAnterior: previous?.velocidadPromedio ?? null,
        autorAnterior: previous?.modificadoPor ?? null,
      };
      // The shared current document serializes concurrent edits; each committed edit also has an immutable audit record.
      await collection.replaceOne({ _id: CURRENT_ID }, record, { upsert: true, session });
      await collection.insertOne({ ...record, _id: randomUUID(), tipo: 'cambio' }, { session });
      return serialize(record);
    });
    return { ok: true as const, status: 200, body: saved };
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      return { ok: false as const, status: 409, message: 'Otro administrador acaba de guardar la configuración. Recarga la página antes de modificarla.' };
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
