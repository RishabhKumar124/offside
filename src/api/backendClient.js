import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const profilePhotoBucket = import.meta.env.VITE_PROFILE_PHOTO_BUCKET || 'profile-photos';

export const nativeAuthRedirectUrl = 'com.rishabhkumar.offside://auth/callback';

const isNativeApp = () => Capacitor.isNativePlatform();

export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: !isNativeApp(),
        flowType: 'pkce',
      },
    })
  : null;

const requireSupabase = () => {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
};

const tableByEntity = {
  User: 'users',
  Game: 'games',
  RSVP: 'rsvps',
  Notification: 'notifications',
  MOTMVote: 'motm_votes',
  StatSubmission: 'stat_submissions',
  Comment: 'comments',
  AppSettings: 'app_settings',
};

const authError = (message = 'Authentication required') => {
  const error = new Error(message);
  error.status = 401;
  return error;
};

const defaultFullName = (authUser) => (
  authUser.user_metadata?.full_name ||
  authUser.user_metadata?.name ||
  authUser.email?.split('@')[0] ||
  'Player'
);

const normalizeUser = (authUser, profile = {}) => ({
  id: authUser.id,
  email: authUser.email,
  full_name: defaultFullName(authUser),
  ...profile,
});

const getProfile = async (authUser) => {
  const client = requireSupabase();
  try {
    const { data: profile, error } = await client
      .from('users')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) throw error;
    if (profile) return normalizeUser(authUser, profile);

    const profileDefaults = {
      id: authUser.id,
      email: authUser.email,
      full_name: defaultFullName(authUser),
      profile_photo: authUser.user_metadata?.avatar_url || '',
    };

    const { data: created, error: insertError } = await client
      .from('users')
      .upsert(profileDefaults, { onConflict: 'id' })
      .select('*')
      .single();

    if (insertError) throw insertError;
    return normalizeUser(authUser, created);
  } catch (error) {
    console.warn('Using auth user without persisted profile:', error);
    return normalizeUser(authUser);
  }
};

const currentUser = async () => {
  const client = requireSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw authError(error?.message);
  return getProfile(data.user);
};

const paramsFromUrl = (url) => {
  const parsed = new URL(url);
  const queryParams = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  return { queryParams, hashParams };
};

export const handleAuthCallbackUrl = async (url) => {
  if (!url?.startsWith(nativeAuthRedirectUrl)) return null;

  const { queryParams, hashParams } = paramsFromUrl(url);
  const errorCode = queryParams.get('error') || hashParams.get('error');
  const errorDescription = queryParams.get('error_description') || hashParams.get('error_description');

  if (errorCode) {
    throw new Error(errorDescription || errorCode);
  }

  const code = queryParams.get('code');
  if (code) {
    const { error } = await requireSupabase().auth.exchangeCodeForSession(code);
    if (error) throw error;
    return currentUser();
  }

  const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');

  if (accessToken && refreshToken) {
    const { error } = await requireSupabase().auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
    return currentUser();
  }

  return null;
};

const applySort = (query, sort) => {
  if (!sort) return query.order('created_date', { ascending: false });
  const ascending = !sort.startsWith('-');
  const column = ascending ? sort : sort.slice(1);
  return query.order(column, { ascending });
};

const applyFilters = (query, filters = {}) => {
  return Object.entries(filters).reduce((current, [key, value]) => {
    if (value === undefined) return current;
    if (value === null) return current.is(key, null);
    return current.eq(key, value);
  }, query);
};

const readList = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

const readSingle = async (query) => {
  const { data, error } = await query;
  if (error) throw error;
  return data;
};

const createEntityApi = (entityName) => {
  const table = tableByEntity[entityName];
  if (!table) throw new Error(`Unknown entity: ${entityName}`);

  return {
    async list(sort, limit = 100) {
      let query = requireSupabase().from(table).select('*');
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      return readList(query);
    },

    async filter(filters = {}, sort, limit = 100) {
      let query = requireSupabase().from(table).select('*');
      query = applyFilters(query, filters);
      query = applySort(query, sort);
      if (limit) query = query.limit(limit);
      return readList(query);
    },

    async create(values) {
      return readSingle(
        requireSupabase()
          .from(table)
          .insert(values)
          .select('*')
          .single()
      );
    },

    async update(id, values) {
      return readSingle(
        requireSupabase()
          .from(table)
          .update(values)
          .eq('id', id)
          .select('*')
          .single()
      );
    },

    async delete(id) {
      const { error } = await requireSupabase()
        .from(table)
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },
  };
};

const uploadFile = async ({ file }) => {
  const user = await currentUser();
  const cleanedName = file.name.replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const filePath = `${user.id}/${Date.now()}-${cleanedName}`;
  const client = requireSupabase();

  const { error } = await client.storage
    .from(profilePhotoBucket)
    .upload(filePath, file, { cacheControl: '31536000', upsert: true });

  if (error) throw error;

  const { data } = client.storage.from(profilePhotoBucket).getPublicUrl(filePath);
  return { file_url: data.publicUrl };
};

export const appClient = {
  game: {
    async create(values) {
      const { data, error } = await requireSupabase().rpc('create_game', {
        p_title: values.title,
        p_date: values.date,
        p_location_name: values.location_name || 'TBD',
        p_location_lat: values.location_lat ?? null,
        p_location_lng: values.location_lng ?? null,
        p_max_players: values.max_players,
        p_rules: values.rules || '',
        p_host_name: values.host_name || '',
        p_host_photo: values.host_photo || '',
      });
      if (error) throw error;
      return data;
    },
  },

  auth: {
    me: currentUser,

    async loginViaEmailPassword(email, password) {
      const { error } = await requireSupabase().auth.signInWithPassword({ email, password });
      if (error) throw error;
      return currentUser();
    },

    async register({ email, password }) {
      const { data, error } = await requireSupabase().auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      return data;
    },

    async verifyOtp({ email, otpCode }) {
      const { data, error } = await requireSupabase().auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });
      if (error) throw error;
      if (data.user) await getProfile(data.user);
      return { access_token: data.session?.access_token };
    },

    async resendOtp(email) {
      const { error } = await requireSupabase().auth.resend({ type: 'signup', email });
      if (error) throw error;
    },

    setToken() {
      return true;
    },

    async loginWithProvider(provider, redirectTo = '/') {
      const native = isNativeApp();
      const target = native ? nativeAuthRedirectUrl : new URL(redirectTo, window.location.origin).toString();
      const { data, error } = await requireSupabase().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: target,
          skipBrowserRedirect: native,
        },
      });
      if (error) throw error;

      if (native && data?.url) {
        await Browser.open({ url: data.url });
      }
    },

    async resetPasswordRequest(email) {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    },

    async resetPassword({ newPassword }) {
      const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
      if (error) throw error;
    },

    async updateMe(values) {
      const user = await currentUser();
      return readSingle(
        requireSupabase()
          .from('users')
          .upsert({ id: user.id, ...values }, { onConflict: 'id' })
          .select('*')
          .single()
      );
    },

    async logout(redirectTo = '/login') {
      await requireSupabase().auth.signOut();
      if (redirectTo !== false && typeof window !== 'undefined') {
        window.location.href = typeof redirectTo === 'string' ? redirectTo : '/login';
      }
    },

    redirectToLogin() {
      window.location.href = '/login';
    },
  },

  integrations: {
    Core: {
      UploadFile: uploadFile,
    },
  },

  entities: Object.fromEntries(
    Object.keys(tableByEntity).map((entityName) => [entityName, createEntityApi(entityName)])
  ),
};
