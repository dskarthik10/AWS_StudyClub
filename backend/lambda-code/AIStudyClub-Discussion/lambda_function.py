import base64
import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table_name = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(table_name)

def response(status, body):
    return {
        "statusCode": status,
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

def encode_next_token(last_evaluated_key):
    if not last_evaluated_key:
        return None
    raw_json = json.dumps(last_evaluated_key)
    return base64.b64encode(raw_json.encode("utf-8")).decode("utf-8")

def decode_next_token(token_str):
    if not token_str:
        return None
    try:
        raw_json = base64.b64decode(token_str.encode("utf-8")).decode("utf-8")
        return json.loads(raw_json)
    except Exception:
        return None

def resolve_club_id(identifier):
    """Resolve 6-digit join code or club ID to actual clubId."""
    clean_id = (identifier or "").strip().upper()
    club = table.get_item(Key={"PK": f"CLUB#{clean_id}", "SK": "METADATA"}).get("Item")
    if club:
        return club.get("clubId", clean_id)

    code_lookup = table.get_item(Key={"PK": f"CODE#{clean_id}", "SK": "METADATA"}).get("Item")
    if code_lookup and code_lookup.get("clubId"):
        return code_lookup["clubId"]

    return clean_id

def lambda_handler(event, context):
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method")
        path = event.get("requestContext", {}).get("http", {}).get("path", "")
        query_params = event.get("queryStringParameters") or {}

        claims = get_auth_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return response(401, {"error": "Unauthorized: Valid authentication token required"})

        user_name = claims.get("name") or claims.get("email") or claims.get("cognito:username") or user_id

        # -------------------------------------------------------------
        # 1. POST MESSAGE: POST /clubs/{clubId}/messages
        # -------------------------------------------------------------
        if method == "POST" and path.startswith("/clubs/") and path.endswith("/messages"):
            raw_cid = path.split("/")[2]
            club_id = resolve_club_id(raw_cid)

            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return response(400, {"error": "Invalid JSON body"})

            message_text = (body.get("message") or "").strip()
            if not message_text:
                return response(400, {"error": "Validation error: 'message' is required"})
            if len(message_text) > 2000:
                return response(400, {"error": "Validation error: 'message' cannot exceed 2000 characters"})

            # Verify club exists
            club = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": "METADATA"}).get("Item")
            if not club:
                return response(404, {"error": "Study club not found"})

            # Verify caller membership
            member = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}).get("Item")
            if not member:
                return response(403, {"error": "Forbidden: You are not a member of this study club"})

            message_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc).isoformat()

            message_item = {
                "PK": f"CLUB#{club_id}",
                "SK": f"MESSAGE#{now}#{message_id}",
                "entityType": "CLUB_MESSAGE",
                "clubId": club_id,
                "messageId": message_id,
                "userId": user_id,
                "userName": user_name,
                "message": message_text,
                "createdAt": now
            }

            table.put_item(Item=message_item)

            return response(201, {
                "message": "Message posted successfully",
                "messageId": message_id,
                "clubId": club_id,
                "item": message_item
            })

        # -------------------------------------------------------------
        # 2. GET MESSAGES (PAGINATED): GET /clubs/{clubId}/messages
        # -------------------------------------------------------------
        if method == "GET" and path.startswith("/clubs/") and path.endswith("/messages"):
            raw_cid = path.split("/")[2]
            club_id = resolve_club_id(raw_cid)

            # Verify club exists
            club = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": "METADATA"}).get("Item")
            if not club:
                return response(404, {"error": "Study club not found"})

            # Verify caller membership
            member = table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}).get("Item")
            if not member:
                return response(403, {"error": "Forbidden: You are not a member of this study club"})

            # Parse pagination parameters
            limit_param = query_params.get("limit", "20")
            try:
                limit = int(limit_param)
                if limit < 1 or limit > 100:
                    limit = 20
            except ValueError:
                limit = 20

            order = query_params.get("order", "asc").lower()
            scan_forward = (order != "desc")

            start_key = decode_next_token(query_params.get("nextToken"))

            query_kwargs = {
                "KeyConditionExpression": Key("PK").eq(f"CLUB#{club_id}") & Key("SK").begins_with("MESSAGE#"),
                "Limit": limit,
                "ScanIndexForward": scan_forward
            }
            if start_key:
                query_kwargs["ExclusiveStartKey"] = start_key

            res = table.query(**query_kwargs)
            messages = res.get("Items", [])
            last_key = res.get("LastEvaluatedKey")
            next_token = encode_next_token(last_key)

            return response(200, {
                "clubId": club_id,
                "messages": messages,
                "count": len(messages),
                "nextToken": next_token
            })

        return response(404, {"error": f"Route not found: {method} {path}"})

    except Exception as e:
        return response(500, {"error": "Internal server error occurred in discussion service"})