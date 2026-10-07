import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type TripState = 'activo' | 'finalizado';

export interface ILineString {
  type: 'LineString';
  coordinates: [number, number][]; // [longitude, latitude][]
}

export interface ITrip extends Document {
  truckId: Types.ObjectId;
  driverId: Types.ObjectId;
  rutaPlaneada: ILineString | null;
  estado: TripState;
  inicio: Date;
  fin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const LineStringSchema = new Schema(
  {
    type: {
      type: String,
      enum: ['LineString'],
      required: true,
      default: 'LineString',
    },
    coordinates: {
      type: [[Number]],
      required: true,
    },
  },
  { _id: false }
);

const TripSchema = new Schema<ITrip>(
  {
    truckId: {
      type: Schema.Types.ObjectId,
      ref: 'Truck',
      required: [true, 'El ID del camión es requerido'],
    },
    driverId: {
      type: Schema.Types.ObjectId,
      ref: 'Driver',
      required: [true, 'El ID del conductor es requerido'],
    },
    rutaPlaneada: {
      type: LineStringSchema,
      default: null,
    },
    estado: {
      type: String,
      enum: ['activo', 'finalizado'],
      default: 'activo',
      required: true,
    },
    inicio: {
      type: Date,
      default: Date.now,
      required: true,
    },
    fin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: 'trips',
  }
);

// Garantía de base de datos: solo un trip activo por camión a la vez (RF04)
TripSchema.index(
  { truckId: 1 },
  {
    name: 'uq_trip_activo_por_camion',
    unique: true,
    partialFilterExpression: { estado: 'activo' },
  }
);

// Índices para consultas e historial eficiente (RF14)
TripSchema.index({ truckId: 1, inicio: -1, _id: -1 }, { name: 'ix_trips_camion_fecha' });
TripSchema.index({ driverId: 1, inicio: -1, _id: -1 }, { name: 'ix_trips_conductor_fecha' });
TripSchema.index({ inicio: -1, _id: -1 }, { name: 'ix_trips_fecha' });

export const Trip: Model<ITrip> =
  mongoose.models.Trip || mongoose.model<ITrip>('Trip', TripSchema);
