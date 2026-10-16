"""AIStudyClub-DeleteResource

DELETE /resources/{resourceId}

Permanently deletes a resource owned by the authenticated user:
  1. Deletes the S3 object first (never remove metadata while the file exists).
  2. Removes ownership and study-group reference records safely.
  3. Deletes the DynamoDB resource metadata last.

Ownership is derived exclusively from verified Cognito JWT claims, so a caller
can never delete another user's resource by spoofing a frontend id.
"""
import json
import os
import re
import boto3
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
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
        },
        "body": json.dumps(body, default=str)
    }


def get_auth_claims(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims", {})
    return claims


def get_resource_id(event):
    path_params = event.get("pathParameters") or {}
    resource_id = (path_params.get("resourceId") or "").strip()
    if not resource_id:
        path = event.get("requestContext", {}).get("http", {}).get("path", "")
        parts = [p for p in path.strip("/").split("/") if p]
        if len(parts) >= 2 and parts[0] == "resources":
            resource_id = parts[1]
    return resource_id


def lambda_handler(event, context):
    try:
        claims = get_auth_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return build_response(401, {"error": "Unauthorized: Valid authentication claims required"})

        resource_id = get_resource_id(event)
        if not resource_id:
            return build_response(400, {"error": "Validation error: 'resourceId' is required"})

        item = table.get_item(
            Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"}
        ).get("Item")
        if not item:
            return build_response(404, {"error": "Resource not found"})

        owner_id = item.get("ownerId")
        if not owner_id or owner_id != user_id:
            return build_response(403, {"error": "Forbidden: You can only delete resources you own"})

        s3_key = (item.get("s3Key") or "").strip()
        shared_clubs = list(item.get("sharedClubs") or [])
        if item.get("clubId") and item.get("clubId") not in shared_clubs:
            shared_clubs.append(item.get("clubId"))

        # 1. Delete the S3 object FIRST. If this genuinely fails, abort so we
        # never remove metadata while the stored file still exists.
        if s3_key:
            if ".." in s3_key or not re.match(r"^resources/[a-zA-Z0-9_\-\./]+$", s3_key):
                return build_response(500, {"error": "Stored S3 key is invalid; deletion aborted"})
            try:
                s3.delete_object(Bucket=BUCKET_NAME, Key=s3_key)
            except ClientError as exc:
                code = str(exc.response.get("Error", {}).get("Code", ""))
                http_status = exc.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
                if code not in ("NoSuchKey", "404", "NotFound") and http_status != 404:
                    print(f"S3 delete failed for {s3_key}: {exc}")
                    return build_response(502, {
                        "error": "Failed to delete the stored file; resource was not removed"
                    })
            except Exception as exc:
                print(f"S3 delete failed for {s3_key}: {exc}")
                return build_response(502, {
                    "error": "Failed to delete the stored file; resource was not removed"
                })

        # 2. Remove reference records. The ownership record and any study-group
        # shared-resource records must go before the metadata, otherwise group
        # listings would keep dangling links to a deleted resource.
        reference_keys = [
            {"PK": f"USER#{owner_id}", "SK": f"RESOURCE#{resource_id}"}
        ]
        for club_id in shared_clubs:
            reference_keys.append({"PK": f"CLUB#{club_id}", "SK": f"RESOURCE#{resource_id}"})

        failed_references = []
        for key in reference_keys:
            try:
                table.delete_item(Key=key)
            except Exception as exc:
                failed_references.append(key)
                print(f"Failed to remove reference {key}: {exc}")

        if failed_references:
            # Metadata is intentionally retained so the resource stays
            # consistent and the operation can be safely retried.
            return build_response(500, {
                "error": "The file was deleted, but some references could not be removed. Please retry.",
                "partial": True,
                "fileDeleted": True,
                "metadataDeleted": False,
            })

        # 3. Delete the metadata record last.
        try:
            table.delete_item(Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"})
        except Exception as exc:
            print(f"Failed to delete metadata for {resource_id}: {exc}")
            return build_response(500, {
                "error": "The file and references were deleted, but the resource metadata could not be removed. Please retry.",
                "partial": True,
                "fileDeleted": True,
                "metadataDeleted": False,
            })

        return build_response(200, {
            "message": "Resource deleted successfully",
            "resourceId": resource_id,
            "fileDeleted": True,
            "metadataDeleted": True,
            "sharedClubs": shared_clubs,
        })

    except Exception as exc:
        print(f"Unexpected error deleting resource: {exc}")
        return build_response(500, {"error": "Internal server error occurred while deleting resource"})
