import { NextResponse } from 'next/server';
import { connectDB } from '@/server/db/mongodb';
import mongoose from 'mongoose';

export async function GET() {
  try {
    const start = Date.now();
    await connectDB();
    const durationMs = Date.now() - start;

    const db = mongoose.connection.db;
    const collections = db ? (await db.listCollections().toArray()).map((c) => c.name) : [];

    return NextResponse.json({
      status: 'ok',
      database: {
        connected: mongoose.connection.readyState === 1,
        name: mongoose.connection.name,
        host: mongoose.connection.host,
        pingTimeMs: durationMs,
        collectionsFound: collections,
      },
      timestamp: new Date().toISOString(),
      service: 'Control Vehicular - Next.js FullStack API',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido al conectar';
    return NextResponse.json(
      {
        status: 'error',
        message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
