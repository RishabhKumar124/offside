import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all upcoming games
    const games = await base44.asServiceRole.entities.Game.filter({ status: 'upcoming' });

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const windowStart = new Date(twoHoursFromNow.getTime() - 5 * 60 * 1000); // 5 min window
    const windowEnd = new Date(twoHoursFromNow.getTime() + 5 * 60 * 1000);

    let notificationsSent = 0;

    for (const game of games) {
      const gameTime = new Date(game.date);
      if (gameTime >= windowStart && gameTime <= windowEnd) {
        // Get all confirmed RSVPs for this game
        const rsvps = await base44.asServiceRole.entities.RSVP.filter({
          game_id: game.id,
          status: 'going',
        });

        for (const rsvp of rsvps) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: rsvp.user_id,
            type: 'game_update',
            title: '⏰ Game in 2 hours!',
            message: `Don't forget — "${game.title}" kicks off in 2 hours at ${game.location_name}. See you on the pitch! 🏃`,
            game_id: game.id,
            read: false,
          });
          notificationsSent++;
        }
      }
    }

    return Response.json({ success: true, notificationsSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});