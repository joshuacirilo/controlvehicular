import { connectDB } from './mongodb';
import { User, Driver, Truck } from '../models';
import { hashPassword } from '../auth/password';

export async function seedDatabase() {
  await connectDB();

  console.log('--- Iniciando Seed de datos iniciales en trucks_db ---');

  // 1. Crear o verificar usuario Administrador
  const adminEmail = 'admin@controlvehicular.com';
  let adminUser = await User.findOne({ email: adminEmail });
  if (!adminUser) {
    const adminPasswordHash = await hashPassword('AdminPassword123!');
    adminUser = await User.create({
      email: adminEmail,
      passwordHash: adminPasswordHash,
      rol: 'administrador',
      activo: true,
    });
    console.log('✅ Usuario Administrador creado: admin@controlvehicular.com / AdminPassword123!');
  } else {
    console.log('ℹ️ Usuario Administrador ya existe.');
  }

  // 2. Crear o verificar usuario Conductor y su perfil en Driver
  const driverEmail = 'conductor1@controlvehicular.com';
  let driverUser = await User.findOne({ email: driverEmail });
  if (!driverUser) {
    const driverPasswordHash = await hashPassword('DriverPassword123!');
    driverUser = await User.create({
      email: driverEmail,
      passwordHash: driverPasswordHash,
      rol: 'conductor',
      activo: true,
    });
    console.log('✅ Usuario Conductor creado: conductor1@controlvehicular.com / DriverPassword123!');
  } else {
    console.log('ℹ️ Usuario Conductor ya existe.');
  }

  // Crear perfil del conductor en drivers
  const licencia = 'LIC-GT-987654';
  let driverProfile = await Driver.findOne({ licencia });
  if (!driverProfile) {
    driverProfile = await Driver.create({
      userId: driverUser._id,
      nombre: 'Juan Pérez (Conductor Demo)',
      licencia: licencia,
      telefono: '+502 5555-1234',
      activo: true,
    });
    console.log('✅ Perfil de Conductor creado: Juan Pérez / LIC-GT-987654');
  } else {
    console.log('ℹ️ Perfil de Conductor ya existe.');
  }

  // 3. Crear camiones de prueba con código QR
  const sampleTrucks = [
    {
      placa: 'C-101ABC',
      qrCode: 'TRUCK-QR-001',
      modelo: 'Volvo FH 500 (2023)',
      activo: true,
    },
    {
      placa: 'C-202XYZ',
      qrCode: 'TRUCK-QR-002',
      modelo: 'Freightliner Cascadia (2022)',
      activo: true,
    },
    {
      placa: 'C-303MNO',
      qrCode: 'TRUCK-QR-003',
      modelo: 'Kenworth T680 (2024)',
      activo: true,
    },
  ];

  for (const truckData of sampleTrucks) {
    const exists = await Truck.findOne({ placa: truckData.placa });
    if (!exists) {
      await Truck.create(truckData);
      console.log(`✅ Camión creado: Placa ${truckData.placa} | QR: ${truckData.qrCode}`);
    } else {
      console.log(`ℹ️ Camión ${truckData.placa} ya existe.`);
    }
  }

  console.log('--- Seed finalizado exitosamente ---');
}
