import { handleAdminRequest } from '@/server/auth/admin';
import { readJsonObject } from '@/server/http';
import { registerAccount } from '@/server/accounts/register';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return handleAdminRequest(request, async () => registerAccount(await readJsonObject(request)));
}
