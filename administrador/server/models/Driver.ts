import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export interface IDriver extends Document {
  userId: Types.ObjectId | null;
  nombre: string;
  licencia: string;
  telefono: string | null;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DriverSchema = new Schema<IDriver>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    nombre: {
      type: String,
      required: [true, 'El nombre del conductor es requerido'],
      trim: true,
      maxlength: 120,
    },
    licencia: {
      type: String,
      required: [true, 'El número de licencia es requerido'],
      unique: true,
      trim: true,
      maxlength: 40,
    },
    telefono: {
      type: String,
      default: null,
      maxlength: 25,
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'drivers',
  }
);

// Índices requeridos por el rol DBA
DriverSchema.index({ licencia: 1 }, { name: 'uq_drivers_licencia', unique: true });
DriverSchema.index(
  { userId: 1 },
  {
    name: 'uq_drivers_user',
    unique: true,
    partialFilterExpression: { userId: { $type: 'objectId' } },
  }
);

export const Driver: Model<IDriver> =
  mongoose.models.Driver || mongoose.model<IDriver>('Driver', DriverSchema);
