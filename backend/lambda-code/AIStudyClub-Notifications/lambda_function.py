"""
AIStudyClub-Notifications -- Phase 7
Routes:
  GET    /notifications           - List notifications for auth user
  GET    /notifications/unread    - Unread count
  POST   /notifications/read      - Mark one or all notifications as read
  POST   /notifications/read-all  - Mark all as read
"""
import json
import os
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
TABLE_NAME = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(TABLE_NAME)


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        },
        "body": json.dumps(body, default=_serial)
    }


def _serial(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    return str(obj)


def get_claims(event):
    auth = event.get("requestContext", {}).get("authorizer", {})
    return auth.get("jwt", {}).get("claims") or auth.get("claims", {})


def handle_list_notifications(event, user_id):
    query_params = event.get("queryStringParameters") or {}
    limit = min(int(query_params.get("limit", 30)), 100)
    unread_only = str(query_params.get("unread", "")).lower() in ("true", "1")

    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("NOTIF#"),
            ScanIndexForward=False,
            Limit=limit
        )
        items = res.get("Items", [])
    except Exception:
        items = []

    if unread_only:
        items = [i for i in items if not i.get("read", False)]

    notifications = [{
        "notificationId": i.get("notificationId"),
        "type": i.get("type"),
        "title": i.get("title"),
        "message": i.get("message"),
        "read": i.get("read", False),
        "createdAt": i.get("createdAt"),
        "meta": i.get("meta", {})
    } for i in items]

    return resp(200, {"notifications": notifications, "count": len(notifications)})


def handle_unread_count(user_id):
    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("NOTIF#"),
            FilterExpression=Attr("read").eq(False),
            Limit=100
        )
        count = len(res.get("Items", []))
    except Exception:
        count = 0
    return resp(200, {"unreadCount": count})


def handle_mark_read(event, user_id):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})

    notif_id = (body.get("notificationId") or "").strip()
    mark_all = body.get("all", False)

    if mark_all:
        # Mark all unread notifications for this user
        try:
            res = table.query(
                KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("NOTIF#"),
                FilterExpression=Attr("read").eq(False),
                Limit=100
            )
            items = res.get("Items", [])
            for item in items:
                table.update_item(
                    Key={"PK": item["PK"], "SK": item["SK"]},
                    UpdateExpression="SET #r = :true",
                    ExpressionAttributeNames={"#r": "read"},
                    ExpressionAttributeValues={":true": True}
                )
            return resp(200, {"message": f"Marked {len(items)} notifications as read"})
        except Exception as e:
            return resp(500, {"error": f"Failed to mark all as read: {str(e)}"})

    if not notif_id:
        return resp(400, {"error": "Validation error: 'notificationId' or 'all':true is required"})

    # Find the notification by scanning for matching notificationId
    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("NOTIF#"),
            FilterExpression=Attr("notificationId").eq(notif_id),
            Limit=10
        )
        items = res.get("Items", [])
        if not items:
            return resp(404, {"error": "Notification not found"})
        item = items[0]
        table.update_item(
            Key={"PK": item["PK"], "SK": item["SK"]},
            UpdateExpression="SET #r = :true",
            ExpressionAttributeNames={"#r": "read"},
            ExpressionAttributeValues={":true": True}
        )
        return resp(200, {"message": "Notification marked as read", "notificationId": notif_id})
    except Exception as e:
        return resp(500, {"error": f"Failed: {str(e)}"})


def lambda_handler(event, context):
    try:
        claims = get_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return resp(401, {"error": "Unauthorized"})
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path   = event.get("requestContext", {}).get("http", {}).get("path", "")

        if method == "GET" and path == "/notifications":
            return handle_list_notifications(event, user_id)
        if method == "GET" and path == "/notifications/unread":
            return handle_unread_count(user_id)
        if method == "POST" and path in ("/notifications/read", "/notifications/read-all"):
            if path == "/notifications/read-all":
                event["body"] = json.dumps({"all": True})
            return handle_mark_read(event, user_id)

        return resp(404, {"error": f"Route not found: {method} {path}"})
    except Exception as e:
        return resp(500, {"error": "Internal server error", "detail": str(e)})
