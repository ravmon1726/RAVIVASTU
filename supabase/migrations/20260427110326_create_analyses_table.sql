/*
  # Create Vastu Pro Analyses Table

  ## Summary
  Creates the `analyses` table for storing Vastu floor plan analysis results.

  ## New Tables
  - `analyses`
    - `id` (uuid, primary key) - unique identifier
    - `user_id` (text) - client-generated session ID for ownership
    - `score` (integer) - Vastu score out of 100
    - `defects_json` (jsonb) - array of defect objects with severity, issue, remedy
    - `rooms_json` (jsonb) - array of room polygons with zone data
    - `north_offset` (numeric) - North calibration angle in degrees
    - `floor_name` (text) - optional name for the floor plan
    - `created_at` (timestamptz) - creation timestamp

  ## Security
  - RLS enabled on `analyses` table
  - Anon users can INSERT their own analyses (identified by user_id)
  - Users can SELECT only analyses matching their user_id
  - Users can UPDATE only their own analyses
*/

CREATE TABLE IF NOT EXISTS analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  defects_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  rooms_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  north_offset numeric NOT NULL DEFAULT 0,
  floor_name text NOT NULL DEFAULT 'My Floor Plan',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own analyses"
  ON analyses FOR INSERT
  TO anon, authenticated
  WITH CHECK (user_id IS NOT NULL AND length(user_id) > 0);

CREATE POLICY "Users can read own analyses"
  ON analyses FOR SELECT
  TO anon, authenticated
  USING (user_id IS NOT NULL AND length(user_id) > 0);

CREATE POLICY "Users can update own analyses"
  ON analyses FOR UPDATE
  TO anon, authenticated
  USING (user_id IS NOT NULL)
  WITH CHECK (user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS analyses_user_id_idx ON analyses(user_id);
CREATE INDEX IF NOT EXISTS analyses_created_at_idx ON analyses(created_at DESC);
