import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/server/db/mongodb';
import { User, Driver } from '@/server/models';
import { comparePassword } from '@/server/auth/password';
import { signToken } from '@/server/auth/jwt';
import { LoginSchema } from '@/lib/validations/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 1. Validar payload con Zod
    const validationResult = LoginSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Datos inválidos',
          detalles: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = validationResult.data;

    // 2. Conectar a MongoDB Atlas
    await connectDB();

    // 3. Buscar usuario por email (case-insensitive)
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    if (!user.activo) {
      return NextResponse.json(
        { error: 'Cuenta deshabilitada. Contacte al administrador.' },
        { status: 403 }
      );
    }

    // 4. Comparar hash de contraseña
    const passwordMatch = await comparePassword(password, user.passwordHash);
    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      );
    }

    // 5. Si es conductor, buscar su perfil de conductor vinculado
    let driverProfile = null;
    if (user.rol === 'conductor') {
      driverProfile = await Driver.findOne({ userId: user._id });
    }

    // 6. Generar JWT
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      rol: user.rol,
      driverId: driverProfile?._id?.toString(),
    });

    // 7. Preparar respuesta y cookie de sesión (para panel web)
    const response = NextResponse.json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        rol: user.rol,
        nombre: driverProfile?.nombre || 'Administrador',
        driverId: driverProfile?._id?.toString(),
      },
    });

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json(
      { error: 'Error durante el inicio de sesión', message },
      { status: 500 }
    );
  }
}
