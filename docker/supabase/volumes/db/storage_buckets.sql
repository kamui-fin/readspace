-- Initialize storage buckets and RLS policies for Readspace
-- WARNING: This script is NOT idempotent and will fail if run more than once.

-- Create buckets for documents and images
INSERT INTO storage.buckets (id, name)
VALUES
  ('documents', 'documents'),
  ('images', 'images');

-- Enable RLS on storage.objects table
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create a single policy for both 'documents' and 'images' buckets
CREATE POLICY "Allow users to manage their own files" ON storage.objects
  FOR ALL
  USING (bucket_id IN ('documents', 'images') AND split_part(name, '/', 1) = auth.uid()::text)
  WITH CHECK (bucket_id IN ('documents', 'images') AND split_part(name, '/', 1) = auth.uid()::text);