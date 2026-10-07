import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface ILocationPing extends Document {
  pingId: string; // ID único del ping generado por el cliente (UUID) para idempotencia
  tripId: Types.ObjectId;
  truckId: Types.ObjectId;
  coords: IPoint;
  velocidad: number | null; // null si no se pudo calcular (ej. primer ping), 0 si está detenido
  timestamp: Date;
  receivedAt: Date;
}

const PointSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitud, latitud]
      required: true,
      validate: {
        validator: function (val: number[]) {
          return (
            Array.isArray(val) &&
            val.length === 2 &&
            val[0] >= -180 &&
            val[0] <= 180 &&
            val[1] >= -90 &&
            val[1] <= 90
          );
        },
        message: 'Coordenadas inválidas. Deben ser [longitud (-180 a 180), latitud (-90 a 90)]',
      },
    },
  },
  { _id: false }
);

const LocationPingSchema = new Schema<ILocationPing>(
  {
    pingId: {
      type: String,
      required: [true, 'El pingId es requerido para garantizar idempotencia'],
      trim: true,
      maxlength: 100,
    },
    tripId: {
      type: Schema.Types.ObjectId,
      ref: 'Trip',
      required: [true, 'El ID del viaje es requerido'],
    },
    truckId: {
      type: Schema.Types.ObjectId,
      ref: 'Truck',
      required: [true, 'El ID del camión es requerido'],
    },
    coords: {
      type: PointSchema,
      required: true,
    },
    velocidad: {
      type: Number,
      default: null,
      min: [0, 'La velocidad no puede ser negativa'],
    },
    timestamp: {
      type: Date,
      required: [true, 'El timestamp de captura es requerido'],
    },
    receivedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    // Sin timestamps de Mongoose porque usamos timestamp (captura móvil) y receivedAt (llegada al server)
    timestamps: false,
    collection: 'locationPings',
  }
);

// Idempotencia: no duplicar pings si el móvil reintenta el envío del mismo pingId
LocationPingSchema.index(
  { tripId: 1, pingId: 1 },
  { name: 'uq_ping_por_viaje', unique: true }
);

// Índices para consultas por fecha y camión
LocationPingSchema.index(
  { tripId: 1, timestamp: -1, _id: -1 },
  { name: 'ix_pings_viaje_fecha' }
);
LocationPingSchema.index(
  { truckId: 1, timestamp: -1, _id: -1 },
  { name: 'ix_pings_camion_fecha' }
);

// Índice geoespacial 2dsphere para consultas de ubicación (RNF02)
LocationPingSchema.index(
  { coords: '2dsphere' },
  { name: 'ix_pings_coords' }
);

export const LocationPing: Model<ILocationPing> =
  mongoose.models.LocationPing || mongoose.model<ILocationPing>('LocationPing', LocationPingSchema);
