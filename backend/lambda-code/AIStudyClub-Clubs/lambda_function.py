import json
import os
import random
import string
import uuid
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
table_name = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(table_name)

sns = boto3.client("sns", region_name="ap-south-1")
SNS_TOPIC_ARN = os.environ.get("SNS_TOPIC_ARN", "")

cognito = boto3.client("cognito-idp", region_name="ap-south-1")
USER_POOL_ID = os.environ.get("USER_POOL_ID", "ap-south-1_mmcevaMYP")

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

def generate_join_code():
    """Generate a unique 6-digit numeric join code."""
    for _ in range(10):
        code = "".join(random.choices(string.digits, k=6))
        if code.startswith("0"):
            code = "1" + code[1:]
        existing = table.get_item(Key={"PK": f"CODE#{code}", "SK": "METADATA"}).get("Item")
        if not existing:
            return code
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

def resolve_club(identifier):
    """
    Resolve club by clubId or joinCode.
    Returns (club_item, actual_club_id) or (None, None).
    """
    clean_id = (identifier or "").strip().upper()
    if not clean_id or clean_id == "LEAVE":
        return None, None

    # 1. Try direct PK: CLUB#{clean_id}
    club = table.get_item(Key={"PK": f"CLUB#{clean_id}", "SK": "METADATA"}).get("Item")
    if club:
        return club, club.get("clubId", clean_id)

    # 2. Try CODE#{clean_id} lookup
    code_lookup = table.get_item(Key={"PK": f"CODE#{clean_id}", "SK": "METADATA"}).get("Item")
    if code_lookup and code_lookup.get("clubId"):
        cid = code_lookup["clubId"]
        club = table.get_item(Key={"PK": f"CLUB#{cid}", "SK": "METADATA"}).get("Item")
        if club:
            return club, cid

    # 3. Fallback scan for joinCode attribute
    try:
        res = table.scan(FilterExpression=Attr("joinCode").eq(clean_id) | Attr("joinCode6").eq(clean_id))
        items = res.get("Items", [])
        if items:
            return items[0], items[0].get("clubId")
    except Exception:
        pass

    return None, None

def now_iso():
    return datetime.now(timezone.utc).isoformat()

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

def get_user_email(user_id):
    """Resolve a user's registered email from Cognito (trusted server-side data).

    Never trust an email address supplied by the frontend. Returns "" when the
    user cannot be resolved.
    """
    if not user_id:
        return ""
    try:
        res = cognito.list_users(
            UserPoolId=USER_POOL_ID,
            Filter=f'sub = "{user_id}"',
            Limit=1
        )
        users = res.get("Users", [])
        if users:
            attrs = {a["Name"]: a["Value"] for a in users[0].get("Attributes", [])}
            return (attrs.get("email") or "").strip().lower()
    except Exception as exc:
        print(f"Could not resolve email for user {user_id}: {exc}")
    return ""


def publish_social_notification(notification_type, payload):
    """Best-effort SNS publish for social events (group invitations only here).

    A publishing failure is logged and swallowed so it can never undo an
    already-saved group invitation. The recipient email is resolved server-side
    (from Cognito via get_user_email) and carried both in the body and as a
    ``recipient_email`` message attribute that the SNS email subscription
    filters on - the frontend never supplies the address.
    """
    if not SNS_TOPIC_ARN:
        return False
    try:
        payload = payload or {}
        recipient_email = (payload.get("recipientEmail") or "").strip().lower()

        if notification_type in ("CLUB_INVITATION", "CLUB_INVITE"):
            subject = "New study group invitation on AI StudyClub"
            sender_name = payload.get("senderName") or "A group member"
            club_name = payload.get("clubName") or "a study group"
            body = (
                f"{sender_name} invited you to join the study group "
                f"\"{club_name}\" on AI StudyClub.\n\n"
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

def get_member(club_id, user_id):
    return table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}).get("Item")

