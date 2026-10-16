"""
AIStudyClub-Dashboard -- Phase 5
Routes:
  GET /dashboard   - User stats: resources, clubs, quizzes, recent activity
  GET /profile     - Authenticated user profile details
  PUT /profile     - Update user profile
"""
import json
import os
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
TABLE_NAME = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(TABLE_NAME)

cognito = boto3.client("cognito-idp", region_name="ap-south-1")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "ap-south-1_mmcevaMYP")


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS"
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


def safe_query(index_name, pk_attr, pk_val, sk_prefix=None, limit=50):
    try:
        kce = Key(pk_attr).eq(pk_val)
        if sk_prefix:
            sk_attr = "GSI1SK" if "GSI1" in index_name else "SK"
            kce = kce & Key(sk_attr).begins_with(sk_prefix)
        kw = dict(
            IndexName=index_name,
            KeyConditionExpression=kce,
            ScanIndexForward=False,
            Limit=limit
        )
        return table.query(**kw).get("Items", [])
    except Exception:
        return []


def handle_dashboard(user_id):
    # 1. Resources uploaded by this user
    user_resources = safe_query("GSI1", "GSI1PK", f"USER#{user_id}", "RESOURCE#")
    resource_count = len(user_resources)

    # 2. Downloads by user
    downloads_items = []
    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("DOWNLOAD#"),
            ScanIndexForward=False,
            Limit=20
        )
        downloads_items = res.get("Items", [])
    except Exception:
        pass
    downloads_count = len(downloads_items)

    # 3. Clubs (owned + joined)
    club_memberships = safe_query("GSI1", "GSI1PK", f"USER#{user_id}", "CLUB#")
    owned_clubs = [c for c in club_memberships if c.get("role") == "OWNER"]
    joined_clubs = [c for c in club_memberships if c.get("role") != "OWNER"]

    # 4. Quizzes created
    user_quizzes = safe_query("GSI1", "GSI1PK", f"USER#{user_id}", "QUIZ#")
    quizzes_created = len(user_quizzes)

    # 5. Quiz attempts
    attempts = safe_query("GSI1", "GSI1PK", f"USER#{user_id}", "ATTEMPT#")
    quizzes_completed = len(attempts)
    avg_score = 0.0
    if attempts:
        scores = [float(a.get("scorePercent", 0)) for a in attempts]
        avg_score = round(sum(scores) / len(scores), 1)

    # 6. User stats record (lightweight aggregate)
    stats_item = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "STATS"}).get("Item", {})

    # 7. Recent activity (last 10 items from downloads + recent quizzes)
    recent_activity = []
    for d in downloads_items[:5]:
        recent_activity.append({
            "type": "DOWNLOAD",
            "resourceId": d.get("resourceId"),
            "timestamp": d.get("downloadedAt")
        })
    for a in attempts[:5]:
        recent_activity.append({
            "type": "QUIZ_ATTEMPT",
            "quizId": a.get("quizId"),
            "score": float(a.get("scorePercent", 0)),
            "timestamp": a.get("submittedAt")
        })
    recent_activity.sort(key=lambda x: (x.get("timestamp") or ""), reverse=True)

    # 8. Shared resources count (resources that have sharedClubs)
    shared_count = sum(1 for r in user_resources if r.get("sharedClubs"))

    return resp(200, {
        "userId": user_id,
        "resources": {
            "uploaded": resource_count,
            "downloaded": downloads_count,
            "shared": shared_count
        },
        "clubs": {
            "owned": len(owned_clubs),
            "joined": len(joined_clubs),
            "total": len(club_memberships)
        },
        "quizzes": {
            "created": quizzes_created,
            "completed": quizzes_completed,
            "averageScore": avg_score,
            "totalCorrect": int(stats_item.get("totalCorrect", 0)),
            "totalQuestionsAnswered": int(stats_item.get("totalQuestionsAnswered", 0))
        },
        "recentActivity": recent_activity[:10]
    })


def handle_get_profile(user_id, claims):
    # Get stored profile from DynamoDB
    profile = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}).get("Item", {})
    return resp(200, {
        "userId": user_id,
        "name": profile.get("name") or claims.get("name") or claims.get("email", ""),
        "email": profile.get("email") or claims.get("email", ""),
        "course": profile.get("course", ""),
        "semester": profile.get("semester", ""),
        "bio": profile.get("bio", ""),
        "avatarUrl": profile.get("avatarUrl", ""),
        "createdAt": profile.get("createdAt", ""),
        "updatedAt": profile.get("updatedAt", "")
    })


def handle_update_profile(event, user_id, claims):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})

    allowed_fields = {"name", "course", "semester", "bio", "avatarUrl"}
    updates = {k: v for k, v in body.items() if k in allowed_fields and isinstance(v, str)}
    if not updates:
        return resp(400, {"error": "No valid fields to update"})

    now = datetime.now(timezone.utc).isoformat()
    existing = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}).get("Item", {})

    profile_item = {
        "PK": f"USER#{user_id}",
        "SK": "PROFILE",
        "entityType": "USER",
        "userId": user_id,
        "email": existing.get("email") or claims.get("email", ""),
        "createdAt": existing.get("createdAt", now),
        "updatedAt": now,
        **{k: existing.get(k, "") for k in ["name", "course", "semester", "bio", "avatarUrl"]},
        **updates
    }
    table.put_item(Item=profile_item)
    return resp(200, {"message": "Profile updated", "profile": profile_item})


def lambda_handler(event, context):
    try:
        claims = get_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return resp(401, {"error": "Unauthorized"})
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path   = event.get("requestContext", {}).get("http", {}).get("path", "")

        if method == "GET" and path == "/dashboard":
            return handle_dashboard(user_id)
        if method == "GET" and path == "/profile":
            return handle_get_profile(user_id, claims)
        if method == "PUT" and path == "/profile":
            return handle_update_profile(event, user_id, claims)

        return resp(404, {"error": f"Route not found: {method} {path}"})
    except Exception as e:
        return resp(500, {"error": "Internal server error", "detail": str(e)})
