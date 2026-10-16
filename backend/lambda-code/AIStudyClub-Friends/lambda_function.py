"""
AIStudyClub-Friends -- Phase 6
Routes:
  GET    /users/search              - Search users by name/email (no sensitive data)
  POST   /friends/request           - Send friend request
  POST   /friends/accept            - Accept friend request
  POST   /friends/reject            - Reject friend request
  DELETE /friends/{friendId}        - Remove a friend
  GET    /friends                   - List confirmed friends
  GET    /friends/requests          - List pending incoming requests
"""
import json
import os
import uuid
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

sns = boto3.client("sns", region_name="ap-south-1")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS"
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


def now_iso():
    return datetime.now(timezone.utc).isoformat()


_USER_INFO_CACHE = {}


def get_user_info(user_id):
    """Resolve a user's display name/email from DynamoDB PROFILE, falling back to Cognito."""
    if not user_id:
        return {"userId": user_id, "name": "", "email": ""}
    if user_id in _USER_INFO_CACHE:
        return _USER_INFO_CACHE[user_id]

    info = {"userId": user_id, "name": "", "email": ""}
    try:
        profile = table.get_item(Key={"PK": f"USER#{user_id}", "SK": "PROFILE"}).get("Item", {})
        info["name"] = profile.get("name", "")
        info["email"] = profile.get("email", "")
    except Exception:
        pass

    if not info["name"] or not info["email"]:
        try:
            res = cognito.list_users(UserPoolId=USER_POOL_ID, Filter=f'sub = "{user_id}"', Limit=1)
            users = res.get("Users", [])
            if users:
                attrs = {a["Name"]: a["Value"] for a in users[0].get("Attributes", [])}
                info["name"] = info["name"] or attrs.get("name", attrs.get("email", ""))
                info["email"] = info["email"] or attrs.get("email", "")
        except Exception:
            pass

    if not info["name"]:
        info["name"] = user_id
    _USER_INFO_CACHE[user_id] = info
    return info



def create_notification(to_user_id, notif_type, title, message, meta=None):
    """Helper: create a notification record for another user."""
    try:
        notif_id = str(uuid.uuid4())
        now = now_iso()
        table.put_item(Item={
            "PK": f"USER#{to_user_id}",
            "SK": f"NOTIF#{now}#{notif_id}",
            "entityType": "NOTIFICATION",
            "notificationId": notif_id,
            "userId": to_user_id,
            "type": notif_type,
            "title": title,
            "message": message,
            "read": False,
            "createdAt": now,
            "meta": meta or {},
            "GSI1PK": f"USER#{to_user_id}",
            "GSI1SK": f"NOTIF#{now}"
        })
    except Exception:
        pass


def publish_social_notification(notification_type, payload):
    """Best-effort SNS publish for social events (friend requests only here).

    A publishing failure is logged and swallowed so it can never undo an
    already-saved friend request. The recipient email is resolved server-side
    (from Cognito via get_user_info) and carried both in the body and as a
    ``recipient_email`` message attribute that the SNS email subscription
    filters on - the frontend never supplies the address.
    """
    if not SNS_TOPIC_ARN:
        return False
    try:
        payload = payload or {}
        recipient_email = (payload.get("recipientEmail") or "").strip().lower()

        if notification_type == "FRIEND_REQUEST":
            subject = "New friend request on AI StudyClub"
            sender_name = payload.get("senderName") or "A user"
            body = (
                f"{sender_name} sent you a friend request on AI StudyClub.\n\n"
                "Sign in to accept or decline."
            )
        else:
            subject = f"AI StudyClub social notification: {notification_type}"
            message = {"type": notification_type}
            message.update(payload)
            body = json.dumps(message, default=str)

        kwargs = {
            "TopicArn": SNS_TOPIC_ARN,
            "Subject": subject,
            "Message": body,
        }
        if recipient_email:
            kwargs["MessageAttributes"] = {
                "recipient_email": {
                    "DataType": "String",
                    "StringValue": recipient_email,
                }
            }
        sns.publish(**kwargs)
        return True
    except Exception as exc:
        print(f"SNS publish failed for {notification_type}: {exc}")
        return False


