// Public values only (the Supabase anon key is designed to ship in the client; RLS protects the data).
// Leave empty to run in local-only mode.
export default {
  supabaseUrl: '',
  supabaseAnonKey: '',
  pushUrl: '',        // Cloudflare Worker URL, e.g. https://liftlog-push.<you>.workers.dev
  vapidPublicKey: 'BC6YxRoXiYWB5UYDgkP4KwyZBHCzayJqj_IoZYn7hOh6m5qjWQOhZcIzglCt2MAF5EmOMsvAdf3RYGpiQtOHBL4', // base64url, must match the Worker's VAPID private key
};
