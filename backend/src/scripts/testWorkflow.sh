#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "===================================="
echo "StajChain Workflow Test"
echo "===================================="

# Demo users from backend/src/config/demoUsers.js
STUDENT_EMAIL="${STUDENT_EMAIL:-studentworkflow@itu.edu.tr}"
STUDENT_PASSWORD="${STUDENT_PASSWORD:-123456}"

COMPANY_EMAIL="${COMPANY_EMAIL:-companyb@company.com}"
COMPANY_PASSWORD="${COMPANY_PASSWORD:-123456}"

FACULTY_EMAIL="${FACULTY_EMAIL:-faculty@itu.edu.tr}"
FACULTY_PASSWORD="${FACULTY_PASSWORD:-123456}"

CENTRAL_EMAIL="${CENTRAL_EMAIL:-central@itu.edu.tr}"
CENTRAL_PASSWORD="${CENTRAL_PASSWORD:-123456}"

COMPANY_ID="${COMPANY_ID:-companyB}"
FACULTY_ID="${FACULTY_ID:-BBF}"
INTERNSHIP_TYPE="${INTERNSHIP_TYPE:-MANDATORY}"
INTERNSHIP_FIELD="${INTERNSHIP_FIELD:-YAZILIM}"
DEFAULT_WORKING_DAYS_JSON='["MON","TUE","WED","THU","FRI"]'
WORKING_DAYS_JSON="${WORKING_DAYS_JSON:-$DEFAULT_WORKING_DAYS_JSON}"
MIN_REQUIRED_WORKING_DAYS="${MIN_REQUIRED_WORKING_DAYS:-20}"

SUFFIX="$(python3 - <<'PY'
import time
print(int(time.time()))
PY
)"

DATE_OFFSET_DAYS="$((SUFFIX % 90 + 15))"
START_DATE_AUTO_GENERATED="${START_DATE+x}"
END_DATE_AUTO_GENERATED="${END_DATE+x}"
REJECT_START_DATE_AUTO_GENERATED="${REJECT_START_DATE+x}"
REJECT_END_DATE_AUTO_GENERATED="${REJECT_END_DATE+x}"

AG_MAIN="${AG_MAIN:-AG${SUFFIX}01}"
AG_REJECT="${AG_REJECT:-AG${SUFFIX}02}"

calculate_end_date_for_min_workdays() {
  local start_date="$1"
  local min_required_days="$2"
  local working_days_json="$3"

  python3 - <<PY
import json
from datetime import date, timedelta

start_date = date.fromisoformat("${start_date}")
min_required_days = int("${min_required_days}")
working_days = json.loads("""${working_days_json}""")
weekday_to_python = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}
selected_days = {weekday_to_python[day] for day in working_days}

current = start_date
count = 0
while True:
    if current.weekday() in selected_days:
        count += 1
    if count >= min_required_days:
        print(current.isoformat())
        break
    current += timedelta(days=1)
PY
}

START_DATE="${START_DATE:-$(python3 - <<PY
from datetime import date, timedelta
print((date.today() + timedelta(days=${DATE_OFFSET_DAYS})).isoformat())
PY
)}"

END_DATE="${END_DATE:-$(calculate_end_date_for_min_workdays "$START_DATE" "$MIN_REQUIRED_WORKING_DAYS" "$DEFAULT_WORKING_DAYS_JSON")}"

REJECT_START_DATE="${REJECT_START_DATE:-$(python3 - <<PY
from datetime import date, timedelta
end_date = date.fromisoformat("${END_DATE}")
print((end_date + timedelta(days=1)).isoformat())
PY
)}"

REJECT_END_DATE="${REJECT_END_DATE:-$(calculate_end_date_for_min_workdays "$REJECT_START_DATE" "$MIN_REQUIRED_WORKING_DAYS" "$DEFAULT_WORKING_DAYS_JSON")}"

VALID_REJECTION_REASON="${VALID_REJECTION_REASON:-MISSING_DOCUMENT}"

LAST_STATUS=""
LAST_BODY=""

pretty() {
  python3 -m json.tool 2>/dev/null || cat
}

extract_token() {
  python3 -c "import sys, json; print(json.load(sys.stdin).get('token',''))"
}

extract_data_id() {
  python3 -c "import sys, json; data=json.load(sys.stdin).get('data', {}); print(data.get('agreementId',''))"
}

compute_safe_start_date() {
  local token="$1"
  local desired_start_date="$2"

  api_call "GET" "/api/agreements/my" "$token"
  assert_status "200" "load student agreements for safe scheduling"

  AGREEMENTS_JSON="$LAST_BODY" DESIRED_START_DATE="$desired_start_date" python3 - <<'PY'
import json
import os
from datetime import date, timedelta

payload = json.loads(os.environ["AGREEMENTS_JSON"])
agreements = payload.get("data") or []
desired_start = date.fromisoformat(os.environ["DESIRED_START_DATE"])

latest_end = None
for agreement in agreements:
    status = str(agreement.get("status") or "").upper()
    if status == "REJECTED":
        continue

    end_date = agreement.get("endDate")
    if not end_date:
        continue

    try:
        parsed_end = date.fromisoformat(str(end_date)[:10])
    except ValueError:
        continue

    if latest_end is None or parsed_end > latest_end:
        latest_end = parsed_end

if latest_end and latest_end >= desired_start:
    print((latest_end + timedelta(days=1)).isoformat())
else:
    print(desired_start.isoformat())
PY
}