def handle_search_users(event, user_id):
    query_params = event.get("queryStringParameters") or {}
    query = (query_params.get("q") or query_params.get("query") or "").strip()
    if not query or len(query) < 2:
        return resp(400, {"error": "Validation error: 'q' query param must be at least 2 characters"})

    results = []
    try:
        # Search Cognito user pool
        cog_res = cognito.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'email ^= "{query}"',
            Limit=10
        )
        for u in cog_res.get("Users", []):
            attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
            uid = attrs.get("sub")
            if uid and uid != user_id:
                results.append({
                    "userId": uid,
                    "name": attrs.get("name", attrs.get("email", "")),
                    "email": attrs.get("email", ""),
                    "registrationNumber": attrs.get("custom:registrationNumber") or attrs.get("preferred_username", "")
                })
    except Exception:
        pass

    # Also try searching by name prefix in Cognito
    if len(results) < 5:
        try:
            cog_res2 = cognito.list_users(
                UserPoolId=USER_POOL_ID,
                Filter=f'name ^= "{query}"',
                Limit=10
            )
            existing_ids = {r["userId"] for r in results}
            for u in cog_res2.get("Users", []):
                attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
                uid = attrs.get("sub")
                if uid and uid != user_id and uid not in existing_ids:
                    results.append({
                        "userId": uid,
                        "name": attrs.get("name", attrs.get("email", "")),
                        "email": attrs.get("email", ""),
                        "registrationNumber": attrs.get("custom:registrationNumber") or attrs.get("preferred_username", "")
                    })
                    existing_ids.add(uid)
        except Exception:
            pass

    # Also allow searching by registration number.
    # Cognito custom attributes are not filterable on this pool, so the
    # searchable registration identifier is stored in the standard
    # (filterable) preferred_username attribute, with custom:registrationNumber
    # kept as the canonical value.
    if len(results) < 5:
        try:
            cog_res3 = cognito.list_users(
                UserPoolId=USER_POOL_ID,
                Filter=f'preferred_username ^= "{query}"',
                Limit=10
            )
            existing_ids = {r["userId"] for r in results}
            for u in cog_res3.get("Users", []):
                attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
                uid = attrs.get("sub")
                if uid and uid != user_id and uid not in existing_ids:
                    results.append({
                        "userId": uid,
                        "name": attrs.get("name", attrs.get("email", "")),
                        "email": attrs.get("email", ""),
                        "registrationNumber": attrs.get("custom:registrationNumber") or attrs.get("preferred_username", "")
                    })
                    existing_ids.add(uid)
        except Exception:
            pass

    # Look up friendship status for each result
    for r in results:
        fid = r["userId"]
        # Check if already friends
        existing = table.get_item(Key={"PK": f"USER#{user_id}", "SK": f"FRIEND#{fid}"}).get("Item")
        if existing:
            r["friendStatus"] = existing.get("status", "CONFIRMED")
        else:
            # Check if request sent
            req_sent = table.get_item(Key={"PK": f"USER#{user_id}", "SK": f"FRIEND_REQ#{fid}"}).get("Item")
            req_recv = table.get_item(Key={"PK": f"USER#{fid}", "SK": f"FRIEND_REQ#{user_id}"}).get("Item")
            if req_sent:
                r["friendStatus"] = "REQUEST_SENT"
            elif req_recv:
                r["friendStatus"] = "REQUEST_RECEIVED"
            else:
                r["friendStatus"] = "NONE"

    return resp(200, {"users": results, "count": len(results)})


