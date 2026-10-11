-- Lock-screen privacy for reminder content.
--
-- Leakify's reminders are generated on-device, but the text they carry can
-- name a service and show an amount — visible to anyone holding the phone.
-- This column records the user's choice so it survives a reinstall/other
-- devices. The default is the conservative one ('generic'): preview text that
-- says "a renewal is coming up" without naming the service or the amount.
--
-- Read the mode, not the reminder content, from the server: the app composes
-- notification text locally (see features/notifications/engine.ts).

alter table public.notification_preferences
  add column if not exists preview_mode text not null default 'generic'
    check (preview_mode in ('generic', 'detailed'));

comment on column public.notification_preferences.preview_mode is
  'generic = no service names or amounts in notification text; detailed = full reminder copy.';
