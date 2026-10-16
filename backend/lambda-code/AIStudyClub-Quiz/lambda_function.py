"""
AIStudyClub-Quiz -- Phase 4: Quiz Engine
Routes:
  POST /quiz/generate        - Generate MCQ quiz from selected resource file(s)
  GET  /quiz                 - List user's saved quizzes
  GET  /quiz/{quizId}        - Get quiz questions (no answer keys for non-owners)
  POST /quiz/{quizId}/submit - Submit answers; calculate + store score server-side
  GET  /quiz/{quizId}/result - Get attempt results for authenticated user
"""

import json
import os
import re
import uuid
import boto3
import io
from datetime import datetime, timezone
from decimal import Decimal
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb", region_name="ap-south-1")
TABLE_NAME = os.environ.get("TABLE_NAME", "AIStudyClub")
table = dynamodb.Table(TABLE_NAME)

s3 = boto3.client("s3", region_name="ap-south-1")
BUCKET_NAME = os.environ.get("BUCKET_NAME", "aistudyclub-karthik-2026")

bedrock = boto3.client("bedrock-runtime", region_name="ap-south-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "amazon.nova-lite-v1:0")

MAX_TEXT_CHARS = 12000
MAX_QUESTIONS = 20
DEFAULT_Q_COUNT = 5

# GSI1 partition used for manually-authored quizzes shared with every user
PUBLIC_QUIZ_GSI1PK = "QUIZ#PUBLIC"


def _quiz_summary(item):
    resources = item.get("resources") or []
    subject = item.get("subject") or (resources[0].get("subject") if resources else "") or "General"
    return {
        "quizId": item.get("quizId"),
        "title": item.get("title"),
        "questionCount": item.get("questionCount", 0),
        "createdAt": item.get("createdAt"),
        "subject": subject,
        "difficulty": item.get("difficulty", "Medium"),
        "description": item.get("description") or f"Quiz with {item.get('questionCount', 0)} questions",
        "source": item.get("source", "USER"),
        "resources": resources,
    }


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


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def extract_text_from_s3(s3_key):
    try:
        obj = s3.get_object(Bucket=BUCKET_NAME, Key=s3_key)
        raw = obj["Body"].read()
    except ClientError:
        return ""
    lower_key = s3_key.lower()
    if lower_key.endswith(".pdf"):
        text = _extract_pdf(raw)
    elif lower_key.endswith((".docx", ".doc")):
        text = _extract_docx(raw)
    elif lower_key.endswith((".txt", ".md", ".csv")):
        text = raw.decode("utf-8", errors="ignore")
    else:
        text = raw.decode("utf-8", errors="ignore")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:MAX_TEXT_CHARS]


def _extract_pdf(raw):
    try:
        content = raw.decode("latin-1", errors="ignore")
        chunks = re.findall(r"BT(.*?)ET", content, re.DOTALL)
        texts = []
        for chunk in chunks:
            for m in re.findall(r"\((.*?)\)\s*Tj", chunk):
                texts.append(m)
            for m in re.findall(r"\[(.*?)\]\s*TJ", chunk, re.DOTALL):
                texts.extend(re.findall(r"\((.*?)\)", m))
        text = " ".join(texts)
        text = text.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t")
        if len(text.strip()) > 100:
            return text
    except Exception:
        pass
    return re.sub(r"[^\x20-\x7e\n\r\t]", " ", raw.decode("latin-1", errors="ignore"))


def _extract_docx(raw):
    try:
        import zipfile
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            if "word/document.xml" in zf.namelist():
                xml_data = zf.read("word/document.xml").decode("utf-8", errors="ignore")
                return re.sub(r"<[^>]+>", " ", xml_data)
    except Exception:
        pass
    return raw.decode("utf-8", errors="ignore")


