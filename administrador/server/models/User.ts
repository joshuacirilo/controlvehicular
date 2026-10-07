import mongoose, { Document, Model, Schema } from 'mongoose';

export type UserRole = 'administrador' | 'conductor';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  rol: UserRole;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, 'El correo electrónico es requerido'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Formato de correo electrónico no válido'],
    },
    passwordHash: {
      type: String,
      required: [true, 'El hash de la contraseña es requerido'],
      minlength: 20,
      maxlength: 512,
    },
    rol: {
      type: String,
      enum: ['administrador', 'conductor'],
      required: [true, 'El rol es requerido'],
    },
    activo: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

// Índice único con case-insensitivity (colación en-US)
UserSchema.index(
  { email: 1 },
  {
    name: 'uq_users_email',
    unique: true,
    collation: { locale: 'en', strength: 2 },
  }
);

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
