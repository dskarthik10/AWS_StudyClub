import json
import os
import boto3
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table_name = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(table_name)

def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        },
        "body": json.dumps(body, default=lambda x: int(x) if isinstance(x, Decimal) and x % 1 == 0 else float(x) if isinstance(x, Decimal) else str(x))
    }

def get_auth_claims(event):
    authorizer = event.get("requestContext", {}).get("authorizer", {})
    claims = authorizer.get("jwt", {}).get("claims") or authorizer.get("claims", {})
    return claims

def get_saved_resource_ids(user_id):
    """Return the resource ids the user has explicitly saved to their library."""
    saved_ids = []
    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("SAVED#")
        )
        for item in res.get("Items", []):
            rid = item.get("resourceId")
            if rid:
                saved_ids.append(rid)
    except Exception:
        pass
    return saved_ids

def lambda_handler(event, context):
    try:
        claims = get_auth_claims(event)
        user_id = claims.get("sub")

        query_params = event.get("queryStringParameters") or {}
        mine = str(query_params.get("mine", "")).lower() in ("true", "1", "yes")
        subject = query_params.get("subject")
        res_type = query_params.get("type")

        items = []
        saved_id_set = set()

        # 1. Query Current User's Resources (owned) via active GSI1, falling back
        #    to the user partition. The user id always comes from verified JWT
        #    claims, never from a client-supplied value.
        if mine and user_id:
            try:
                res = table.query(
                    IndexName="GSI1",
                    KeyConditionExpression=Key("GSI1PK").eq(f"USER#{user_id}") & Key("GSI1SK").begins_with("RESOURCE#"),
                    ScanIndexForward=False
                )
                items = res.get("Items", [])
            except Exception:
                try:
                    res = table.query(
                        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("RESOURCE#")
                    )
                    items = res.get("Items", [])
                except Exception:
                    items = []

            # 1b. Merge resources the user has explicitly saved to their library
            #     (e.g. saved from a study group). Owned resources take precedence.
            owned_ids = {item.get("resourceId") for item in items}
            for rid in get_saved_resource_ids(user_id):
                if not rid or rid in owned_ids:
                    continue
                try:
                    meta = table.get_item(
                        Key={"PK": f"RESOURCE#{rid}", "SK": "METADATA"}
                    ).get("Item")
                except Exception:
                    meta = None
                if meta:
                    items.append(meta)
                    saved_id_set.add(rid)
                    owned_ids.add(rid)

        # 2. Query All Resources (via GSI2, with fallback while index is backfilling)
        if not mine:
            try:
                res = table.query(
                    IndexName="GSI2",
                    KeyConditionExpression=Key("GSI2PK").eq("RESOURCE"),
                    ScanIndexForward=False
                )
                items = res.get("Items", [])
            except Exception:
                items = []

            # Safety fallback: during GSI backfilling or transition
            if len(items) < 2:
                try:
                    scan_res = table.scan(
                        FilterExpression=Attr("entityType").eq("RESOURCE")
                    )
                    items = scan_res.get("Items", [])
                except Exception:
                    pass

        # 3. Apply optional filters
        if subject and subject != "All Subjects":
            items = [item for item in items if item.get("subject") == subject]

        if res_type and res_type != "All Types":
            items = [item for item in items if item.get("type") == res_type]

        # 4. Standardize output items for frontend compatibility
        formatted_resources = []
        for item in items:
            is_owner = bool(user_id) and item.get("ownerId") == user_id
            formatted_resources.append({
                "PK": item.get("PK"),
                "SK": item.get("SK", "METADATA"),
                "entityType": item.get("entityType", "RESOURCE"),
                "resourceId": item.get("resourceId") or item.get("PK", "").replace("RESOURCE#", ""),
                "title": item.get("title", "Untitled Resource"),
                "subject": item.get("subject", "General"),
                "description": item.get("description", ""),
                "type": item.get("type", "Notes"),
                "semester": item.get("semester", ""),
                "uploadedBy": item.get("uploadedBy", "Unknown"),
                "ownerId": item.get("ownerId", ""),
                "uploadDate": item.get("uploadDate", ""),
                "downloads": item.get("downloads", 0),
                "likes": item.get("likes", 0),
                "fileSize": item.get("fileSize", "N/A"),
                "s3Key": item.get("s3Key", ""),
                "visibility": item.get("visibility", "PUBLIC"),
                "sharedClubs": item.get("sharedClubs", []),
                "processingStatus": item.get("processingStatus", ""),
                "isOwner": is_owner,
                "saved": (item.get("resourceId") in saved_id_set) or item.get("_saved", False)
            })

        return build_response(200, formatted_resources)

    except Exception as e:
        return build_response(500, {"error": "Internal server error occurred while retrieving resources"})