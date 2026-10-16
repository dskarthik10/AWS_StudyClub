import json
import os
import re
import uuid
import boto3

s3 = boto3.client("s3", region_name="ap-south-1")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "aistudyclub-karthik-2026")

ALLOWED_EXTENSIONS = {
    ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".rtf",
    ".png", ".jpg", ".jpeg", ".webp", ".zip"
}

def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        },
        "body": json.dumps(body)
    }

def get_auth_claims(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims", {})
    return claims

def lambda_handler(event, context):
    try:
        claims = get_auth_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return build_response(401, {"error": "Unauthorized: Valid authentication claims required"})

        try:
            body = json.loads(event.get("body") or "{}")
        except (ValueError, TypeError):
            return build_response(400, {"error": "Invalid request body: Expected valid JSON"})

        file_name = (body.get("fileName") or "").strip()
        file_type = (body.get("fileType") or "application/octet-stream").strip()

        if not file_name:
            return build_response(400, {"error": "Validation error: 'fileName' is required"})

        # Clean filename to avoid path injection
        base_name = os.path.basename(file_name)
        _, ext = os.path.splitext(base_name)
        ext = ext.lower()

        if not ext or ext not in ALLOWED_EXTENSIONS:
            return build_response(400, {
                "error": f"Validation error: Unsupported file format '{ext}'. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            })

        # Sanitize filename
        safe_name = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", base_name)
        file_key = f"resources/{uuid.uuid4()}-{safe_name}"

        # Generate presigned PUT URL
        upload_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": file_key,
                "ContentType": file_type
            },
            ExpiresIn=300
        )

        return build_response(200, {
            "uploadUrl": upload_url,
            "fileKey": file_key
        })

    except Exception as e:
        return build_response(500, {"error": "Internal server error occurred while generating upload URL"})