def call_bedrock(prompt, max_tokens=3000):
    result = bedrock.converse(
        modelId=MODEL_ID,
        messages=[{"role": "user", "content": [{"text": prompt}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0.3}
    )
    return result["output"]["message"]["content"][0]["text"]


def generate_quiz_from_text(context_text, num_questions, topic_hint=""):
    topic_line = f"The document is about: {topic_hint}\n" if topic_hint else ""
    prompt = f"""You are a university exam question generator.
{topic_line}
Generate exactly {num_questions} multiple-choice questions STRICTLY based on the following document content.
Do NOT use any external knowledge. All questions and answers must come ONLY from the text below.

DOCUMENT CONTENT:
---
{context_text}
---

Return ONLY a valid JSON array. No markdown, no explanation, no ```json blocks.
Format:
[
  {{
    "question": "Question text here?",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "answer": "Option A text",
    "explanation": "Brief explanation citing the document"
  }}
]

Rules:
- Each question must have exactly 4 options
- The "answer" field must exactly match one of the options
- Questions must be factual and answerable from the document
- Do not repeat questions
- Return only the JSON array, nothing else
"""
    raw = call_bedrock(prompt)
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    quiz = json.loads(raw)
    validated = []
    for q in quiz:
        if not isinstance(q, dict):
            continue
        question_text = (q.get("question") or "").strip()
        options = q.get("options", [])
        answer = (q.get("answer") or "").strip()
        explanation = (q.get("explanation") or "").strip()
        if not question_text or len(options) != 4 or not answer:
            continue
        if answer not in options:
            match = next((o for o in options if o.strip().lower() == answer.lower()), None)
            if match:
                answer = match
            else:
                continue
        validated.append({
            "question": question_text,
            "options": [str(o).strip() for o in options],
            "answer": answer,
            "explanation": explanation
        })
    return validated[:num_questions]


def get_resource_meta(resource_id):
    return table.get_item(Key={"PK": f"RESOURCE#{resource_id}", "SK": "METADATA"}).get("Item")


def check_resource_access(resource, user_id):
    visibility = (resource.get("visibility") or "PUBLIC").upper()
    if resource.get("ownerId") == user_id:
        return True
    if visibility == "PRIVATE":
        return False
    if visibility == "GROUP":
        for cid in (resource.get("sharedClubs") or []):
            if table.get_item(Key={"PK": f"CLUB#{cid}", "SK": f"MEMBER#{user_id}"}).get("Item"):
                return True
        return False
    return True


def handle_generate(event, user_id, user_name):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})
    resource_ids = body.get("resourceIds") or []
    if isinstance(body.get("resourceId"), str) and body["resourceId"]:
        resource_ids = [body["resourceId"]]
    num_questions = min(int(body.get("count", DEFAULT_Q_COUNT)), MAX_QUESTIONS)
    quiz_title = (body.get("title") or "").strip()
    save_quiz = body.get("save", True)
    if not resource_ids:
        return resp(400, {"error": "Validation error: 'resourceIds' is required"})
    combined_text = ""
    resource_details = []
    for rid in resource_ids[:3]:
        resource = get_resource_meta(rid)
        if not resource:
            return resp(404, {"error": f"Resource '{rid}' not found"})
        if not check_resource_access(resource, user_id):
            return resp(403, {"error": f"Forbidden: No access to resource '{rid}'"})
        s3_key = resource.get("s3Key", "")
        if not s3_key:
            return resp(400, {"error": f"Resource '{rid}' has no associated file"})
        text_chunk = extract_text_from_s3(s3_key)
        if text_chunk:
            combined_text += "\n\n" + text_chunk
        resource_details.append({
            "resourceId": rid,
            "title": resource.get("title", ""),
            "subject": resource.get("subject", "")
        })
    combined_text = combined_text.strip()
    if not combined_text or len(combined_text) < 100:
        return resp(422, {
            "error": "Insufficient text extracted from selected document(s). Ensure file has readable text (not a scanned image).",
            "extractedChars": len(combined_text)
        })
    topic_hint = quiz_title or (resource_details[0]["subject"] if resource_details else "")
    try:
        questions = generate_quiz_from_text(combined_text, num_questions, topic_hint)
    except json.JSONDecodeError:
        return resp(502, {"error": "AI returned invalid quiz format. Please try again."})
    except Exception as e:
        return resp(502, {"error": f"Quiz generation failed: {str(e)}"})
    if not questions:
        return resp(502, {"error": "No valid questions could be generated from the document."})
    if not quiz_title:
        quiz_title = f"Quiz on {resource_details[0]['title']}" if resource_details else "Generated Quiz"
    now = now_iso()
    quiz_id = str(uuid.uuid4())
    questions_for_client = [
        {"questionId": i, "question": q["question"], "options": q["options"]}
        for i, q in enumerate(questions)
    ]
    if save_quiz:
        quiz_item = {
            "PK": f"QUIZ#{quiz_id}",
            "SK": "METADATA",
            "entityType": "QUIZ",
            "quizId": quiz_id,
            "title": quiz_title,
            "createdBy": user_id,
            "creatorName": user_name,
            "resourceIds": resource_ids,
            "resources": resource_details,
            "questions": questions,
            "questionCount": len(questions),
            "createdAt": now,
            "status": "ACTIVE",
            "GSI1PK": f"USER#{user_id}",
            "GSI1SK": f"QUIZ#{now}"
        }
        table.put_item(Item=quiz_item)
    return resp(200, {
        "quizId": quiz_id if save_quiz else None,
        "title": quiz_title,
        "questionCount": len(questions_for_client),
        "questions": questions_for_client,
        "resources": resource_details,
        "saved": save_quiz
    })


