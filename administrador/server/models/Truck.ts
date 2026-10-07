import mongoose, { Document, Model, Schema } from 'mongoose';

export interface ITruck extends Document {
  placa: string;
  qrCode: string;
  modelo: string;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TruckSchema = new Schema<ITruck>(
  {
    placa: {
      type: String,
      required: [true, 'La placa del camión es requerida'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 20,
      match: [/^[A-Z0-9-]+$/, 'Formato de placa no válido (solo mayúsculas, números y guiones)'],
    },
    qrCode: {
      type: String,
      required: [true, 'El código QR es requerido'],
      unique: true,
      trim: true,
      maxlength: 200,
    },
    modelo: {
      type: String,
      required: [true, 'El modelo del camión es requerido'],
      trim: true,
      maxlength: 100,
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'trucks',
  }
);

// Índices requeridos por el rol DBA
TruckSchema.index({ placa: 1 }, { name: 'uq_trucks_placa', unique: true });
TruckSchema.index({ qrCode: 1 }, { name: 'uq_trucks_qr', unique: true });

export const Truck: Model<ITruck> =
  mongoose.models.Truck || mongoose.model<ITruck>('Truck', TruckSchema);
