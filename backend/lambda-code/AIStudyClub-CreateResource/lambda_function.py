import json
import os
import re
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table_name = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(table_name)

s3 = boto3.client("s3", region_name="ap-south-1")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "aistudyclub-karthik-2026")

sqs = boto3.client("sqs", region_name="ap-south-1")
RESOURCE_QUEUE_URL = os.environ.get("RESOURCE_QUEUE_URL", "")

ALLOWED_TYPES = {"Notes", "Syllabus", "Question Paper", "Assignment", "PDF", "Document", "Presentation", "General"}

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
    """
    Extract verified claims from Cognito JWT authorizer context.
    Never trust client-supplied owner or identity headers.
    """
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims", {})
    return claims

def format_file_size(size_bytes):
    if not size_bytes or size_bytes <= 0:
        return "N/A"
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}" if unit != 'B' else f"{int(size_bytes)} B"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"

def handle_save_to_library(user_id, body):
    """Save an existing resource to the user's personal library.

    Reuses the already-uploaded S3 object and resource metadata; it never
    copies the file or changes the original owner. Access is authorized from
    persisted metadata and verified membership, never from client input.
    """
    resource_id = (body.get("saveResourceId") or "").strip()
    if not resource_id:
        return build_response(400, {"error": "Validation error: 'saveResourceId' is required"})

    resource = table.get_item(
        Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"}
    ).get("Item")
    if not resource:
        return build_response(404, {"error": "Resource not found"})

    owner_id = resource.get("ownerId")
    visibility = (resource.get("visibility") or "PUBLIC").upper()
    shared_clubs = list(resource.get("sharedClubs") or [])
    if resource.get("clubId") and resource.get("clubId") not in shared_clubs:
        shared_clubs.append(resource.get("clubId"))

    # The owner already has it in their library.
    if owner_id and owner_id == user_id:
        return build_response(200, {
            "message": "Resource is already in your library",
            "resourceId": resource_id,
            "saved": False,
            "alreadyOwned": True
        })

    # Idempotent: never create duplicate saved references.
    existing = table.get_item(
        Key={"PK": f"USER#{user_id}", "SK": f"SAVED#{resource_id}"}
    ).get("Item")
    if existing:
        return build_response(200, {
            "message": "Resource is already saved to your library",
            "resourceId": resource_id,
            "saved": True,
            "alreadySaved": True
        })

    # Authorization: public resources, or resources shared with a club the
    # caller is verifiably a member of. Private resources are owner-only.
    authorized = visibility == "PUBLIC"
    if not authorized and shared_clubs:
        for club_id in shared_clubs:
            try:
                if table.get_item(
                    Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}
                ).get("Item"):
                    authorized = True
                    break
            except Exception:
                continue
    if not authorized:
        return build_response(403, {
            "error": "Forbidden: You are not authorized to save this resource"
        })

    now = datetime.now(timezone.utc).isoformat()
    source_club = (body.get("clubId") or (shared_clubs[0] if shared_clubs else "")).strip()

    saved_item = {
        "PK": f"USER#{user_id}",
        "SK": f"SAVED#{resource_id}",
        "entityType": "USER_SAVED_RESOURCE",
        "userId": user_id,
        "resourceId": resource_id,
        "ownerId": owner_id or "",
        "title": resource.get("title", ""),
        "subject": resource.get("subject", ""),
        "type": resource.get("type", "Notes"),
        "s3Key": resource.get("s3Key", ""),
        "visibility": resource.get("visibility", "PUBLIC"),
        "source": "GROUP" if source_club else "LIBRARY",
        "savedAt": now,
        "GSI1PK": f"USER#{user_id}",
        "GSI1SK": f"SAVED#{now}"
    }
    if source_club:
        saved_item["clubId"] = source_club

    table.put_item(Item=saved_item)

    return build_response(201, {
        "message": "Resource saved to your library",
        "resourceId": resource_id,
        "saved": True
    })

