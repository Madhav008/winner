packager \
  input=ad-asset.mp4,stream=video,init_segment=video/init.mp4,segment_template=video/seg_\$Number\$.m4s \
  input=ad-asset.mp4,stream=audio,init_segment=audio/init.mp4,segment_template=audio/seg_\$Number\$.m4s \
  --enable_raw_key_encryption \
  --keys label=:key_id=1ae8ccd0e4f76c23f0268756e64f9a3a:key=1ae8ccd0e4f76c23f0268756e64f9a3a \
  --protection_scheme cenc \
  --fragment_duration 6 \
  --mpd_output ./ad_encrypted.mpd