api_call() {
  local method="$1"
  local path="$2"
  local token="${3:-}"
  local body="${4:-}"

  local response
  if [[ -n "$body" ]]; then
    response="$(curl -sS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$body" \
      -w $'\n%{http_code}')"
  elif [[ -n "$token" ]]; then
    response="$(curl -sS -X "$method" "$BASE_URL$path" \
      -H "Authorization: Bearer $token" \
      -w $'\n%{http_code}')"
  else
    response="$(curl -sS -X "$method" "$BASE_URL$path" \
      -w $'\n%{http_code}')"
  fi

  LAST_STATUS="$(printf '%s' "$response" | tail -n1)"
  LAST_BODY="$(printf '%s' "$response" | sed '$d')"
}

print_last_response() {
  printf '%s\n' "$LAST_BODY" | pretty
  echo "HTTP $LAST_STATUS"
}

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

assert_status() {
  local expected="$1"
  local context="$2"
  if [[ "$LAST_STATUS" != "$expected" ]]; then
    echo "Unexpected status for: $context" >&2
    print_last_response >&2
    fail "expected HTTP $expected, got HTTP $LAST_STATUS"
  fi
}

assert_body_contains() {
  local needle="$1"
  local context="$2"
  if ! printf '%s' "$LAST_BODY" | grep -q "$needle"; then
    echo "Body did not contain '$needle' for: $context" >&2
    print_last_response >&2
    fail "missing expected content"
  fi
}

login() {
  local email="$1"
  local password="$2"

  curl -sS -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}"
}

get_token() {
  local email="$1"
  local password="$2"
  login "$email" "$password" | extract_token
}

echo "Using startDate=$START_DATE endDate=$END_DATE"
echo "Using rejectStartDate=$REJECT_START_DATE rejectEndDate=$REJECT_END_DATE"
echo "Using requested agreement ids: main=$AG_MAIN reject=$AG_REJECT"
echo "Using companyId=$COMPANY_ID facultyId=$FACULTY_ID"
echo "Using internshipType=$INTERNSHIP_TYPE internshipField=$INTERNSHIP_FIELD"
echo "Using workingDays=$WORKING_DAYS_JSON"
echo "Using rejectionReason=$VALID_REJECTION_REASON"
echo
echo "=== Getting tokens ==="

STUDENT_TOKEN="$(get_token "$STUDENT_EMAIL" "$STUDENT_PASSWORD")"
COMPANY_TOKEN="$(get_token "$COMPANY_EMAIL" "$COMPANY_PASSWORD")"
FACULTY_TOKEN="$(get_token "$FACULTY_EMAIL" "$FACULTY_PASSWORD")"
CENTRAL_TOKEN="$(get_token "$CENTRAL_EMAIL" "$CENTRAL_PASSWORD")"

echo "Student token length: ${#STUDENT_TOKEN}"
echo "Company token length: ${#COMPANY_TOKEN}"
echo "Faculty token length: ${#FACULTY_TOKEN}"
echo "Central token length: ${#CENTRAL_TOKEN}"

[[ -n "$STUDENT_TOKEN" ]] || fail "student token is empty"
[[ -n "$COMPANY_TOKEN" ]] || fail "company token is empty"
[[ -n "$FACULTY_TOKEN" ]] || fail "faculty token is empty"
[[ -n "$CENTRAL_TOKEN" ]] || fail "central token is empty"

if [[ -z "$START_DATE_AUTO_GENERATED" ]]; then
  START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
  END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "$MIN_REQUIRED_WORKING_DAYS" "$WORKING_DAYS_JSON")"
  REJECT_START_DATE="$(python3 - <<PY
from datetime import date, timedelta
end_date = date.fromisoformat("${END_DATE}")
print((end_date + timedelta(days=1)).isoformat())
PY
)"
  REJECT_END_DATE="$(calculate_end_date_for_min_workdays "$REJECT_START_DATE" "$MIN_REQUIRED_WORKING_DAYS" "$WORKING_DAYS_JSON")"
fi

echo "Resolved startDate=$START_DATE endDate=$END_DATE"
echo "Resolved rejectStartDate=$REJECT_START_DATE rejectEndDate=$REJECT_END_DATE"

