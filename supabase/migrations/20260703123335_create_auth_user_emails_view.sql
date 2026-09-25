
-- View exposing only id + email from auth.users, accessible to authenticated role
CREATE OR REPLACE VIEW public.auth_user_emails AS
  SELECT id, email FROM auth.users;

-- Allow authenticated users to select from it
GRANT SELECT ON public.auth_user_emails TO authenticated;

-- RLS not applicable to views; the GRANT above is sufficient
;
