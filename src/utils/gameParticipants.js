export const uniqueByUserId = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = item?.user_id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const hostParticipantFromGame = (game) => {
  if (!game?.host_id) return null;

  return {
    id: `host-${game.host_id}`,
    game_id: game.id,
    user_id: game.host_id,
    user_name: game.host_name || 'Host',
    user_photo: game.host_photo || '',
    status: 'going',
    is_host: true,
  };
};

export const participantsWithHost = (game, rsvps = []) => {
  const host = hostParticipantFromGame(game);
  return uniqueByUserId([
    ...(host ? [host] : []),
    ...rsvps,
  ]);
};

export const goingParticipantsWithHost = (game, rsvps = []) => (
  participantsWithHost(game, rsvps).filter((rsvp) => rsvp.status === 'going')
);