echo
echo "=== Create main agreement ==="
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "{
  \"agreementId\":\"$AG_MAIN\",
  \"companyId\":\"$COMPANY_ID\",
  \"facultyId\":\"$FACULTY_ID\",
  \"startDate\":\"$START_DATE\",
  \"endDate\":\"$END_DATE\",
  \"internshipType\":\"$INTERNSHIP_TYPE\",
  \"internshipField\":\"$INTERNSHIP_FIELD\",
  \"workingDays\":$WORKING_DAYS_JSON
}"
print_last_response
assert_status "201" "create main agreement"
AG_MAIN="$(printf '%s' "$LAST_BODY" | extract_data_id)"
[[ -n "$AG_MAIN" ]] || fail "main agreement id missing from create response"
echo "Using main agreement id: $AG_MAIN"

echo
echo "=== Central tries to read CREATED agreement (should fail) ==="
api_call "GET" "/api/agreements/$AG_MAIN" "$CENTRAL_TOKEN"
print_last_response
assert_status "403" "central reads CREATED agreement"

echo
echo "=== Central tries to read CREATED history (should fail) ==="
api_call "GET" "/api/agreements/$AG_MAIN/history" "$CENTRAL_TOKEN"
print_last_response
assert_status "403" "central reads CREATED history"

echo
echo "=== Student approve ==="
api_call "POST" "/api/agreements/$AG_MAIN/approve" "$STUDENT_TOKEN"
print_last_response
assert_status "200" "student approve"
assert_body_contains "STUDENT_APPROVED" "student approve"

echo
echo "=== Company pending list ==="
api_call "GET" "/api/agreements/pending" "$COMPANY_TOKEN"
print_last_response
assert_status "200" "company pending list"
assert_body_contains "$AG_MAIN" "company pending list"

echo
echo "=== Central still should not read after student approval ==="
api_call "GET" "/api/agreements/$AG_MAIN" "$CENTRAL_TOKEN"
print_last_response
assert_status "403" "central reads STUDENT_APPROVED agreement"

echo
echo "=== Company approve ==="
api_call "POST" "/api/agreements/$AG_MAIN/approve" "$COMPANY_TOKEN"
print_last_response
assert_status "200" "company approve"
assert_body_contains "COMPANY_APPROVED" "company approve"

echo
echo "=== Faculty pending list ==="
api_call "GET" "/api/agreements/pending" "$FACULTY_TOKEN"
print_last_response
assert_status "200" "faculty pending list"
assert_body_contains "$AG_MAIN" "faculty pending list"

echo
echo "=== Central still should not read after company approval ==="
api_call "GET" "/api/agreements/$AG_MAIN" "$CENTRAL_TOKEN"
print_last_response
assert_status "403" "central reads COMPANY_APPROVED agreement"

echo
echo "=== Faculty approve ==="
api_call "POST" "/api/agreements/$AG_MAIN/approve" "$FACULTY_TOKEN"
print_last_response
assert_status "200" "faculty approve"
assert_body_contains "FACULTY_APPROVED" "faculty approve"

echo
echo "=== Central pending activation list ==="
api_call "GET" "/api/agreements/pending" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central pending list"
assert_body_contains "$AG_MAIN" "central pending list"

echo
echo "=== Central should now read agreement successfully ==="
api_call "GET" "/api/agreements/$AG_MAIN" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central reads FACULTY_APPROVED agreement"
assert_body_contains "FACULTY_APPROVED" "central reads FACULTY_APPROVED agreement"

echo
echo "=== Central should now read history successfully ==="
api_call "GET" "/api/agreements/$AG_MAIN/history" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central reads FACULTY_APPROVED history"
assert_body_contains "AgreementApprovedByFaculty" "central reads FACULTY_APPROVED history"

echo
echo "=== Central activate ==="
api_call "POST" "/api/agreements/$AG_MAIN/activate" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central activate"
assert_body_contains "ACTIVE" "central activate"

echo
echo "=== Central reads ACTIVE agreement ==="
api_call "GET" "/api/agreements/$AG_MAIN" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central reads ACTIVE agreement"
assert_body_contains "ACTIVE" "central reads ACTIVE agreement"

echo
echo "=== History after activation ==="
api_call "GET" "/api/agreements/$AG_MAIN/history" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central reads ACTIVE history"
assert_body_contains "AgreementActivated" "central reads ACTIVE history"

echo
echo "=== Central complete ==="
api_call "POST" "/api/agreements/$AG_MAIN/complete" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central complete"
assert_body_contains "COMPLETED" "central complete"

echo
echo "=== Central reads COMPLETED agreement ==="
api_call "GET" "/api/agreements/$AG_MAIN" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central reads COMPLETED agreement"
assert_body_contains "COMPLETED" "central reads COMPLETED agreement"

echo
echo "=== Central reads COMPLETED history ==="
api_call "GET" "/api/agreements/$AG_MAIN/history" "$CENTRAL_TOKEN"
print_last_response
assert_status "200" "central reads COMPLETED history"
assert_body_contains "AgreementCompleted" "central reads COMPLETED history"

echo
echo "=== DONE ==="
echo "Legacy workflow smoke test completed successfully."