def handle_send_request(event, user_id, user_name):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})

    target_id = (body.get("userId") or "").strip()
    if not target_id:
        return resp(400, {"error": "Validation error: 'userId' is required"})
    if target_id == user_id:
        return resp(400, {"error": "Validation error: Cannot send friend request to yourself"})

    # Check duplicate
    existing_req = table.get_item(Key={"PK": f"USER#{user_id}", "SK": f"FRIEND_REQ#{target_id}"}).get("Item")
    if existing_req:
        return resp(409, {"error": "Friend request already sent"})

    existing_friend = table.get_item(Key={"PK": f"USER#{user_id}", "SK": f"FRIEND#{target_id}"}).get("Item")
    if existing_friend:
        return resp(409, {"error": "Already friends with this user"})

    # Check if there's a pending request FROM them (auto-accept scenario)
    reverse_req = table.get_item(Key={"PK": f"USER#{target_id}", "SK": f"FRIEND_REQ#{user_id}"}).get("Item")
    now = now_iso()

    if reverse_req:
        # Auto-accept mutual request
        table.delete_item(Key={"PK": f"USER#{target_id}", "SK": f"FRIEND_REQ#{user_id}"})
        for a, b in [(user_id, target_id), (target_id, user_id)]:
            table.put_item(Item={
                "PK": f"USER#{a}",
                "SK": f"FRIEND#{b}",
                "entityType": "FRIENDSHIP",
                "userId": a,
                "friendId": b,
                "status": "CONFIRMED",
                "since": now
            })
        return resp(200, {"message": "Friend request accepted (mutual request found)", "status": "CONFIRMED"})

    # Get target user name from DynamoDB or Cognito
    target_profile = table.get_item(Key={"PK": f"USER#{target_id}", "SK": "PROFILE"}).get("Item", {})
    target_name = target_profile.get("name") or target_id

    table.put_item(Item={
        "PK": f"USER#{user_id}",
        "SK": f"FRIEND_REQ#{target_id}",
        "entityType": "FRIEND_REQUEST",
        "fromUserId": user_id,
        "fromUserName": user_name,
        "toUserId": target_id,
        "status": "PENDING",
        "sentAt": now
    })
    # Mirror on receiver's partition for O(1) listing
    table.put_item(Item={
        "PK": f"USER#{target_id}",
        "SK": f"INCOMING_REQ#{user_id}",
        "entityType": "INCOMING_FRIEND_REQUEST",
        "fromUserId": user_id,
        "fromUserName": user_name,
        "toUserId": target_id,
        "status": "PENDING",
        "sentAt": now
    })

    # Notification to target
    create_notification(
        target_id,
        "FRIEND_REQUEST",
        "New Friend Request",
        f"{user_name} sent you a friend request.",
        {"fromUserId": user_id, "fromUserName": user_name}
    )

    # Best-effort SNS publish for the social event. Failure must not undo the
    # friend request that has already been persisted above. The recipient email
    # is looked up from trusted server-side data (Cognito/DynamoDB), never from
    # the request body.
    publish_social_notification("FRIEND_REQUEST", {
        "senderId": user_id,
        "senderName": user_name,
        "recipientId": target_id,
        "recipientEmail": get_user_info(target_id).get("email", ""),
    })

    return resp(200, {"message": "Friend request sent", "toUserId": target_id, "status": "PENDING"})


def handle_accept_request(event, user_id, user_name):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})

    from_id = (body.get("userId") or body.get("fromUserId") or "").strip()
    if not from_id:
        return resp(400, {"error": "Validation error: 'userId' is required"})

    req = table.get_item(Key={"PK": f"USER#{from_id}", "SK": f"FRIEND_REQ#{user_id}"}).get("Item")
    if not req:
        return resp(404, {"error": "Friend request not found"})

    from_name = req.get("fromUserName", from_id)
    now = now_iso()

    # Delete request records (both sides), create bidirectional friendship
    table.delete_item(Key={"PK": f"USER#{from_id}", "SK": f"FRIEND_REQ#{user_id}"})
    table.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"INCOMING_REQ#{from_id}"})
    for a, b in [(user_id, from_id), (from_id, user_id)]:
        table.put_item(Item={
            "PK": f"USER#{a}",
            "SK": f"FRIEND#{b}",
            "entityType": "FRIENDSHIP",
            "userId": a,
            "friendId": b,
            "status": "CONFIRMED",
            "since": now
        })

    create_notification(
        from_id,
        "FRIEND_ACCEPTED",
        "Friend Request Accepted",
        f"{user_name} accepted your friend request.",
        {"acceptedBy": user_id, "acceptedByName": user_name}
    )

    return resp(200, {"message": "Friend request accepted", "friendId": from_id, "status": "CONFIRMED"})


def handle_reject_request(event, user_id):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})

    from_id = (body.get("userId") or body.get("fromUserId") or "").strip()
    if not from_id:
        return resp(400, {"error": "Validation error: 'userId' is required"})

    req = table.get_item(Key={"PK": f"USER#{from_id}", "SK": f"FRIEND_REQ#{user_id}"}).get("Item")
    if not req:
        return resp(404, {"error": "Friend request not found"})

    table.delete_item(Key={"PK": f"USER#{from_id}", "SK": f"FRIEND_REQ#{user_id}"})
    table.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"INCOMING_REQ#{from_id}"})
    return resp(200, {"message": "Friend request rejected"})


