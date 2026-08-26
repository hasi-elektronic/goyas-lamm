import { clean, esc } from '../_lib/core.js';
import { layout, table } from '../_lib/ui.js';
import { notesFor } from '../_lib/gaeste.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const q = clean(url.searchParams.get('q') || '', 60);

  let result = '';
  if (q.length >= 2 && env.DB) {
    /* Der Backslash muss zuerst verdoppelt werden, sonst entwertet er das folgende Zeichen. */
    const like = `%${q.replace(/[\\%_]/g, m => '\\' + m)}%`;
    const rows = (await env.DB.prepare(
      `SELECT id,res_date,res_time,guests,name,email,phone,note,status,source,no_show
         FROM reservations
        WHERE name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\'
        ORDER BY res_date DESC, res_time DESC LIMIT 100`
    ).bind(like, like, like).all()).results || [];
    const notes = await notesFor(env.DB, rows.map(r => r.phone));
    result = `<div class="card">
      <h2>Treffer <em>${rows.length}${rows.length === 100 ? '+ (gekürzt)' : ''}</em></h2>
      ${table(rows, { showDate: true, notes, user: data?.user })}</div>`;
  } else if (q) {
    result = '<div class="msg warn">Bitte mindestens zwei Zeichen eingeben.</div>';
  }

  const body = `
    <h1>Suche</h1>
    <p class="sub">Name, Telefonnummer oder E-Mail — auch vergangene Termine.</p>
    <div class="card"><div class="body">
      <form method="get" action="/admin/suche" class="row">
        <div class="f" style="flex:1;min-width:200px">
          <label for="q">Suchbegriff</label>
          <input id="q" name="q" value="${esc(q)}" autofocus placeholder="Weber, 07042…, name@…">
        </div>
        <div style="display:flex;align-items:flex-end"><button class="btn" type="submit">Suchen</button></div>
      </form>
    </div></div>
    ${result}`;

  return layout({ user: data?.user, title: 'Suche', active: '/admin/suche', body });
}