def is_club_admin(club, club_id, user_id):
    member = get_member(club_id, user_id)
    if not member:
        return False
    role = (member.get("role") or "MEMBER").upper()
    return role in ("OWNER", "ADMIN") or club.get("createdBy") == user_id

def handle_delete_club(event, club, club_id, user_id):
    """DELETE /clubs/{clubId} -- soft-delete (archive) a study club.

    Only the group owner or an admin may delete. Records (members, messages,
    shared resources) are preserved; the club is hidden from listings.
    """
    if not is_club_admin(club, club_id, user_id):
        return response(403, {"error": "Forbidden: Only the group owner or an admin can delete this group"})
    if (club.get("status") or "ACTIVE").upper() == "ARCHIVED":
        return response(409, {"error": "This study group has already been deleted"})

    now = now_iso()
    table.update_item(
        Key={"PK": f"CLUB#{club_id}", "SK": "METADATA"},
        UpdateExpression="SET #s = :archived, deleted = :true, deletedAt = :now, deletedBy = :uid",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={
            ":archived": "ARCHIVED",
            ":true": True,
            ":now": now,
            ":uid": user_id,
        }
    )
    return response(200, {
        "message": "Study group deleted successfully",
        "clubId": club_id,
        "archived": True
    })

def handle_club_invite(event, club, club_id, user_id, user_name):
    """POST /clubs/{clubId}/invites -- invite a registered user to the club."""
    if not is_club_admin(club, club_id, user_id):
        return response(403, {"error": "Forbidden: Only the group owner or an admin can invite members"})

    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return response(400, {"error": "Invalid JSON body"})

    target_id = (body.get("userId") or "").strip()
    target_name = (body.get("userName") or "").strip()
    if not target_id:
        return response(400, {"error": "Validation error: 'userId' is required"})
    if target_id == user_id:
        return response(400, {"error": "Validation error: Cannot invite yourself"})

    if get_member(club_id, target_id):
        return response(409, {"error": "This user is already a member of the study club"})

    if table.get_item(Key={"PK": f"CLUB#{club_id}", "SK": f"INVITE#{target_id}"}).get("Item"):
        return response(409, {"error": "An invitation has already been sent to this user"})

    now = now_iso()
    club_name = club.get("name", "")
    table.put_item(Item={
        "PK": f"CLUB#{club_id}",
        "SK": f"INVITE#{target_id}",
        "entityType": "CLUB_INVITE",
        "clubId": club_id,
        "clubName": club_name,
        "clubSubject": club.get("subject", ""),
        "invitedUserId": target_id,
        "invitedUserName": target_name or target_id,
        "invitedBy": user_id,
        "invitedByName": user_name,
        "status": "PENDING",
        "createdAt": now
    })
    table.put_item(Item={
        "PK": f"USER#{target_id}",
        "SK": f"CLUB_INVITE#{club_id}",
        "entityType": "USER_CLUB_INVITE",
        "clubId": club_id,
        "clubName": club_name,
        "clubSubject": club.get("subject", ""),
        "invitedBy": user_id,
        "invitedByName": user_name,
        "status": "PENDING",
        "createdAt": now
    })
    create_notification(
        target_id, "CLUB_INVITE", "New Study Group Invitation",
        f"{user_name} invited you to join {club_name}.",
        {"clubId": club_id, "clubName": club_name, "invitedByName": user_name}
    )

    # Best-effort SNS publish for the social event. Failure must not undo the
    # invitation that has already been persisted above. The recipient email is
    # looked up from trusted server-side data (Cognito), never from the request.
    publish_social_notification("CLUB_INVITATION", {
        "senderId": user_id,
        "senderName": user_name,
        "recipientId": target_id,
        "recipientEmail": get_user_email(target_id),
        "clubId": club_id,
        "clubName": club_name,
    })

    return response(201, {"message": "Invitation sent", "clubId": club_id, "userId": target_id})

