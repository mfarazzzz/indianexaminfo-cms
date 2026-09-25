-- Requirement 15.1: Conducting Body lookup table
CREATE TABLE conducting_body (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL UNIQUE,
  short_name       text,
  slug             text NOT NULL UNIQUE,
  official_website text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- RLS: readable by all authenticated, writable by admin/editor
ALTER TABLE conducting_body ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conducting_body_select_authenticated"
  ON conducting_body FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "conducting_body_insert_authenticated"
  ON conducting_body FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "conducting_body_update_authenticated"
  ON conducting_body FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);;
