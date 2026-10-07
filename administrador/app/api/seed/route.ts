import { NextResponse } from 'next/server';
import { seedDatabase } from '@/server/db/seed';

export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'El endpoint de seed solo está disponible en entorno de desarrollo' },
      { status: 403 }
    );
  }

  try {
    await seedDatabase();
    return NextResponse.json({
      status: 'ok',
      message: 'Base de datos inicializada con datos de prueba (Admin, Conductor y Camiones)',
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al ejecutar seed';
    return NextResponse.json(
      { error: 'Fallo al inicializar base de datos', message },
      { status: 500 }
    );
  }
}
