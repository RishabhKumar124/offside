import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    }

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const windowStart = new Date(twoHoursFromNow.getTime() - 5 * 60 * 1000);
    const windowEnd = new Date(twoHoursFromNow.getTime() + 5 * 60 * 1000);

    const { data: games, error: gameError } = await db
      .from('games')
      .select('id, title, date, location_name')
      .eq('status', 'upcoming')
      .gte('date', windowStart.toISOString())
      .lte('date', windowEnd.toISOString());

    if (gameError) throw gameError;

    let notificationsSent = 0;

    for (const game of games ?? []) {
      const { data: rsvps, error: rsvpError } = await db
        .from('rsvps')
        .select('user_id')
        .eq('game_id', game.id)
        .eq('status', 'going');

      if (rsvpError) throw rsvpError;
      if (!rsvps?.length) continue;

      const notifications = rsvps.map((rsvp) => ({
        user_id: rsvp.user_id,
        type: 'game_update',
        title: 'Game in 2 hours!',
        message: `Don't forget - "${game.title}" kicks off in 2 hours at ${game.location_name}. See you on the pitch!`,
        game_id: game.id,
        read: false,
        dedupe_key: `game-reminder-2h-${game.id}-${rsvp.user_id}`,
      }));

      const { error: notificationError } = await db
        .from('notifications')
        .upsert(notifications, { onConflict: 'dedupe_key', ignoreDuplicates: true });

      if (notificationError) throw notificationError;
      notificationsSent += notifications.length;
    }

    return Response.json(
      { success: true, gamesChecked: games?.length ?? 0, notificationsSent },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
});