def handle_list_friends(user_id):
    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("FRIEND#"),
            Limit=100
        )
        items = res.get("Items", [])
    except Exception:
        items = []

    friends = []
    for item in items:
        fid = item.get("friendId") or item.get("SK", "").replace("FRIEND#", "")
        uinfo = get_user_info(fid)
        friends.append({
            "userId": fid,
            "name": uinfo.get("name", fid),
            "email": uinfo.get("email", ""),
            "since": item.get("since", "")
        })

    return resp(200, {"friends": friends, "count": len(friends)})


def handle_list_requests(event, user_id):
    """List friend requests for the current user.

    ?type=incoming (default): requests TO this user FROM others.
    ?type=outgoing: requests FROM this user that are still pending.
    """
    query_params = event.get("queryStringParameters") or {}
    req_type = (query_params.get("type") or "incoming").lower()

    if req_type == "outgoing":
        try:
            res = table.query(
                KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("FRIEND_REQ#"),
                Limit=50
            )
            items = res.get("Items", [])
        except Exception:
            items = []

        requests = []
        for item in items:
            target_id = item.get("toUserId") or item.get("SK", "").replace("FRIEND_REQ#", "")
            uinfo = get_user_info(target_id)
            requests.append({
                "toUserId": target_id,
                "toUserName": uinfo.get("name", target_id),
                "toUserEmail": uinfo.get("email", ""),
                "sentAt": item.get("sentAt", ""),
                "status": item.get("status", "PENDING")
            })
        return resp(200, {"requests": requests, "count": len(requests), "type": "outgoing"})

    """List incoming friend requests (requests TO this user FROM others)."""
    try:
        # Query INCOMING_REQ# on receiver's partition (stored when send_request is called)
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("INCOMING_REQ#"),
            Limit=50
        )
        items = res.get("Items", [])
    except Exception:
        # Fallback: scan with filter for backwards-compat
        try:
            res = table.scan(
                FilterExpression=Attr("entityType").eq("FRIEND_REQUEST") & Attr("toUserId").eq(user_id),
                Limit=50
            )
            items = res.get("Items", [])
        except Exception:
            items = []

    requests = [{
        "fromUserId": item.get("fromUserId"),
        "fromUserName": item.get("fromUserName", ""),
        "sentAt": item.get("sentAt", ""),
        "status": "PENDING"
    } for item in items]

    return resp(200, {"requests": requests, "count": len(requests)})


def handle_remove_friend(event, user_id, friend_id):
    if not friend_id or friend_id == user_id:
        return resp(400, {"error": "Invalid friendId"})
    existing = table.get_item(Key={"PK": f"USER#{user_id}", "SK": f"FRIEND#{friend_id}"}).get("Item")
    if not existing:
        return resp(404, {"error": "Friendship not found"})
    table.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"FRIEND#{friend_id}"})
    table.delete_item(Key={"PK": f"USER#{friend_id}", "SK": f"FRIEND#{user_id}"})
    return resp(200, {"message": "Friend removed"})


def lambda_handler(event, context):
    try:
        claims = get_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return resp(401, {"error": "Unauthorized"})
        user_name = claims.get("name") or claims.get("email") or claims.get("cognito:username") or user_id
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path   = event.get("requestContext", {}).get("http", {}).get("path", "")
        path_parts = path.strip("/").split("/")

        if method == "GET" and path == "/users/search":
            return handle_search_users(event, user_id)
        if method == "POST" and path == "/friends/request":
            return handle_send_request(event, user_id, user_name)
        if method == "POST" and path == "/friends/accept":
            return handle_accept_request(event, user_id, user_name)
        if method == "POST" and path == "/friends/reject":
            return handle_reject_request(event, user_id)
        if method == "GET" and path == "/friends":
            return handle_list_friends(user_id)
        if method == "GET" and path == "/friends/requests":
            return handle_list_requests(event, user_id)
        if method == "DELETE" and len(path_parts) == 2 and path_parts[0] == "friends":
            return handle_remove_friend(event, user_id, path_parts[1])

        return resp(404, {"error": f"Route not found: {method} {path}"})
    except Exception as e:
        return resp(500, {"error": "Internal server error", "detail": str(e)})
