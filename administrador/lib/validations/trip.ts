import { z } from 'zod';

export const StartTripSchema = z.object({
  qrCode: z.string().trim().min(1, 'El código QR es requerido'),
});

export const PingSchema = z.object({
  pingId: z.string().trim().min(1, 'El pingId es requerido para idempotencia'),
  coords: z
    .array(z.number())
    .length(2, 'coords debe contener [longitud, latitud]')
    .refine(([lng, lat]) => lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90, {
      message: 'Coordenadas fuera de rango: longitud [-180, 180], latitud [-90, 90]',
    }),
  timestamp: z.string().datetime({ message: 'El timestamp debe ser formato ISO 8601 UTC' }),
});

export const EndTripSchema = z.object({
  qrCode: z.string().trim().min(1, 'El código QR es requerido para cerrar el viaje'),
});

export type StartTripInput = z.infer<typeof StartTripSchema>;
export type PingInput = z.infer<typeof PingSchema>;
export type EndTripInput = z.infer<typeof EndTripSchema>;