def handle_list_club_invites(club, club_id, user_id):
    """GET /clubs/{clubId}/invites -- list pending invites (admin/owner only)."""
    if not is_club_admin(club, club_id, user_id):
        return response(403, {"error": "Forbidden: Only the group owner or an admin can view invitations"})

    res = table.query(
        KeyConditionExpression=Key("PK").eq(f"CLUB#{club_id}") & Key("SK").begins_with("INVITE#")
    )
    invites = [{
        "userId": i.get("invitedUserId"),
        "name": i.get("invitedUserName", ""),
        "invitedByName": i.get("invitedByName", ""),
        "status": i.get("status", "PENDING"),
        "createdAt": i.get("createdAt", "")
    } for i in res.get("Items", [])]
    return response(200, {"invites": invites, "count": len(invites)})

def handle_list_my_invites(user_id):
    """GET /club-invites -- invitations addressed to the current user."""
    res = table.query(
        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("CLUB_INVITE#")
    )
    invites = []
    for i in res.get("Items", []):
        invites.append({
            "clubId": i.get("clubId"),
            "clubName": i.get("clubName", "Study Club"),
            "clubSubject": i.get("clubSubject", ""),
            "invitedBy": i.get("invitedBy"),
            "invitedByName": i.get("invitedByName", ""),
            "status": i.get("status", "PENDING"),
            "createdAt": i.get("createdAt", "")
        })
    return response(200, {"invites": invites, "count": len(invites)})

def handle_accept_invite(event, user_id, user_name):
    """POST /club-invites/accept -- accept an invitation, creating real membership."""
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return response(400, {"error": "Invalid JSON body"})

    club_id = (body.get("clubId") or "").strip()
    if not club_id:
        return response(400, {"error": "Validation error: 'clubId' is required"})

    club, actual_cid = resolve_club(club_id)
    if not club or not actual_cid:
        return response(404, {"error": "Study club not found"})

    invite = table.get_item(Key={"PK": f"CLUB#{actual_cid}", "SK": f"INVITE#{user_id}"}).get("Item")
    if not invite:
        return response(404, {"error": "Invitation not found or already handled"})

    now = now_iso()
    if not get_member(actual_cid, user_id):
        table.put_item(Item={
            "PK": f"CLUB#{actual_cid}",
            "SK": f"MEMBER#{user_id}",
            "entityType": "CLUB_MEMBER",
            "clubId": actual_cid,
            "userId": user_id,
            "userName": user_name,
            "role": "MEMBER",
            "joinedAt": now,
            "GSI1PK": f"USER#{user_id}",
            "GSI1SK": f"CLUB#{actual_cid}",
            "clubName": club.get("name", ""),
            "clubSubject": club.get("subject", "")
        })
        table.put_item(Item={
            "PK": f"USER#{user_id}",
            "SK": f"CLUB#{actual_cid}",
            "entityType": "USER_CLUB",
            "userId": user_id,
            "clubId": actual_cid,
            "role": "MEMBER",
            "clubName": club.get("name", ""),
            "clubSubject": club.get("subject", ""),
            "joinedAt": now
        })
        table.update_item(
            Key={"PK": f"CLUB#{actual_cid}", "SK": "METADATA"},
            UpdateExpression="SET memberCount = if_not_exists(memberCount, :zero) + :one",
            ExpressionAttributeValues={":zero": 0, ":one": 1}
        )

    table.delete_item(Key={"PK": f"CLUB#{actual_cid}", "SK": f"INVITE#{user_id}"})
    table.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"CLUB_INVITE#{actual_cid}"})

    create_notification(
        invite.get("invitedBy"), "CLUB_INVITE_ACCEPTED", "Invitation Accepted",
        f"{user_name} joined {club.get('name', 'your study group')}.",
        {"clubId": actual_cid, "clubName": club.get("name", ""), "userId": user_id}
    )
    return response(200, {"message": "Joined study club successfully", "clubId": actual_cid})

