locals {
  function_name = "bken-api-${var.env}"
}

data "archive_file" "tidal_api_zip" {
  type        = "zip"
  source_dir  = "${path.module}/src/"
  output_path = local.archive_output_path
}

resource "aws_lambda_function" "tidal_api" {
  timeout          = 30
  memory_size      = 512
  runtime          = "nodejs12.x"
  function_name    = local.function_name
  handler          = "src/index.handler"
  filename         = local.archive_output_path
  role             = "arn:aws:iam::594206825329:role/lambda-all"
  depends_on       = [aws_cloudwatch_log_group.tidal_api]
  source_code_hash = data.archive_file.tidal_concatinating_zip.output_base64sha256

  tracing_config {
    mode = "Active"
  }

  vpc_config {
    security_group_ids = [
      "sg-665de11a",
    ]
    subnet_ids = [
      "subnet-00bcc265",
      "subnet-11635158",
      "subnet-2c4a0701",
      "subnet-9446c4a8",
      "subnet-c7275c9c",
      "subnet-fd3a56f1",
    ]
  }
}

resource "aws_cloudwatch_log_group" "tidal_api" {
  retention_in_days = 30
  name              = "/aws/lambda/${local.function_name}"
}
