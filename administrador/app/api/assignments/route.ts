import { handleAdminRequest } from '@/server/auth/admin';
import { createAssignment, listAssignments } from '@/server/assignments/service';
import { readJsonObject } from '@/server/http';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get('page') ?? '1';
  return handleAdminRequest(request, async () => {
    const page = /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : null;
    if (page === null) return { ok: false, status: 400, message: 'Página inválida.' };
    return { ok: true, status: 200, body: await listAssignments(page) };
  });
}

export async function POST(request: Request) {
  return handleAdminRequest(request, async admin => createAssignment(admin, await readJsonObject(request)));
}
