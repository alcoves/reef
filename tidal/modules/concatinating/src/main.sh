function handler () {
  SQS_BODY=$(echo $1 | jq -r '.Records[0].body')
  echo "SQS_BODY: $SQS_BODY"

  IN_PATH="$(echo $SQS_BODY | jq -r '.in_path')"
  OUT_PATH="$(echo $SQS_BODY | jq -r '.out_path')"

  # If the transcoded segments are larger than 400mb, we ask fargate to concat
  # else we concat locally on lambda

  ./concat.sh $IN_PATH $OUT_PATH

  # echo "invoking concatination server"
  # curl -X GET "http://172.31.33.233:4000/concat?in_path=${IN_PATH}&out_path=${OUT_PATH}"
  # echo "concatination completed"
}