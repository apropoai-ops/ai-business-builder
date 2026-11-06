-- 0073: booking notifications — instant new-booking alerts (owner + assigned
-- staff) and a 1-hour-before customer reminder.

-- Optional per-staff contact so a staff member (e.g. a barber) can be
-- notified directly when a customer books with them.
alter table public.booking_staff
  add column if not exists email text,
  add column if not exists phone text;

-- Second reminder guard, distinct from the existing day-before
-- reminder_sent_at, so the two passes never interfere with each other.
alter table public.bookings
  add column if not exists reminder_1h_sent_at timestamptz;

-- Speeds up both reminder passes' "confirmed bookings starting soon" scan.
create index if not exists bookings_business_starts_confirmed_idx
  on public.bookings (business_id, starts_at)
  where status = 'confirmed';
