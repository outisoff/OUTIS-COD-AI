SELECT cron.unschedule('zr-express-sync-statuses-cron');
SELECT cron.schedule(
  'zr-express-sync-statuses-cron',
  '*/5 * * * *',
  $$SELECT net.http_post(
    url := 'https://ggrnsnbxdslhlvanymgo.supabase.co/functions/v1/zr-express-sync-statuses',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdncm5zbmJ4ZHNsaGx2YW55bWdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NDI0ODEsImV4cCI6MjA4NzAxODQ4MX0.lhG7bhcR5ok7ZnlBxOrJNDNtYg9NydXggFTl6ldUFKk"}'::jsonb,
    body := '{}'::jsonb
  );$$
);