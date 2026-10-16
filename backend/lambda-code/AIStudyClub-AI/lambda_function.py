import json
import boto3

bedrock = boto3.client("bedrock-runtime", region_name="ap-south-1")

MODEL_ID = "amazon.nova-lite-v1:0"


def response(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "authorization, content-type",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
        },
        "body": json.dumps(body)
    }


def ask_ai(prompt):

    result = bedrock.converse(
        modelId=MODEL_ID,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        inferenceConfig={
            "maxTokens": 1000,
            "temperature": 0.4
        }
    )

    return result["output"]["message"]["content"][0]["text"]


def lambda_handler(event, context):

    method = event.get("requestContext", {}).get("http", {}).get("method")
    path = event.get("requestContext", {}).get("http", {}).get("path")

    # -----------------------------
    # AI STUDY ASSISTANT
    # -----------------------------
    if method == "POST" and path == "/ai/ask":

        body = json.loads(event.get("body") or "{}")

        question = body.get("question")
        subject = body.get("subject", "")

        if not question:
            return response(400, {
                "error": "question is required"
            })

        prompt = f"""
You are an AI Study Assistant for a university student.

Subject:
{subject}

Student question:
{question}

Give a clear, accurate and easy-to-understand explanation.
Use examples when useful.
Keep the answer focused on studying and learning.
"""

        answer = ask_ai(prompt)

        return response(200, {
            "question": question,
            "answer": answer
        })

    # -----------------------------
    # AI QUIZ GENERATOR
    # -----------------------------
    if method == "POST" and path == "/ai/quiz":

        body = json.loads(event.get("body") or "{}")

        topic = body.get("topic")
        count = body.get("count", 5)

        if not topic:
            return response(400, {
                "error": "topic is required"
            })

        prompt = f"""
Generate {count} multiple-choice questions for a university student.

Topic:
{topic}

Return ONLY valid JSON in this exact format:

[
  {{
    "question": "Question text",
    "options": [
      "Option A",
      "Option B",
      "Option C",
      "Option D"
    ],
    "answer": "Option A",
    "explanation": "Short explanation"
  }}
]

Do not include markdown.
Do not include ```json.
Return only the JSON array.
"""

        quiz_text = ask_ai(prompt)

        try:
            quiz = json.loads(quiz_text)
        except json.JSONDecodeError:
            return response(500, {
                "error": "AI returned invalid quiz JSON",
                "raw": quiz_text
            })

        return response(200, {
            "topic": topic,
            "quiz": quiz
        })

    return response(404, {
        "error": "Route not found"
    })