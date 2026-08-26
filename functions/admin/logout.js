import { clearSession } from '../_lib/auth.js';

export const onRequest = () => new Response(null, {
  status: 303,
  headers: { location: '/admin/login', 'set-cookie': clearSession(), 'cache-control': 'no-store' },
});