def handle_list_quizzes(user_id):
    items = []
    try:
        res = table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(f"USER#{user_id}") & Key("GSI1SK").begins_with("QUIZ#"),
            ScanIndexForward=False,
            Limit=50
        )
        items.extend(res.get("Items", []))
    except Exception:
        pass
    # Manually-authored seeded quizzes are shared with every user
    try:
        res = table.query(
            IndexName="GSI1",
            KeyConditionExpression=Key("GSI1PK").eq(PUBLIC_QUIZ_GSI1PK) & Key("GSI1SK").begins_with("QUIZ#"),
            ScanIndexForward=False,
            Limit=50
        )
        items.extend(res.get("Items", []))
    except Exception:
        pass
    seen = set()
    quizzes = []
    for item in items:
        qid = item.get("quizId")
        if not qid or qid in seen:
            continue
        seen.add(qid)
        quizzes.append(_quiz_summary(item))
    quizzes.sort(key=lambda q: q.get("createdAt") or "", reverse=True)
    return resp(200, {"quizzes": quizzes, "count": len(quizzes)})


def handle_get_quiz(quiz_id, user_id):
    quiz = table.get_item(Key={"PK": f"QUIZ#{quiz_id}", "SK": "METADATA"}).get("Item")
    if not quiz:
        return resp(404, {"error": "Quiz not found"})
    is_owner = quiz.get("createdBy") == user_id
    questions_raw = quiz.get("questions", [])
    questions_out = []
    for i, q in enumerate(questions_raw):
        entry = {"questionId": i, "question": q.get("question"), "options": q.get("options", [])}
        if is_owner:
            entry["answer"] = q.get("answer")
            entry["explanation"] = q.get("explanation")
        questions_out.append(entry)
    return resp(200, {
        "quizId": quiz_id,
        "title": quiz.get("title"),
        "questionCount": quiz.get("questionCount", len(questions_out)),
        "createdAt": quiz.get("createdAt"),
        "subject": quiz.get("subject") or "General",
        "difficulty": quiz.get("difficulty", "Medium"),
        "description": quiz.get("description") or f"Quiz with {quiz.get('questionCount', len(questions_out))} questions",
        "isOwner": is_owner,
        "questions": questions_out,
        "resources": quiz.get("resources", [])
    })


