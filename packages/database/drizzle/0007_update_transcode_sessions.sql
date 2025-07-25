-- Should fix transcoded sessions marked as direct play
UPDATE "sessions"
SET
    "is_transcoded" = TRUE,
    "play_method" = 'Transcode'
WHERE
    "transcode_reasons" IS NOT NULL;

-- Update transcoding video and audio codec based on `play_method`
-- This takes care of playback reports previously imported
UPDATE sessions
SET
    transcoding_is_video_direct = CASE
        WHEN substring(
            play_method
            FROM 'v:([^ ]+)'
        ) IS NOT NULL
        AND substring(
            play_method
            FROM 'v:([^ ]+)'
        ) = 'direct' THEN TRUE
        ELSE FALSE
    END,
    transcoding_video_codec = CASE
        WHEN substring(
            play_method
            FROM 'v:([^ ]+)'
        ) <> 'direct' THEN substring(
            play_method
            FROM 'v:([^ ]+)'
        )
        ELSE transcoding_video_codec
    END,
    transcoding_is_audio_direct = CASE
        WHEN substring(
            play_method
            FROM 'a:([^)]+)'
        ) IS NOT NULL
        AND substring(
            play_method
            FROM 'a:([^)]+)'
        ) = 'direct' THEN TRUE
        ELSE FALSE
    END,
    transcoding_audio_codec = CASE
        WHEN substring(
            play_method
            FROM 'a:([^)]+)'
        ) <> 'direct' THEN substring(
            play_method
            FROM 'a:([^)]+)'
        )
        ELSE transcoding_audio_codec
    END
WHERE
    play_method LIKE 'Transcode (%';