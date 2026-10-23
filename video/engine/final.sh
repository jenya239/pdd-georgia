#!/bin/bash
# Final assembly, run from an episode folder: concat segments, burn ASS subs, mix voice + music.
set -e
ffmpeg -y -loglevel error -f concat -safe 0 -i seg/list.txt -c copy video_nosub.mp4
ffmpeg -y -loglevel error -i video_nosub.mp4 -i audio/voice.wav -i audio/music.wav \
  -filter_complex "[0:v]ass=subs.ass[v];[1:a]aformat=channel_layouts=stereo,volume=1.0[vo];[2:a]volume=0.07[mu];[vo][mu]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -ar 48000 -movflags +faststart final.mp4
ffprobe -v error -show_entries format=duration:stream=codec_type,codec_name,width,height -of compact final.mp4
