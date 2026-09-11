-- Older entries confirmed inaccessible while checking replacement videos for the affected profiles.
UPDATE sermons SET status='hidden' WHERE status='published' AND youtube_id IN ('1KXbmvuLdu0','2ESxdVP3LOA','ADP8JROEcK8','KCl1OWeBWvk','U-DQAAexsTA','YgWUmhOvUus','_mprYe3ijws','bOEeSxvAFnM','gURdfmIBx0w','sAFavXhsQc0','yuWXFlyCz9c');
UPDATE praise_videos SET status='hidden' WHERE status='published' AND youtube_id IN ('1KXbmvuLdu0','2ESxdVP3LOA','ADP8JROEcK8','KCl1OWeBWvk','U-DQAAexsTA','YgWUmhOvUus','_mprYe3ijws','bOEeSxvAFnM','gURdfmIBx0w','sAFavXhsQc0','yuWXFlyCz9c');