def handle_decline_invite(event, user_id):
    """POST /club-invites/decline -- decline an invitation."""
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return response(400, {"error": "Invalid JSON body"})

    club_id = (body.get("clubId") or "").strip()
    if not club_id:
        return response(400, {"error": "Validation error: 'clubId' is required"})

    club, actual_cid = resolve_club(club_id)
    if not club or not actual_cid:
        return response(404, {"error": "Study club not found"})

    invite = table.get_item(Key={"PK": f"CLUB#{actual_cid}", "SK": f"INVITE#{user_id}"}).get("Item")
    if not invite:
        return response(404, {"error": "Invitation not found or already handled"})

    table.delete_item(Key={"PK": f"CLUB#{actual_cid}", "SK": f"INVITE#{user_id}"})
    table.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"CLUB_INVITE#{actual_cid}"})
    return response(200, {"message": "Invitation declined", "clubId": actual_cid})

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
        # 1. CREATE CLUB: POST /clubs
        # -------------------------------------------------------------
        if method == "POST" and path == "/clubs":
            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return response(400, {"error": "Invalid JSON body"})

            name = (body.get("name") or "").strip()
            subject = (body.get("subject") or "").strip()
            description = (body.get("description") or "").strip()

            if not name or not subject:
                return response(400, {"error": "Validation error: 'name' and 'subject' are required"})

            if len(name) > 100:
                return response(400, {"error": "Validation error: 'name' cannot exceed 100 characters"})

            join_code = generate_join_code()
            club_id = join_code
            now = datetime.now(timezone.utc).isoformat()

            club_item = {
                "PK": f"CLUB#{club_id}",
                "SK": "METADATA",
                "entityType": "CLUB",
                "clubId": club_id,
                "joinCode": join_code,
                "name": name,
                "subject": subject,
                "description": description,
                "createdBy": user_id,
                "createdAt": now,
                "memberCount": 1
            }

            member_item = {
                "PK": f"CLUB#{club_id}",
                "SK": f"MEMBER#{user_id}",
                "entityType": "CLUB_MEMBER",
                "clubId": club_id,
                "userId": user_id,
                "userName": user_name,
                "role": "OWNER",
                "joinedAt": now,
                "GSI1PK": f"USER#{user_id}",
                "GSI1SK": f"CLUB#{club_id}",
                "clubName": name,
                "clubSubject": subject
            }

            code_lookup_item = {
                "PK": f"CODE#{join_code}",
                "SK": "METADATA",
                "entityType": "CLUB_CODE",
                "clubId": club_id,
                "createdAt": now
            }

            user_club_item = {
                "PK": f"USER#{user_id}",
                "SK": f"CLUB#{club_id}",
                "entityType": "USER_CLUB",
                "userId": user_id,
                "clubId": club_id,
                "role": "OWNER",
                "clubName": name,
                "clubSubject": subject,
                "joinedAt": now
            }

            table.put_item(Item=club_item)
            table.put_item(Item=member_item)
            table.put_item(Item=code_lookup_item)
            table.put_item(Item=user_club_item)

            return response(201, {
                "message": "Club created successfully",
                "clubId": club_id,
                "joinCode": join_code,
                "club": club_item
            })

        # -------------------------------------------------------------
        # 2. LIST CLUBS: GET /clubs
        # -------------------------------------------------------------
        if method == "GET" and path == "/clubs":
            owned_only = str(query_params.get("owned", query_params.get("mine", ""))).lower() in ("true", "1")
            code_query = query_params.get("code")

            if code_query:
                club, cid = resolve_club(code_query)
                if not club:
                    return response(404, {"error": "Study club not found with code"})
                return response(200, {"club": club})

            clubs_list = []
            try:
                res = table.query(
                    IndexName="GSI1",
                    KeyConditionExpression=Key("GSI1PK").eq(f"USER#{user_id}") & Key("GSI1SK").begins_with("CLUB#")
                )
                member_items = res.get("Items", [])
            except Exception:
                try:
                    res = table.query(
                        KeyConditionExpression=Key("PK").eq(f"USER#{user_id}") & Key("SK").begins_with("CLUB#")
                    )
                    member_items = res.get("Items", [])
                except Exception:
                    member_items = []

            for m in member_items:
                cid = m.get("clubId")
                role = m.get("role", "MEMBER")
                if owned_only and role != "OWNER":
                    continue

                if cid:
                    club_meta = table.get_item(Key={"PK": f"CLUB#{cid}", "SK": "METADATA"}).get("Item")
                    if club_meta and (club_meta.get("status") or "ACTIVE").upper() == "ARCHIVED":
                        continue
                    if club_meta:
                        club_copy = dict(club_meta)
                        club_copy["userRole"] = role
                        club_copy["joinedAt"] = m.get("joinedAt")
                        clubs_list.append(club_copy)
                    else:
                        clubs_list.append({
                            "clubId": cid,
                            "name": m.get("clubName", "Study Club"),
                            "subject": m.get("clubSubject", "General"),
                            "userRole": role,
                            "memberCount": 1
                        })

            return response(200, {
                "clubs": clubs_list,
                "count": len(clubs_list)
            })

        # -------------------------------------------------------------
        # 3. JOIN CLUB: POST /clubs/join
        # -------------------------------------------------------------
        if method == "POST" and path == "/clubs/join":
            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return response(400, {"error": "Invalid JSON body"})

            code_or_id = body.get("code") or body.get("clubId") or body.get("joinCode")
            if not code_or_id:
                return response(400, {"error": "Validation error: 'code' or 'clubId' is required"})

            club, club_id = resolve_club(code_or_id)
            if not club or not club_id:
                return response(404, {"error": "Study club not found with the provided code"})

            existing = table.get_item(
                Key={"PK": f"CLUB#{club_id}", "SK": f"MEMBER#{user_id}"}
            ).get("Item")

            if existing:
                return response(409, {
                    "error": "You are already a member of this study club",
                    "clubId": club_id
                })

            now = datetime.now(timezone.utc).isoformat()
            member_item = {
                "PK": f"CLUB#{club_id}",
                "SK": f"MEMBER#{user_id}",
                "entityType": "CLUB_MEMBER",
                "clubId": club_id,
                "userId": user_id,
                "userName": user_name,
                "role": "MEMBER",
                "joinedAt": now,
                "GSI1PK": f"USER#{user_id}",
                "GSI1SK": f"CLUB#{club_id}",
                "clubName": club.get("name", ""),
                "clubSubject": club.get("subject", "")
            }

            user_club_item = {
                "PK": f"USER#{user_id}",
                "SK": f"CLUB#{club_id}",
                "entityType": "USER_CLUB",
                "userId": user_id,
                "clubId": club_id,
                "role": "MEMBER",
                "clubName": club.get("name", ""),
                "clubSubject": club.get("subject", ""),
                "joinedAt": now
            }

            table.put_item(Item=member_item)
            table.put_item(Item=user_club_item)

            table.update_item(
                Key={"PK": f"CLUB#{club_id}", "SK": "METADATA"},
                UpdateExpression="SET memberCount = if_not_exists(memberCount, :zero) + :one",
                ExpressionAttributeValues={":zero": 0, ":one": 1}
            )

            return response(200, {
                "message": "Joined club successfully",
                "clubId": club_id,
                "clubName": club.get("name")
            })

        # -------------------------------------------------------------
        # 4. LEAVE CLUB: POST /clubs/leave or POST /clubs/{clubId}/leave
        # -------------------------------------------------------------
        if method == "POST" and (path == "/clubs/leave" or path.endswith("/leave")):
            club_id = None
            if path.startswith("/clubs/") and path.endswith("/leave") and path != "/clubs/leave":
                club_id = path.split("/")[2]
            else:
                try:
                    body = json.loads(event.get("body") or "{}")
                    club_id = body.get("clubId") or body.get("code") or body.get("joinCode")
                except Exception:
                    pass

            if not club_id:
                return response(400, {"error": "Validation error: 'clubId' is required"})

            club, actual_cid = resolve_club(club_id)
            if not club or not actual_cid:
                return response(404, {"error": "Study club not found"})

            # Check membership
            member = table.get_item(
                Key={"PK": f"CLUB#{actual_cid}", "SK": f"MEMBER#{user_id}"}
            ).get("Item")

            if not member:
                return response(400, {"error": "You are not a member of this study club"})

            # Prevent owner from accidentally leaving
            if member.get("role") == "OWNER" or club.get("createdBy") == user_id:
                return response(400, {
                    "error": "Group owners cannot leave their own group. Please transfer ownership or delete the group."
                })

            # Delete membership records
            table.delete_item(Key={"PK": f"CLUB#{actual_cid}", "SK": f"MEMBER#{user_id}"})
            table.delete_item(Key={"PK": f"USER#{user_id}", "SK": f"CLUB#{actual_cid}"})

            # Atomically decrement memberCount, ensuring it does not drop below 1
            try:
                table.update_item(
                    Key={"PK": f"CLUB#{actual_cid}", "SK": "METADATA"},
                    UpdateExpression="SET memberCount = memberCount - :one",
                    ConditionExpression="memberCount > :one_val",
                    ExpressionAttributeValues={":one": 1, ":one_val": 1}
                )
            except ClientError:
                pass

            return response(200, {
                "message": "Successfully left the study club",
                "clubId": actual_cid
            })

        # -------------------------------------------------------------
        # 5. GET GROUP RESOURCES: GET /clubs/{clubId}/resources
        # -------------------------------------------------------------
        if method == "GET" and path.startswith("/clubs/") and path.endswith("/resources"):
            club_id = path.split("/")[2]
            club, actual_cid = resolve_club(club_id)
            if not club or not actual_cid:
                return response(404, {"error": "Study club not found"})

            member = table.get_item(
                Key={"PK": f"CLUB#{actual_cid}", "SK": f"MEMBER#{user_id}"}
            ).get("Item")
            if not member:
                return response(403, {"error": "Forbidden: You must be a member of this study club to view its resources"})

            res = table.query(
                KeyConditionExpression=Key("PK").eq(f"CLUB#{actual_cid}") & Key("SK").begins_with("RESOURCE#")
            )
            shared_items = res.get("Items", [])

            resources_list = []
            for item in shared_items:
                rid = item.get("resourceId")
                meta = table.get_item(Key={"PK": f"RESOURCE#{rid}", "SK": "METADATA"}).get("Item")
                entry = dict(meta if meta else item)
                # Access flags for the requesting user, derived from verified
                # identity and persisted metadata (never from client input).
                entry["isOwner"] = bool(entry.get("ownerId")) and entry.get("ownerId") == user_id
                try:
                    entry["saved"] = table.get_item(
                        Key={"PK": f"USER#{user_id}", "SK": f"SAVED#{rid}"}
                    ).get("Item") is not None
                except Exception:
                    entry["saved"] = False
                resources_list.append(entry)

            return response(200, {
                "clubId": actual_cid,
                "resources": resources_list,
                "count": len(resources_list)
            })

        # -------------------------------------------------------------
        # 6. SHARE RESOURCE WITH GROUP: POST /clubs/{clubId}/resources
        # -------------------------------------------------------------
        if method == "POST" and path.startswith("/clubs/") and path.endswith("/resources"):
            club_id = path.split("/")[2]
            club, actual_cid = resolve_club(club_id)
            if not club or not actual_cid:
                return response(404, {"error": "Study club not found"})

            member = table.get_item(
                Key={"PK": f"CLUB#{actual_cid}", "SK": f"MEMBER#{user_id}"}
            ).get("Item")
            if not member:
                return response(403, {"error": "Forbidden: You must be a member of this study club to share resources to it"})

            try:
                body = json.loads(event.get("body") or "{}")
            except Exception:
                return response(400, {"error": "Invalid JSON body"})

            resource_id = (body.get("resourceId") or "").strip()
            if not resource_id:
                return response(400, {"error": "Validation error: 'resourceId' is required"})

            resource = table.get_item(Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"}).get("Item")
            if not resource:
                return response(404, {"error": "Resource not found"})

            owner_id = resource.get("ownerId")
            uploaded_by = resource.get("uploadedBy")
            visibility = (resource.get("visibility") or "PUBLIC").upper()

            is_owner = (owner_id and owner_id == user_id) or (uploaded_by and uploaded_by == user_id)
            if not is_owner and visibility == "PRIVATE":
                return response(403, {"error": "Forbidden: You cannot share a private resource you do not own"})

            now = datetime.now(timezone.utc).isoformat()
            club_resource_item = {
                "PK": f"CLUB#{actual_cid}",
                "SK": f"RESOURCE#{resource_id}",
                "entityType": "CLUB_RESOURCE",
                "clubId": actual_cid,
                "resourceId": resource_id,
                "title": resource.get("title", ""),
                "subject": resource.get("subject", ""),
                "type": resource.get("type", "Notes"),
                "s3Key": resource.get("s3Key", ""),
                "sharedBy": user_id,
                "sharedAt": now
            }
            table.put_item(Item=club_resource_item)

            try:
                table.update_item(
                    Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"},
                    UpdateExpression="SET sharedClubs = list_append(if_not_exists(sharedClubs, :empty_list), :new_club)",
                    ExpressionAttributeValues={
                        ":empty_list": [],
                        ":new_club": [actual_cid]
                    }
                )
            except Exception:
                pass

            return response(201, {
                "message": "Resource shared with study club successfully",
                "clubId": actual_cid,
                "resourceId": resource_id
            })

        # -------------------------------------------------------------
        # 7. CLUB INVITATIONS
        # -------------------------------------------------------------
        if path.startswith("/clubs/") and path.endswith("/invites"):
            club_id = path.split("/")[2]
            club, actual_cid = resolve_club(club_id)
            if not club or not actual_cid:
                return response(404, {"error": "Study club not found"})
            if method == "POST":
                return handle_club_invite(event, club, actual_cid, user_id, user_name)
            if method == "GET":
                return handle_list_club_invites(club, actual_cid, user_id)

        if method == "GET" and path == "/club-invites":
            return handle_list_my_invites(user_id)

        if method == "POST" and path == "/club-invites/accept":
            return handle_accept_invite(event, user_id, user_name)

        if method == "POST" and path == "/club-invites/decline":
            return handle_decline_invite(event, user_id)

        # -------------------------------------------------------------
        # 7b. DELETE / ARCHIVE CLUB: DELETE /clubs/{clubId}
        # -------------------------------------------------------------
        if method == "DELETE" and path.startswith("/clubs/"):
            parts = path.strip("/").split("/")
            club_id = parts[1] if len(parts) > 1 else ""
            club, actual_cid = resolve_club(club_id)
            if not club or not actual_cid:
                return response(404, {"error": "Study club not found"})
            return handle_delete_club(event, club, actual_cid, user_id)

        # -------------------------------------------------------------
        # 8. GET CLUB DETAILS: GET /clubs/{clubId}
        # -------------------------------------------------------------
        if method == "GET" and path.startswith("/clubs/"):
            club_id = path.split("/")[-1]
            club, actual_cid = resolve_club(club_id)
            if not club or not actual_cid:
                return response(404, {"error": "Club not found"})
            if (club.get("status") or "ACTIVE").upper() == "ARCHIVED":
                return response(404, {"error": "Club not found"})

            res = table.query(
                KeyConditionExpression=Key("PK").eq(f"CLUB#{actual_cid}") & Key("SK").begins_with("MEMBER#")
            )
            members = res.get("Items", [])

            user_member = next((m for m in members if m.get("userId") == user_id), None)
            is_member = user_member is not None
            user_role = user_member.get("role") if user_member else None

            return response(200, {
                "club": club,
                "members": members,
                "isMember": is_member,
                "userRole": user_role
            })

        return response(404, {"error": f"Route not found: {method} {path}"})

    except Exception as e:
        return response(500, {"error": "Internal server error occurred in clubs service"})