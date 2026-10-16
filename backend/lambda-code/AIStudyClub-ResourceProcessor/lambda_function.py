"""AIStudyClub-ResourceProcessor

Lightweight SQS consumer for resource processing. Invoked by the
AIStudyClub-ResourceProcessing queue after a resource upload has already been
persisted to DynamoDB by AIStudyClub-CreateResource.

It validates the stored resource metadata and updates a single
`processingStatus` attribute. No AI pipelines, PDF extraction, or extra
workflows are performed - this stays cheap and independent of the upload path.
"""
import json
import os
import boto3
from datetime import datetime, timezone

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
TABLE_NAME = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(TABLE_NAME)


def _handle_record(record):
    try:
        body = json.loads(record.get("body") or "{}")
    except (ValueError, TypeError):
        print("Skipping record with invalid JSON body")
        return False

    if body.get("type") != "RESOURCE_PROCESS":
        print(f"Ignoring unsupported message type: {body.get('type')}")
        return False

    resource_id = body.get("resourceId")
    if not resource_id:
        print("Skipping record without resourceId")
        return False

    item = table.get_item(
        Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"}
    ).get("Item")

    now = datetime.now(timezone.utc).isoformat()

    if not item:
        print(f"Resource metadata not found for {resource_id}; nothing to update")
        return False

    required = ("title", "s3Key", "ownerId")
    valid = all(bool(item.get(field)) for field in required)
    status = "PROCESSED" if valid else "INVALID"

    table.update_item(
        Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"},
        UpdateExpression="SET processingStatus = :s, processedAt = :t",
        ExpressionAttributeValues={":s": status, ":t": now},
    )
    print(f"Resource {resource_id} processing status set to {status}")
    return True


def lambda_handler(event, context):
    processed = 0
    for record in event.get("Records", []):
        if _handle_record(record):
            processed += 1
    return {"processed": processed, "total": len(event.get("Records", []))}