def lambda_handler(event, context):
    try:
        # 1. Verify authentication claims
        claims = get_auth_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return build_response(401, {"error": "Unauthorized: Valid authentication claims required"})

        # Derive uploadedBy strictly from verified Cognito JWT claims
        display_name = claims.get("name") or claims.get("email") or claims.get("cognito:username") or user_id

        # 2. Parse and validate request body
        try:
            body = json.loads(event.get("body") or "{}")
        except (ValueError, TypeError):
            return build_response(400, {"error": "Invalid request body: Expected valid JSON"})

        # 2b. "Save to Library" flow: reuse the existing POST /resources route
        #     and the already-uploaded S3 object. No duplicate file is created.
        if body.get("saveResourceId"):
            return handle_save_to_library(user_id, body)

        title = (body.get("title") or "").strip()
        subject = (body.get("subject") or "").strip()
        s3_key = (body.get("s3Key") or "").strip()
        resource_type = (body.get("type") or "Notes").strip()
        semester = (body.get("semester") or "").strip()
        description = (body.get("description") or "").strip()
        visibility = (body.get("visibility") or "PUBLIC").upper().strip()
        club_id = (body.get("clubId") or "").strip()

        if not title:
            return build_response(400, {"error": "Validation error: 'title' is required"})
        if len(title) > 200:
            return build_response(400, {"error": "Validation error: 'title' cannot exceed 200 characters"})

        if not subject:
            return build_response(400, {"error": "Validation error: 'subject' is required"})
        if len(subject) > 100:
            return build_response(400, {"error": "Validation error: 'subject' cannot exceed 100 characters"})

        if not s3_key:
            return build_response(400, {"error": "Validation error: 's3Key' is required"})
        if ".." in s3_key or not re.match(r"^resources/[a-zA-Z0-9_\-\./]+$", s3_key):
            return build_response(400, {"error": "Validation error: Invalid 's3Key' format"})

        if visibility not in {"PUBLIC", "PRIVATE", "GROUP"}:
            visibility = "PUBLIC"

        # 3. Verify that S3 object exists in bucket and get verified file size
        file_size_bytes = 0
        file_size_formatted = "N/A"
        try:
            s3_meta = s3.head_object(Bucket=BUCKET_NAME, Key=s3_key)
            file_size_bytes = s3_meta.get("ContentLength", 0)
            file_size_formatted = format_file_size(file_size_bytes)
        except ClientError as e:
            error_code = str(e.response.get("Error", {}).get("Code", ""))
            http_status = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
            if error_code in ("404", "NoSuchKey", "NotFound", "403", "AccessDenied") or http_status == 404:
                return build_response(400, {
                    "error": "Uploaded file not found in storage. Please complete S3 upload before saving metadata."
                })
            return build_response(502, {"error": "Storage verification failed"})

        # 4. If sharing to a group/club, verify membership
        if club_id:
            club_check = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": "METADATA"}).get("Item")
            if not club_check:
                return build_response(404, {"error": f"Study club '{club_id}' not found"})

            membership = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}).get("Item")
            if not membership:
                return build_response(403, {"error": "Forbidden: You must be a member of the study club to share resources to it"})

        # 5. Build items with single-table design & GSIs
        resource_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        resource_item = {
            "PK": f"RESOURCE#{resource_id}",
            "SK": "METADATA",
            "entityType": "RESOURCE",
            "resourceId": resource_id,
            "title": title,
            "subject": subject,
            "type": resource_type,
            "semester": semester,
            "description": description,
            "ownerId": user_id,            # Verified Cognito sub claim
            "uploadedBy": display_name,     # Verified display name/email
            "s3Key": s3_key,
            "fileSize": file_size_formatted,
            "fileSizeBytes": file_size_bytes,
            "uploadDate": now,
            "downloads": 0,
            "likes": 0,
            "visibility": visibility,
            "status": "ACTIVE",
            "processingStatus": "PENDING",
            "GSI1PK": f"USER#{user_id}",
            "GSI1SK": f"RESOURCE#{now}",
            "GSI2PK": "RESOURCE",
            "GSI2SK": now
        }

        if club_id:
            resource_item["clubId"] = club_id
            resource_item["sharedClubs"] = [club_id]

        # Ownership record for fast O(1) user resource queries
        user_resource_item = {
            "PK": f"USER#{user_id}",
            "SK": f"RESOURCE#{resource_id}",
            "entityType": "USER_RESOURCE",
            "userId": user_id,
            "resourceId": resource_id,
            "title": title,
            "subject": subject,
            "type": resource_type,
            "s3Key": s3_key,
            "uploadDate": now
        }

        table.put_item(Item=resource_item)
        table.put_item(Item=user_resource_item)

        if club_id:
            club_resource_item = {
                "PK": f"CLUB#{club_id}",
                "SK": f"RESOURCE#{resource_id}",
                "entityType": "CLUB_RESOURCE",
                "clubId": club_id,
                "resourceId": resource_id,
                "sharedBy": user_id,
                "sharedAt": now,
                "title": title,
                "subject": subject,
                "s3Key": s3_key
            }
            table.put_item(Item=club_resource_item)

        # 6. Enqueue a lightweight background processing job. This is
        # best-effort and intentionally decoupled from the upload response: a
        # queue failure must NOT be reported as a failed upload. The metadata
        # is already safely persisted, so we only log and record the status.
        processing_status = "PENDING"
        if RESOURCE_QUEUE_URL:
            try:
                sqs.send_message(
                    QueueUrl=RESOURCE_QUEUE_URL,
                    MessageBody=json.dumps({
                        "type": "RESOURCE_PROCESS",
                        "resourceId": resource_id,
                    }, default=str),
                )
            except Exception as exc:
                processing_status = "ENQUEUE_FAILED"
                print(f"SQS enqueue failed for resource {resource_id}: {exc}")
                try:
                    table.update_item(
                        Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"},
                        UpdateExpression="SET processingStatus = :s",
                        ExpressionAttributeValues={":s": processing_status},
                    )
                except Exception as upd_exc:
                    print(f"Failed to record enqueue failure for {resource_id}: {upd_exc}")
        else:
            processing_status = "SKIPPED"

        return build_response(201, {
            "message": "Resource metadata saved successfully",
            "resourceId": resource_id,
            "processingStatus": processing_status,
            "resource": resource_item
        })

    except Exception as e:
        return build_response(500, {"error": "Internal server error occurred while creating resource"})