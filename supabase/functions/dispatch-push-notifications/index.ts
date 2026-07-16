import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_ATTEMPTS = 5;
const DEFAULT_BATCH_SIZE = 50;

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const base64UrlEncode = (input: string | ArrayBuffer) => {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input);

  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem: string) => {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const getFirebaseAccessToken = async () => {
  const clientEmail = requiredEnv('FIREBASE_CLIENT_EMAIL');
  const privateKeyBase64 = Deno.env.get('FIREBASE_PRIVATE_KEY_BASE64');
  const privateKey = privateKeyBase64
    ? atob(privateKeyBase64)
    : requiredEnv('FIREBASE_PRIVATE_KEY');

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const unsignedJwt = [
    base64UrlEncode(JSON.stringify(header)),
    base64UrlEncode(JSON.stringify(payload)),
  ].join('.');

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt),
  );

  const assertion = `${unsignedJwt}.${base64UrlEncode(signature)}`;
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    throw new Error(`Firebase auth failed: ${json.error_description || json.error || response.statusText}`);
  }

  return json.access_token as string;
};

const notificationPath = (notification: Record<string, unknown>) => {
  const gameId = notification.game_id;
  return typeof gameId === 'string' && gameId ? `/game/${gameId}` : '/notifications';
};

const isInvalidTokenError = (errorBody: Record<string, unknown>) => {
  const error = errorBody.error as Record<string, unknown> | undefined;
  const status = error?.status;
  const details = Array.isArray(error?.details) ? error.details : [];
  return status === 'NOT_FOUND' ||
    details.some((detail) => {
      const typed = detail as Record<string, unknown>;
      return typed.errorCode === 'UNREGISTERED' || typed.errorCode === 'INVALID_ARGUMENT';
    });
};

const sendFcmMessage = async ({
  accessToken,
  projectId,
  token,
  notification,
}: {
  accessToken: string;
  projectId: string;
  token: string;
  notification: Record<string, unknown>;
}) => {
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
  const title = String(notification.title || 'Offside');
  const body = String(notification.message || '');
  const type = String(notification.type || 'game_update');
  const gameId = notification.game_id ? String(notification.game_id) : '';
  const notificationId = String(notification.id || '');
  const route = notificationPath(notification);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token,
        notification: {
          title,
          body,
        },
        data: {
          notification_id: notificationId,
          type,
          game_id: gameId,
          url: route,
        },
        android: {
          priority: 'HIGH',
          notification: {
            channel_id: 'offside_alerts',
            sound: 'default',
          },
        },
      },
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json.error?.message || response.statusText;
    throw Object.assign(new Error(message), {
      invalidToken: isInvalidTokenError(json),
      response: json,
    });
  }

  return json;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const firebaseProjectId = requiredEnv('FIREBASE_PROJECT_ID');
    const batchSize = Math.min(
      Number(new URL(req.url).searchParams.get('limit') || DEFAULT_BATCH_SIZE),
      200,
    );

    const db = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const nowIso = new Date().toISOString();
    const { data: jobs, error: jobError } = await db
      .from('push_delivery_queue')
      .select(`
        id,
        notification_id,
        user_id,
        attempts,
        notification:notifications!inner(id, title, message, type, game_id)
      `)
      .in('status', ['pending', 'failed'])
      .lte('next_attempt_at', nowIso)
      .lt('attempts', MAX_ATTEMPTS)
      .order('created_date', { ascending: true })
      .limit(batchSize);

    if (jobError) throw jobError;

    if (!jobs?.length) {
      return Response.json(
        { success: true, checked: 0, sent: 0, skipped: 0, failed: 0 },
        { headers: corsHeaders },
      );
    }

    const accessToken = await getFirebaseAccessToken();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of jobs) {
      const { data: tokens, error: tokenError } = await db
        .from('push_tokens')
        .select('id, token, platform')
        .eq('user_id', job.user_id)
        .eq('active', true)
        .eq('platform', 'android');

      if (tokenError) throw tokenError;

      if (!tokens?.length) {
        await db
          .from('push_delivery_queue')
          .update({
            status: 'skipped',
            last_error: 'No active Android push token for user',
            sent_at: null,
          })
          .eq('id', job.id);
        skipped += 1;
        continue;
      }

      let tokenSuccesses = 0;
      const tokenErrors: string[] = [];

      for (const pushToken of tokens) {
        try {
          await sendFcmMessage({
            accessToken,
            projectId: firebaseProjectId,
            token: pushToken.token,
            notification: job.notification,
          });
          tokenSuccesses += 1;
        } catch (error) {
          const typedError = error as Error & { invalidToken?: boolean };
          tokenErrors.push(typedError.message);
          if (typedError.invalidToken) {
            await db
              .from('push_tokens')
              .update({ active: false })
              .eq('id', pushToken.id);
          }
        }
      }

      if (tokenSuccesses > 0) {
        await db
          .from('push_delivery_queue')
          .update({
            status: 'sent',
            attempts: job.attempts + 1,
            sent_at: new Date().toISOString(),
            last_error: tokenErrors.length ? tokenErrors.join('; ').slice(0, 500) : null,
          })
          .eq('id', job.id);
        sent += 1;
        continue;
      }

      const attempts = job.attempts + 1;
      const retryDelayMinutes = Math.min(30, attempts * 2);
      const shouldFailPermanently = attempts >= MAX_ATTEMPTS;
      await db
        .from('push_delivery_queue')
        .update({
          status: shouldFailPermanently ? 'failed' : 'pending',
          attempts,
          last_error: tokenErrors.join('; ').slice(0, 500) || 'Unknown FCM error',
          next_attempt_at: new Date(Date.now() + retryDelayMinutes * 60 * 1000).toISOString(),
        })
        .eq('id', job.id);
      failed += 1;
    }

    return Response.json(
      { success: true, checked: jobs.length, sent, skipped, failed },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders },
    );
  }
});
