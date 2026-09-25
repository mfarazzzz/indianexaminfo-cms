-- Five reference columns that lacked FK constraints. All currently 100% NULL,
-- so no orphans to clean. ON DELETE SET NULL: these are optional metadata refs;
-- deleting a user or media asset should null the pointer, not delete the record.

ALTER TABLE public.sarkari_naukri
  ADD CONSTRAINT sarkari_naukri_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.sarkari_naukri
  ADD CONSTRAINT sarkari_naukri_image_id_fkey
  FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.cms_education_news
  ADD CONSTRAINT cms_education_news_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.cms_education_news
  ADD CONSTRAINT cms_education_news_image_id_fkey
  FOREIGN KEY (image_id) REFERENCES public.media(id) ON DELETE SET NULL;

ALTER TABLE public.entity_download
  ADD CONSTRAINT entity_download_media_id_fkey
  FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE SET NULL;;
