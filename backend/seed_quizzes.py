"""Idempotent seeder for 6 manually-authored quizzes.

Runs against the existing AIStudyClub DynamoDB table (ap-south-1).
Seeded quizzes use deterministic quizIds and are shared with every user via
GSI1PK="QUIZ#PUBLIC". Re-running never creates duplicates and never overwrites
existing records (writes are guarded with attribute_not_exists(PK)).

Usage:
    python seed_quizzes.py
"""
import boto3
from botocore.exceptions import ClientError

REGION = "ap-south-1"
TABLE_NAME = "AIStudyClub"
PUBLIC_GSI1PK = "QUIZ#PUBLIC"
SEED_CREATED_AT = "2026-10-01T00:00:00+00:00"

dynamodb = boto3.resource("dynamodb", region_name=REGION)
table = dynamodb.Table(TABLE_NAME)


def q(text, options, answer, explanation):
    return {
        "question": text,
        "options": options,
        "answer": answer,
        "explanation": explanation,
    }


QUIZZES = [
    {
        "quizId": "seed-dsa",
        "title": "Data Structures and Algorithms",
        "subject": "Data Structures and Algorithms",
        "difficulty": "Easy",
        "description": "Beginner-friendly quiz on arrays, stacks, queues, searching and sorting.",
        "questions": [
            q("What is the worst-case time complexity of binary search on a sorted array of n elements?",
              ["O(n)", "O(log n)", "O(n log n)", "O(1)"], "O(log n)",
              "Binary search halves the search space each step, giving O(log n)."),
            q("Which data structure follows the Last-In-First-Out (LIFO) principle?",
              ["Queue", "Stack", "Array", "Linked List"], "Stack",
              "A stack pushes and pops from the same end, so the last item in is the first out."),
            q("What is the average time complexity of accessing an element by index in an array?",
              ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "O(1)",
              "Array indexing is a direct memory offset, so it is constant time."),
            q("Which data structure follows the First-In-First-Out (FIFO) principle?",
              ["Stack", "Queue", "Tree", "Graph"], "Queue",
              "A queue removes elements from the front and inserts at the back (FIFO)."),
            q("What is the worst-case time complexity of QuickSort?",
              ["O(n log n)", "O(n^2)", "O(n)", "O(log n)"], "O(n^2)",
              "With poor pivot choices (e.g., already-sorted data) QuickSort degrades to O(n^2)."),
            q("Which traversal of a binary search tree visits nodes in ascending sorted order?",
              ["Pre-order", "Post-order", "In-order", "Level-order"], "In-order",
              "In-order traversal of a BST visits left subtree, node, then right subtree, giving sorted order."),
            q("In a balanced binary search tree with n nodes, what is the height?",
              ["O(1)", "O(log n)", "O(n)", "O(n log n)"], "O(log n)",
              "Balanced BSTs keep height logarithmic, so search is O(log n)."),
        ],
    },
    {
        "quizId": "seed-python",
        "title": "Python Programming",
        "subject": "Python Programming",
        "difficulty": "Easy",
        "description": "Core Python syntax, data types and common built-in operations.",
        "questions": [
            q("Which keyword is used to define a function in Python?",
              ["func", "def", "function", "lambda"], "def",
              "Functions are declared with the 'def' keyword, e.g., def f():."),
            q("What is the result of len([1, 2, 3])?",
              ["2", "3", "4", "Error"], "3",
              "len() returns the number of items in a list, which is 3 here."),
            q("Which of the following Python types is immutable?",
              ["list", "dict", "set", "tuple"], "tuple",
              "Tuples cannot be changed after creation; lists, dicts and sets are mutable."),
            q("What does 3 // 2 evaluate to in Python 3?",
              ["1.5", "1", "2", "0"], "1",
              "// performs floor division, so 3 // 2 is 1."),
            q("Which list method adds a single item to the end of a list?",
              ["add()", "append()", "insert()", "push()"], "append()",
              "list.append(x) adds x to the end; insert() places at a given index."),
            q("What is the truthiness of bool([]) in Python?",
              ["True", "False", "Error", "None"], "False",
              "Empty containers are falsy, so bool([]) is False."),
            q("Which built-in function reads a line of text entered by the user?",
              ["scan()", "read()", "input()", "gets()"], "input()",
              "input() reads user input as a string."),
        ],
    },
    {
        "quizId": "seed-java",
        "title": "Java Programming",
        "subject": "Java Programming",
        "difficulty": "Medium",
        "description": "Java language fundamentals, OOP keywords and the compilation model.",
        "questions": [
            q("Which keyword is used for a class to inherit from another class in Java?",
              ["implements", "extends", "inherits", "super"], "extends",
              "'extends' is used for class inheritance; 'implements' is for interfaces."),
            q("What is the correct signature of the main method in Java?",
              ["public void main(String args)", "public static void main(String[] args)",
               "static void main(String args)", "void main(String[] args)"], "public static void main(String[] args)",
              "The JVM entry point must be public, static, return void and take a String array."),
            q("Which of the following is NOT a primitive type in Java?",
              ["int", "boolean", "String", "double"], "String",
              "String is a reference type (class), not a primitive."),
            q("How many bytes does an int occupy in Java?",
              ["2", "4", "8", "16"], "4",
              "Java int is a 32-bit (4-byte) signed integer."),
            q("Which keyword prevents a class from being subclassed?",
              ["static", "final", "const", "sealed"], "final",
              "A 'final' class cannot be extended."),
            q("Java source is compiled into which form before execution by the JVM?",
              ["Machine code", "Bytecode", "Assembly", "Binary"], "Bytecode",
              "javac compiles .java to platform-independent bytecode (.class) run by the JVM."),
            q("Which Java collection allows duplicate elements and maintains insertion order?",
              ["HashSet", "ArrayList", "TreeSet", "HashMap"], "ArrayList",
              "ArrayList is an ordered list that permits duplicates."),
        ],
    },
    {
        "quizId": "seed-dbms",
        "title": "Database Management Systems",
        "subject": "Database Management Systems",
        "difficulty": "Medium",
        "description": "Relational concepts, normalization, keys and SQL fundamentals.",
        "questions": [
            q("In ACID, what does the 'A' stand for?",
              ["Availability", "Atomicity", "Aggregation", "Association"], "Atomicity",
              "Atomicity means a transaction is all-or-nothing."),
            q("Which normal form removes transitive dependencies?",
              ["1NF", "2NF", "3NF", "BCNF"], "3NF",
              "Third Normal Form (3NF) eliminates transitive dependencies on non-key attributes."),
            q("Which SQL statement is used to retrieve data from a table?",
              ["GET", "SELECT", "FETCH ", "OPEN"], "SELECT",
              "SELECT queries rows from one or more tables."),
            q("Which property must a primary key satisfy?",
              ["It may contain NULLs", "It must be unique and not NULL",
               "It must be numeric", "It can repeat across rows"], "It must be unique and not NULL",
              "A primary key uniquely identifies each row and cannot be NULL."),
            q("Which join returns all rows from the left table and matching rows from the right?",
              ["INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "CROSS JOIN"], "LEFT JOIN",
              "A LEFT JOIN keeps every left-table row, filling unmatched right columns with NULL."),
            q("What is the main purpose of creating an index on a column?",
              ["Save disk space", "Enforce referential integrity",
               "Speed up data retrieval", "Encrypt the column"], "Speed up data retrieval",
              "Indexes provide fast lookups at the cost of extra storage and slower writes."),
            q("Which key references the primary key of another table?",
              ["Primary key", "Foreign key", "Candidate key", "Composite key"], "Foreign key",
              "A foreign key establishes a link to the primary key of another table."),
        ],
    },
    {
        "quizId": "seed-networks",
        "title": "Computer Networks",
        "subject": "Computer Networks",
        "difficulty": "Medium",
        "description": "OSI model layers, core protocols, ports and networking devices.",
        "questions": [
            q("At which OSI layer does the IP protocol operate?",
              ["Data Link", "Network", "Transport", "Session"], "Network",
              "IP is a Layer 3 (Network layer) protocol responsible for addressing and routing."),
            q("What is the default port number for HTTPS?",
              ["80", "443", "22", "8080"], "443",
              "HTTPS uses TCP port 443 by default."),
            q("Which transport protocol is connection-oriented and reliable?",
              ["UDP", "TCP", "ICMP", "ARP"], "TCP",
              "TCP establishes a connection and guarantees ordered, reliable delivery."),
            q("What is the primary role of DNS?",
              ["Assign IP addresses", "Resolve domain names to IP addresses",
               "Encrypt traffic", "Route packets between networks"], "Resolve domain names to IP addresses",
              "DNS translates human-readable names into IP addresses."),
            q("Which device forwards packets between different networks using IP addresses?",
              ["Hub", "Switch", "Router", "Repeater"], "Router",
              "Routers operate at Layer 3 and route packets between networks."),
            q("Which protocol maps an IP address to a MAC address on a local network?",
              ["DNS", "DHCP", "ARP", "NAT"], "ARP",
              "ARP resolves IPv4 addresses to MAC addresses within a LAN."),
            q("Which OSI layer is responsible for end-to-end reliable delivery of data?",
              ["Network", "Transport", "Data Link", "Physical"], "Transport",
              "The Transport layer (e.g., TCP) handles end-to-end reliability and flow control."),
        ],
    },
    {
        "quizId": "seed-cloud",
        "title": "Cloud Computing and AWS",
        "subject": "Cloud Computing and AWS",
        "difficulty": "Easy",
        "description": "Cloud fundamentals and popular AWS services and models.",
        "questions": [
            q("What does EC2 stand for in AWS?",
              ["Elastic Compute Cloud", "Easy Cloud Computing",
               "Enhanced Compute Cluster", "Elastic Container Cloud"], "Elastic Compute Cloud",
              "Amazon EC2 (Elastic Compute Cloud) provides resizable virtual servers."),
            q("Which AWS service provides object storage?",
              ["EBS", "S3", "EFS", "Glacier"], "S3",
              "Amazon S3 is a scalable object storage service."),
            q("AWS Lambda corresponds to which cloud service model?",
              ["IaaS", "PaaS", "SaaS", "FaaS"], "FaaS",
              "Lambda is Function-as-a-Service: you run code without managing servers."),
            q("Which AWS service is a managed NoSQL database?",
              ["RDS", "DynamoDB", "Redshift", "Aurora"], "DynamoDB",
              "DynamoDB is a fully managed key-value and document NoSQL database."),
            q("Which of the following is NOT a compute service?",
              ["EC2", "Lambda", "ECS", "S3"], "S3",
              "S3 is storage; EC2, Lambda and ECS are compute services."),
            q("What is the main purpose of AWS IAM?",
              ["Deliver content", "Manage users, roles and permissions",
               "Store objects", "Run containers"], "Manage users, roles and permissions",
              "IAM controls authentication and authorization for AWS resources."),
            q("Which AWS service is a global content delivery network (CDN)?",
              ["CloudFront", "Route 53", "Direct Connect", "API Gateway"], "CloudFront",
              "Amazon CloudFront caches and delivers content from edge locations."),
        ],
    },
]


def build_item(quiz):
    questions = quiz["questions"]
    return {
        "PK": f"QUIZ#{quiz['quizId']}",
        "SK": "METADATA",
        "entityType": "QUIZ",
        "quizId": quiz["quizId"],
        "title": quiz["title"],
        "subject": quiz["subject"],
        "difficulty": quiz["difficulty"],
        "description": quiz["description"],
        "questions": questions,
        "questionCount": len(questions),
        "createdBy": "system",
        "creatorName": "AI StudyClub",
        "source": "SEEDED",
        "status": "ACTIVE",
        "createdAt": SEED_CREATED_AT,
        "GSI1PK": PUBLIC_GSI1PK,
        "GSI1SK": f"QUIZ#{quiz['quizId']}",
    }


def main():
    created, skipped = 0, 0
    for quiz in QUIZZES:
        item = build_item(quiz)
        try:
            table.put_item(
                Item=item,
                ConditionExpression="attribute_not_exists(PK)",
            )
            created += 1
            print(f"CREATED  {quiz['quizId']:16s} {quiz['title']} ({item['questionCount']} questions)")
        except ClientError as e:
            if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                skipped += 1
                print(f"SKIPPED  {quiz['quizId']:16s} already exists (no overwrite)")
            else:
                raise
    print(f"\nDone. created={created} skipped={skipped} total={len(QUIZZES)}")


if __name__ == "__main__":
    main()