def handle_submit(quiz_id, event, user_id):
    quiz = table.get_item(Key={"PK": f"QUIZ#{quiz_id}", "SK": "METADATA"}).get("Item")
    if not quiz:
        return resp(404, {"error": "Quiz not found"})
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return resp(400, {"error": "Invalid JSON body"})
    submitted_answers = body.get("answers", [])
    if not submitted_answers:
        return resp(400, {"error": "Validation error: 'answers' array is required"})
    questions = quiz.get("questions", [])
    total = len(questions)
    if total == 0:
        return resp(400, {"error": "Quiz has no questions"})
    if isinstance(submitted_answers, dict):
        answers_list = [submitted_answers.get(str(i), "") for i in range(total)]
    elif isinstance(submitted_answers, list):
        answers_list = list(submitted_answers)
    else:
        return resp(400, {"error": "Validation error: 'answers' must be array or object"})
    correct = 0
    results = []
    for i, q in enumerate(questions):
        correct_answer = (q.get("answer") or "").strip()
        submitted = (answers_list[i] if i < len(answers_list) else "").strip()
        is_correct = submitted.lower() == correct_answer.lower()
        if is_correct:
            correct += 1
        results.append({
            "questionId": i,
            "question": q.get("question"),
            "yourAnswer": submitted,
            "correctAnswer": correct_answer,
            "isCorrect": is_correct,
            "explanation": q.get("explanation", "")
        })
    score_pct = round((correct / total) * 100, 1) if total > 0 else 0.0
    now = now_iso()
    attempt_id = str(uuid.uuid4())
    table.put_item(Item={
        "PK": f"QUIZ#{quiz_id}",
        "SK": f"ATTEMPT#{user_id}#{now}",
        "entityType": "QUIZ_ATTEMPT",
        "attemptId": attempt_id,
        "quizId": quiz_id,
        "userId": user_id,
        "totalQuestions": total,
        "correctAnswers": correct,
        "scorePercent": Decimal(str(score_pct)),
        "submittedAt": now,
        "GSI1PK": f"USER#{user_id}",
        "GSI1SK": f"ATTEMPT#{now}"
    })
    try:
        table.update_item(
            Key={"PK": f"USER#{user_id}", "SK": "STATS"},
            UpdateExpression=(
                "SET quizzesCompleted = if_not_exists(quizzesCompleted, :z) + :one, "
                "totalScore = if_not_exists(totalScore, :z) + :score, "
                "totalQuestionsAnswered = if_not_exists(totalQuestionsAnswered, :z) + :tot, "
                "totalCorrect = if_not_exists(totalCorrect, :z) + :cor, "
                "lastQuizAt = :now, entityType = :etype"
            ),
            ExpressionAttributeValues={
                ":z": Decimal("0"), ":one": 1,
                ":score": Decimal(str(score_pct)),
                ":tot": total, ":cor": correct,
                ":now": now, ":etype": "USER_STATS"
            }
        )
    except Exception:
        pass
    return resp(200, {
        "attemptId": attempt_id,
        "quizId": quiz_id,
        "score": f"{correct}/{total}",
        "scorePercent": score_pct,
        "results": results
    })


def handle_get_result(quiz_id, user_id):
    try:
        res = table.query(
            KeyConditionExpression=Key("PK").eq(f"QUIZ#{quiz_id}") & Key("SK").begins_with(f"ATTEMPT#{user_id}#"),
            ScanIndexForward=False,
            Limit=10
        )
        attempts = res.get("Items", [])
    except Exception:
        attempts = []
    formatted = [{
        "attemptId": a.get("attemptId"),
        "quizId": quiz_id,
        "score": f"{a.get('correctAnswers', 0)}/{a.get('totalQuestions', 0)}",
        "scorePercent": float(a.get("scorePercent", 0)),
        "submittedAt": a.get("submittedAt")
    } for a in attempts]
    return resp(200, {"quizId": quiz_id, "attempts": formatted, "count": len(formatted)})


def lambda_handler(event, context):
    try:
        claims = get_claims(event)
        user_id = claims.get("sub")
        if not user_id or user_id == "UNKNOWN":
            return resp(401, {"error": "Unauthorized"})
        user_name = claims.get("name") or claims.get("email") or claims.get("cognito:username") or user_id
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        path   = event.get("requestContext", {}).get("http", {}).get("path", "")

        if method == "POST" and path == "/quiz/generate":
            return handle_generate(event, user_id, user_name)
        if method == "GET" and path == "/quiz":
            return handle_list_quizzes(user_id)

        m = re.match(r"^/quiz/([^/]+)/submit$", path)
        if method == "POST" and m:
            return handle_submit(m.group(1), event, user_id)

        m = re.match(r"^/quiz/([^/]+)/result$", path)
        if method == "GET" and m:
            return handle_get_result(m.group(1), user_id)

        m = re.match(r"^/quiz/([^/]+)$", path)
        if method == "GET" and m:
            return handle_get_quiz(m.group(1), user_id)

        return resp(404, {"error": f"Route not found: {method} {path}"})
    except Exception as e:
        return resp(500, {"error": "Internal server error", "detail": str(e)})
