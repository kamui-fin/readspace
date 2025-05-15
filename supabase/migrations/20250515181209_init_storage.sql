-- Buckets
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('documents', 'documents', false),
  ('images', 'images', false)
ON CONFLICT (id) DO NOTHING;

-- Policies
-- Documents policy
CREATE POLICY "Users can access their own documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents'
  AND (select auth.uid()::text) = (storage.foldername(name))[1]
);

-- Images policy
CREATE POLICY "Users can access their own images"
ON storage.objects FOR ALL
USING (
  bucket_id = 'images'
  AND (select auth.uid()::text) = (storage.foldername(name))[1]
);
