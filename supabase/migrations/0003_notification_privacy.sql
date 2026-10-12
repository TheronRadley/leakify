-- 0003 — Lock-screen privacy for reminders (audit S-07).
--
-- Lets a user keep subscription names and amounts out of notification text, so
-- a lock screen or notification shade does not advertise what they pay for.
-- Mirrors NotificationSettings.genericLockScreenText (types/index.ts).

alter table public.notification_preferences
  add column if not exists generic_lock_screen_text boolean not null default false;
