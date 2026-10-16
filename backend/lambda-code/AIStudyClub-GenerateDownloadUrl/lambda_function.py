import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table_name = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(table_name)

s3 = boto3.client("s3", region_name="ap-south-1")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "aistudyclub-karthik-2026")

def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        },
        "body": json.dumps(body, default=str)
    }

def get_auth_claims(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims", {})
    return claims

def find_resource(resource_id=None, s3_key=None):
    """
    Find resource item in DynamoDB using direct PK lookup or s3Key index.
    """
    if resource_id:
        res = table.get_item(Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"})
        if "Item" in res:
            return res["Item"]

    if s3_key:
        # 1. Try querying s3Key-index
        try:
            res = table.query(
                IndexName="s3Key-index",
                KeyConditionExpression=Key("s3Key").eq(s3_key)
            )
            items = res.get("Items", [])
            if items:
                return items[0]
        except Exception:
            # Index might be indexing or fallback
            pass

        # 2. Resilient fallback scan for matching s3Key
        try:
            res = table.scan(
                FilterExpression=Attr("s3Key").eq(s3_key) & Attr("entityType").eq("RESOURCE")
            )
            items = res.get("Items", [])
            if items:
                return items[0]
        except Exception:
            pass

    return None

def check_authorization(resource, user_id):
    """
    Verify if authenticated user is authorized to download resource:
    1. Owner is always authorized.
    2. Public resources are authorized for authenticated users.
    3. Group-shared resources require verified active membership.
    4. Private resources require ownership.
    """
    owner_id = resource.get("ownerId")
    uploaded_by = resource.get("uploadedBy")
    visibility = (resource.get("visibility") or "PUBLIC").upper()
    shared_clubs = resource.get("sharedClubs", [])
    if resource.get("clubId") and resource.get("clubId") not in shared_clubs:
        shared_clubs = list(shared_clubs) + [resource.get("clubId")]

    # Owner access (by sub or uploadedBy)
    if (owner_id and owner_id == user_id) or (uploaded_by and uploaded_by == user_id):
        return True, "Authorized as resource owner"

    # Private resource check
    if visibility == "PRIVATE":
        return False, "Access denied: This resource is private to its owner"

    # Group-shared resource check
    if visibility == "GROUP" or (shared_clubs and visibility != "PUBLIC"):
        if not shared_clubs:
            return False, "Access denied: Resource has no valid study club associations"

        # Check membership in at least one shared club
        is_member = False
        for club_id in shared_clubs:
            try:
                mem = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}).get("Item")
                if mem:
                    is_member = True
                    break
            except Exception:
                continue

        if is_member:
            return True, "Authorized via study club membership"
        return False, "Access denied: You are not a member of the study club this resource was shared with"

    # Public resources
    return True, "Authorized: Public resource"

def lambda_handler(event, context):
    try:
        # 1. Verify authenticated user from JWT
        claims = get_auth_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return build_response(401, {"error": "Unauthorized: Valid authentication claims required"})

        # 2. Parse request
        try:
            body = json.loads(event.get("body") or "{}")
        except (ValueError, TypeError):
            return build_response(400, {"error": "Invalid request body: Expected valid JSON"})

        file_key = (body.get("s3Key") or "").strip()
        resource_id = (body.get("resourceId") or "").strip()

        if not file_key and not resource_id:
            return build_response(400, {"error": "Validation error: 's3Key' or 'resourceId' is required"})

        if file_key and ".." in file_key:
            return build_response(400, {"error": "Validation error: Invalid file key format"})

        # 3. Look up resource record in DynamoDB
        resource = find_resource(resource_id=resource_id, s3_key=file_key)
        if not resource:
            # If not found in DynamoDB metadata, deny access
            return build_response(404, {"error": "Resource not found in system catalog"})

        # Use actual verified s3Key from metadata
        s3_key_to_download = resource.get("s3Key") or file_key
        actual_resource_id = resource.get("resourceId") or resource.get("PK", "").replace("RESOURCE#", "")

        # 4. Check authorization
        authorized, reason = check_authorization(resource, user_id)
        if not authorized:
            return build_response(403, {"error": f"Forbidden: {reason}"})

        # 5. Verify S3 file actually exists
        try:
            s3.head_object(Bucket=BUCKET_NAME, Key=s3_key_to_download)
        except ClientError as e:
            err = e.response.get("Error", {}).get("Code", "")
            if err in ("404", "NoSuchKey", "NotFound"):
                return build_response(404, {"error": "Underlying storage file not found"})
            return build_response(502, {"error": "Storage verification error"})

        # 6. Generate presigned download URL (valid for 5 minutes)
        download_url = s3.generate_presigned_url(
            "get_object",
            Params={
                "Bucket": BUCKET_NAME,
                "Key": s3_key_to_download
            },
            ExpiresIn=300
        )

        # 7. Track download: Increment counter and log activity
        now = datetime.now(timezone.utc).isoformat()
        try:
            table.update_item(
                Key={"PK": resource["PK"], "SK": "METADATA"},
                UpdateExpression="SET downloads = if_not_exists(downloads, :zero) + :one",
                ExpressionAttributeValues={":zero": 0, ":one": 1}
            )
        except Exception:
            pass

        try:
            download_id = str(uuid.uuid4())
            table.put_item(
                Item={
                    "PK": f"USER#{user_id}",
                    "SK": f"DOWNLOAD#{now}#{download_id}",
                    "entityType": "USER_DOWNLOAD",
                    "userId": user_id,
                    "resourceId": actual_resource_id,
                    "s3Key": s3_key_to_download,
                    "downloadedAt": now,
                    "GSI1PK": f"USER#{user_id}",
                    "GSI1SK": f"DOWNLOAD#{now}"
                }
            )
        except Exception:
            pass

        return build_response(200, {
            "downloadUrl": download_url,
            "resourceId": actual_resource_id,
            "s3Key": s3_key_to_download
        })

    except Exception as e:
        return build_response(500, {"error": "Internal server error occurred while generating download URL"})