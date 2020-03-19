#!/bin/bash
set -e

echo "Setting envs"
BUCKET=$1
VIDEO_ID=$2
FILENAME=$3
AWS_ACCESS_KEY_ID=$4
GITHUB_ACCESS_TOKEN=$5
AWS_SECRET_ACCESS_KEY=$6

TMP_DIR=$(mktemp -d)
SEGMENTS_DIR="$TMP_DIR/segments"
AUDIO_PATH="$TMP_DIR/source.wav"
SOURCE_VIDEO="$TMP_DIR/$FILENAME"

echo "Creating rclone config"
mkdir -p /root/.config/rclone
cat > /root/.config/rclone/rclone.conf <<EOL
[do]
type = s3
provider = DigitalOcean
env_auth = false
access_key_id = $AWS_ACCESS_KEY_ID
secret_access_key = $AWS_SECRET_ACCESS_KEY
endpoint = nyc3.digitaloceanspaces.com
acl = private
EOL

echo "Downloading source clip"
cd
rclone copy do:$BUCKET/uploads/$VIDEO_ID/$FILENAME/ $TMP_DIR

echo "Create data directories"
mkdir -p $SEGMENTS_DIR

echo "Exporting audio"
ffmpeg -i $SOURCE_VIDEO -threads 1 $AUDIO_PATH

echo "Uploading audio"
rclone copy $AUDIO_PATH do:$BUCKET/audio/$VIDEO_ID/

echo "Segmenting video"
ffmpeg -i $SOURCE_VIDEO -y -threads 1 -c copy -f segment -segment_time 10 -an $SEGMENTS_DIR/output_%04d.mkv

echo "Segmentation complete"
ls $SEGMENTS_DIR/

echo "Getting video metadata"
METADATA=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 $SOURCE_VIDEO)
ARR=(${METADATA//,/ })
WIDTH=${ARR[0]}
HEIGHT=${ARR[1]}

echo "Video Width: $WIDTH"
echo "Video Height: $HEIGHT"

echo "Uploading segments"
rclone sync $SEGMENTS_DIR do:$BUCKET/segments/$VIDEO_ID

echo "Nomad Host: $NOMAD_IP_host"

for PRESET in "480p-libx264" "720p-libx264"; do
  for SEGMENT in $(ls $SEGMENTS_DIR); do
    echo "Enqueuing transcoding requests"
    DISPATCH_META_FILE=$(mktemp)

    jq -n \
    --arg cmd "-c:v libx264 -profile:v high -vf scale=1280:-2 -coder 1 -pix_fmt yuv420p -bf 2 -crf 27 -preset slow -threads 1" \
    --arg preset $PRESET \
    --arg bucket $BUCKET \
    --arg segment $SEGMENT \
    --arg video_id $VIDEO_ID \
    --arg aws_access_key_id $AWS_ACCESS_KEY_ID \
    --arg github_access_token $GITHUB_ACCESS_TOKEN \
    --arg aws_secret_access_key $AWS_SECRET_ACCESS_KEY \
    '{
      Meta: {
        cmd:$cmd,
        preset:$preset,
        bucket:$bucket,
        segment:$segment,
        video_id:$video_id,
        aws_access_key_id:$aws_access_key_id,
        github_access_token:$github_access_token,
        aws_secret_access_key:$aws_secret_access_key
      }
    }' \
    > $DISPATCH_META_FILE

    curl \
    --request POST \
    --data @$DISPATCH_META_FILE \
    "http://${NOMAD_IP_host}:4646/v1/job/transcoding/dispatch"

    rm $DISPATCH_META_FILE
  done

  echo "Enqueuing concatination requests"
    CONCATINATION_DISPATCH_FILE=$(mktemp)

    jq -n \
    --arg preset $PRESET \
    --arg bucket $BUCKET \
    --arg video_id $VIDEO_ID \
    --arg aws_access_key_id $AWS_ACCESS_KEY_ID \
    --arg github_access_token $GITHUB_ACCESS_TOKEN \
    --arg aws_secret_access_key $AWS_SECRET_ACCESS_KEY \
    '{
      Meta: {
        preset:$preset,
        bucket:$bucket,
        video_id:$video_id,
        aws_access_key_id:$aws_access_key_id,
        github_access_token:$github_access_token,
        aws_secret_access_key:$aws_secret_access_key
      }
    }' \
    > $CONCATINATION_DISPATCH_FILE

    curl \
    --request POST \
    --data @$CONCATINATION_DISPATCH_FILE \
    "http://${NOMAD_IP_host}:4646/v1/job/concatinating/dispatch"

    rm $CONCATINATION_DISPATCH_FILE
done

echo "Segmenting success!"
