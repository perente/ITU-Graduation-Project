#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"

echo "===================================="
echo "StajChain Rule Enforcement Test"
echo "===================================="

STUDENT_EMAIL="${STUDENT_EMAIL:-studentrules@itu.edu.tr}"
STUDENT_PASSWORD="${STUDENT_PASSWORD:-123456}"
OVERLAP_STUDENT_EMAIL="${OVERLAP_STUDENT_EMAIL:-studentrulesoverlap@itu.edu.tr}"
OVERLAP_STUDENT_PASSWORD="${OVERLAP_STUDENT_PASSWORD:-123456}"

COMPANY_EMAIL="${COMPANY_EMAIL:-companyb@company.com}"
COMPANY_PASSWORD="${COMPANY_PASSWORD:-123456}"

FACULTY_EMAIL="${FACULTY_EMAIL:-faculty@itu.edu.tr}"
FACULTY_PASSWORD="${FACULTY_PASSWORD:-123456}"

CENTRAL_EMAIL="${CENTRAL_EMAIL:-central@itu.edu.tr}"
CENTRAL_PASSWORD="${CENTRAL_PASSWORD:-123456}"
REQUIRE_CLEAN_RULE_STATE="${REQUIRE_CLEAN_RULE_STATE:-false}"

COMPANY_ID="${COMPANY_ID:-companyB}"
FACULTY_ID="${FACULTY_ID:-BBF}"
DEFAULT_WORKING_DAYS_JSON='["MON","TUE","WED","THU","FRI"]'
DEFAULT_VOLUNTARY_FIELD="${DEFAULT_VOLUNTARY_FIELD:-BILISIM}"

SUFFIX="$(python3 - <<'PY'
import time
print(int(time.time()))
PY
)"

DATE_OFFSET_DAYS="$((SUFFIX % 90 + 20))"

LAST_STATUS=""
LAST_BODY=""
AG_COUNTER=0
ORIGINAL_PROFILE_FILE="$(mktemp)"

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

is_truthy() {
  local value
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  [[ "$value" == "1" || "$value" == "true" || "$value" == "yes" || "$value" == "on" ]]
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

assert_status_one_of() {
  local expected_a="$1"
  local expected_b="$2"
  local context="$3"
  if [[ "$LAST_STATUS" != "$expected_a" && "$LAST_STATUS" != "$expected_b" ]]; then
    echo "Unexpected status for: $context" >&2
    print_last_response >&2
    fail "expected HTTP $expected_a or $expected_b, got HTTP $LAST_STATUS"
  fi
}

assert_body_contains() {
  local needle="$1"
  local context="$2"
  if ! printf '%s' "$LAST_BODY" | grep -qi "$needle"; then
    echo "Body did not contain '$needle' for: $context" >&2
    print_last_response >&2
    fail "missing expected content"
  fi
}

assert_body_contains_one_of() {
  local needle_a="$1"
  local needle_b="$2"
  local context="$3"
  if printf '%s' "$LAST_BODY" | grep -qi "$needle_a"; then
    return
  fi

  if printf '%s' "$LAST_BODY" | grep -qi "$needle_b"; then
    return
  fi

  echo "Body did not contain '$needle_a' or '$needle_b' for: $context" >&2
  print_last_response >&2
  fail "missing expected content"
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

next_agreement_id() {
  AG_COUNTER="$((AG_COUNTER + 1))"
  printf 'RULE%s%03d' "$SUFFIX" "$AG_COUNTER"
}

iso_date_after() {
  local offset_days="$1"

  python3 - <<PY
from datetime import date, timedelta
print((date.today() + timedelta(days=${offset_days})).isoformat())
PY
}

next_weekday_after() {
  local offset_days="$1"
  local weekday_name="$2"

  TARGET_WEEKDAY_NAME="$weekday_name" python3 - <<PY
import os
from datetime import date, timedelta

target_names = {
    "MON": 0,
    "TUE": 1,
    "WED": 2,
    "THU": 3,
    "FRI": 4,
    "SAT": 5,
    "SUN": 6,
}

current = date.today() + timedelta(days=${offset_days})
target = target_names[os.environ["TARGET_WEEKDAY_NAME"]]

while current.weekday() != target:
    current += timedelta(days=1)

print(current.isoformat())
PY
}

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

ensure_min_calendar_span() {
  local start_date="$1"
  local candidate_end_date="$2"
  local min_calendar_days="$3"

  python3 - <<PY
from datetime import date, timedelta

start_date = date.fromisoformat("${start_date}")
candidate_end_date = date.fromisoformat("${candidate_end_date}")
min_end_date = start_date + timedelta(days=int("${min_calendar_days}"))

if candidate_end_date < min_end_date:
    print(min_end_date.isoformat())
else:
    print(candidate_end_date.isoformat())
PY
}

save_original_student_profile() {
  DOTENV_CONFIG_QUIET=true STUDENT_EMAIL="$STUDENT_EMAIL" node - <<'NODE' > "$ORIGINAL_PROFILE_FILE"
const { initDb, get } = require('./src/config/db');

(async () => {
  await initDb();
  const row = await get(
    `SELECT department_code, department_name, completed_credits
     FROM users WHERE email = ? LIMIT 1`,
    [process.env.STUDENT_EMAIL]
  );

  if (!row) {
    throw new Error('Student profile not found');
  }

  process.stdout.write(JSON.stringify(row));
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
}

set_student_profile() {
  local department_code="$1"
  local department_name="$2"
  local completed_credits="$3"

  DOTENV_CONFIG_QUIET=true \
  STUDENT_EMAIL="$STUDENT_EMAIL" \
  DEPARTMENT_CODE="$department_code" \
  DEPARTMENT_NAME="$department_name" \
  COMPLETED_CREDITS="$completed_credits" \
  node - <<'NODE'
const { initDb, run } = require('./src/config/db');

(async () => {
  await initDb();
  await run(
    `UPDATE users
     SET department_code = ?, department_name = ?, completed_credits = ?, updated_at = ?
     WHERE email = ?`,
    [
      process.env.DEPARTMENT_CODE,
      process.env.DEPARTMENT_NAME,
      Number(process.env.COMPLETED_CREDITS),
      new Date().toISOString(),
      process.env.STUDENT_EMAIL,
    ]
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
}

restore_original_student_profile() {
  if [[ ! -f "$ORIGINAL_PROFILE_FILE" ]]; then
    return
  fi

  DOTENV_CONFIG_QUIET=true ORIGINAL_PROFILE_FILE="$ORIGINAL_PROFILE_FILE" STUDENT_EMAIL="$STUDENT_EMAIL" node - <<'NODE'
const fs = require('fs');
const { initDb, run } = require('./src/config/db');

(async () => {
  const original = JSON.parse(
    fs.readFileSync(process.env.ORIGINAL_PROFILE_FILE, 'utf8')
  );

  await initDb();
  await run(
    `UPDATE users
     SET department_code = ?, department_name = ?, completed_credits = ?, updated_at = ?
     WHERE email = ?`,
    [
      original.department_code,
      original.department_name,
      original.completed_credits,
      new Date().toISOString(),
      process.env.STUDENT_EMAIL,
    ]
  );
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
NODE
}

refresh_student_progress() {
  api_call "GET" "/api/agreements/my" "$STUDENT_TOKEN"
  assert_status "200" "refresh student progress"

  eval "$(
    LAST_BODY_JSON="$LAST_BODY" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ['LAST_BODY_JSON'])
agreements = payload.get('data') or []
mandatory_count = 0
voluntary_days = 0
mandatory_fields = []

for agreement in agreements:
    if agreement.get('status') != 'COMPLETED':
        continue

    internship_type = str(agreement.get('internshipType') or '').upper()
    internship_field = str(agreement.get('internshipField') or '').upper()
    total_working_days = int(agreement.get('totalWorkingDays') or 0)

    if internship_type == 'MANDATORY':
        mandatory_count += 1
        if internship_field:
            mandatory_fields.append(internship_field)

    if internship_type == 'VOLUNTARY':
        voluntary_days += total_working_days

print(f"COMPLETED_MANDATORY_COUNT={mandatory_count}")
print(f"COMPLETED_VOLUNTARY_DAYS={voluntary_days}")
print("COMPLETED_MANDATORY_FIELDS=\"{}\"".format("|".join(mandatory_fields)))
PY
  )"
}

refresh_progress_for_token() {
  local token="$1"
  local prefix="$2"

  api_call "GET" "/api/agreements/my" "$token"
  assert_status "200" "refresh student progress for ${prefix}"

  eval "$(
    LAST_BODY_JSON="$LAST_BODY" PREFIX="$prefix" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ['LAST_BODY_JSON'])
agreements = payload.get('data') or []
mandatory_count = 0
voluntary_days = 0
mandatory_fields = []

for agreement in agreements:
    if agreement.get('status') != 'COMPLETED':
        continue

    internship_type = str(agreement.get('internshipType') or '').upper()
    internship_field = str(agreement.get('internshipField') or '').upper()
    total_working_days = int(agreement.get('totalWorkingDays') or 0)

    if internship_type == 'MANDATORY':
        mandatory_count += 1
        if internship_field:
            mandatory_fields.append(internship_field)

    if internship_type == 'VOLUNTARY':
        voluntary_days += total_working_days

prefix = os.environ['PREFIX']
print(f"{prefix}_COMPLETED_MANDATORY_COUNT={mandatory_count}")
print(f"{prefix}_COMPLETED_VOLUNTARY_DAYS={voluntary_days}")
print(f'{prefix}_COMPLETED_MANDATORY_FIELDS="{("|".join(mandatory_fields))}"')
PY
  )"
}

print_progress_summary() {
  local label="$1"

  refresh_student_progress

  echo
  echo "=== ${label} ==="
  echo "Completed mandatory count: ${COMPLETED_MANDATORY_COUNT}"
  echo "Completed voluntary days: ${COMPLETED_VOLUNTARY_DAYS}"
  if [[ -n "${COMPLETED_MANDATORY_FIELDS:-}" ]]; then
    echo "Completed mandatory fields: ${COMPLETED_MANDATORY_FIELDS}"
  else
    echo "Completed mandatory fields: (none)"
  fi
}

pick_first_missing_cse_field() {
  local excluded_fields="${1:-}"

  EXCLUDED_FIELDS="$excluded_fields" python3 - <<'PY'
import os

fields = [
    'YAZILIM',
    'DONANIM',
    'BILISIM',
    'BILGI_ISLEM',
    'BILGI_TEKNOLOJILERI',
]
excluded = {field for field in os.environ.get('EXCLUDED_FIELDS', '').split('|') if field}

for field in fields:
    if field not in excluded:
        print(field)
        break
else:
    print(fields[0])
PY
}

create_agreement_payload() {
  local agreement_id="$1"
  local start_date="$2"
  local end_date="$3"
  local internship_type="$4"
  local internship_field="$5"
  local working_days_json="$6"

  cat <<EOF
{
  "agreementId":"${agreement_id}",
  "companyId":"${COMPANY_ID}",
  "facultyId":"${FACULTY_ID}",
  "startDate":"${start_date}",
  "endDate":"${end_date}",
  "internshipType":"${internship_type}",
  "internshipField":"${internship_field}",
  "workingDays":${working_days_json}
}
EOF
}

create_and_complete_agreement() {
  local internship_type="$1"
  local internship_field="$2"
  local working_days_json="$3"
  local target_working_days="$4"
  local start_offset="$5"
  local context="$6"

  local agreement_id
  agreement_id="$(next_agreement_id)"
  local start_date
  start_date="$(iso_date_after "$start_offset")"
  start_date="$(compute_safe_start_date "$STUDENT_TOKEN" "$start_date")"
  local end_date
  end_date="$(calculate_end_date_for_min_workdays "$start_date" "$target_working_days" "$working_days_json")"
  end_date="$(ensure_min_calendar_span "$start_date" "$end_date" "20")"

  echo
  echo "=== ${context}: create ${agreement_id} ==="
  api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
    "$agreement_id" "$start_date" "$end_date" "$internship_type" "$internship_field" "$working_days_json")"
  print_last_response
  assert_status "201" "${context}: create"
  agreement_id="$(printf '%s' "$LAST_BODY" | extract_data_id)"
  [[ -n "$agreement_id" ]] || fail "${context}: agreement id missing from create response"

  echo "=== ${context}: student approve ${agreement_id} ==="
  api_call "POST" "/api/agreements/$agreement_id/approve" "$STUDENT_TOKEN"
  print_last_response
  assert_status "200" "${context}: student approve"

  echo "=== ${context}: company approve ${agreement_id} ==="
  api_call "POST" "/api/agreements/$agreement_id/approve" "$COMPANY_TOKEN"
  print_last_response
  assert_status "200" "${context}: company approve"

  echo "=== ${context}: faculty approve ${agreement_id} ==="
  api_call "POST" "/api/agreements/$agreement_id/approve" "$FACULTY_TOKEN"
  print_last_response
  assert_status "200" "${context}: faculty approve"

  echo "=== ${context}: central activate ${agreement_id} ==="
  api_call "POST" "/api/agreements/$agreement_id/activate" "$CENTRAL_TOKEN"
  print_last_response
  assert_status "200" "${context}: central activate"

  echo "=== ${context}: central complete ${agreement_id} ==="
  api_call "POST" "/api/agreements/$agreement_id/complete" "$CENTRAL_TOKEN"
  print_last_response
  assert_status "200" "${context}: central complete"
}

save_original_student_profile
trap 'restore_original_student_profile; rm -f "$ORIGINAL_PROFILE_FILE"' EXIT

echo "WARNING: This script is state-aware for ${STUDENT_EMAIL}."
echo "Repeated runs on the same ledger may reuse previously completed rule-test agreements."
echo "Set REQUIRE_CLEAN_RULE_STATE=true to fail fast if completed history already exists."

echo "Using companyId=$COMPANY_ID facultyId=$FACULTY_ID"
echo "Using studentEmail=$STUDENT_EMAIL"
echo "Using overlapStudentEmail=$OVERLAP_STUDENT_EMAIL"
echo
echo "=== Getting tokens ==="

STUDENT_TOKEN="$(get_token "$STUDENT_EMAIL" "$STUDENT_PASSWORD")"
OVERLAP_STUDENT_TOKEN="$(get_token "$OVERLAP_STUDENT_EMAIL" "$OVERLAP_STUDENT_PASSWORD")"
COMPANY_TOKEN="$(get_token "$COMPANY_EMAIL" "$COMPANY_PASSWORD")"
FACULTY_TOKEN="$(get_token "$FACULTY_EMAIL" "$FACULTY_PASSWORD")"
CENTRAL_TOKEN="$(get_token "$CENTRAL_EMAIL" "$CENTRAL_PASSWORD")"

echo "Student token length: ${#STUDENT_TOKEN}"
echo "Overlap student token length: ${#OVERLAP_STUDENT_TOKEN}"
echo "Company token length: ${#COMPANY_TOKEN}"
echo "Faculty token length: ${#FACULTY_TOKEN}"
echo "Central token length: ${#CENTRAL_TOKEN}"

[[ -n "$STUDENT_TOKEN" ]] || fail "student token is empty"
[[ -n "$OVERLAP_STUDENT_TOKEN" ]] || fail "overlap student token is empty"
[[ -n "$COMPANY_TOKEN" ]] || fail "company token is empty"
[[ -n "$FACULTY_TOKEN" ]] || fail "faculty token is empty"
[[ -n "$CENTRAL_TOKEN" ]] || fail "central token is empty"

print_progress_summary "Preflight Rule-Test Student Progress"

if is_truthy "$REQUIRE_CLEAN_RULE_STATE" && [[ "$COMPLETED_MANDATORY_COUNT" -gt 0 || "$COMPLETED_VOLUNTARY_DAYS" -gt 0 ]]; then
  fail "Rule test requires clean state for ${STUDENT_EMAIL} but completed agreements already exist."
fi

echo
echo "=== Rule 1: completed credits minimum ==="
set_student_profile "CSE" "Bilgisayar Muhendisligi" "29"
AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$DATE_OFFSET_DAYS")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "20" "$DEFAULT_WORKING_DAYS_JSON")"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "YAZILIM" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status "400" "completed credits minimum"
assert_body_contains "at least 30 completed credits" "completed credits minimum"
set_student_profile "CSE" "Bilgisayar Muhendisligi" "45"

echo
echo "=== Rule 2: start date minimum 15 days ahead ==="
AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "5")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "20" "$DEFAULT_WORKING_DAYS_JSON")"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "YAZILIM" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status "400" "start date minimum 15 days ahead"
assert_body_contains "at least 15 days from today" "start date minimum 15 days ahead"

echo
echo "=== Rule 3a: weekly working days minimum 3 ==="
AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 10))")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "20" '["MON","TUE","WED","THU","FRI"]')"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "YAZILIM" '["MON","TUE"]')"
print_last_response
assert_status "400" "weekly working days minimum 3"
assert_body_contains "between 3 and 6" "weekly working days minimum 3"

echo
echo "=== Rule 3b: weekly working days invalid / too many ==="
AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 20))")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "20" '["MON","TUE","WED","THU","FRI"]')"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "YAZILIM" '["MON","TUE","WED","THU","FRI","SAT","SUN"]')"
print_last_response
assert_status "400" "weekly working days invalid / too many"
assert_body_contains "Working days" "weekly working days invalid / too many"

echo
echo "=== Rule 4a: mandatory minimum working days for CSE/AIE ==="
set_student_profile "CSE" "Bilgisayar Muhendisligi" "45"
AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 30))")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "19" "$DEFAULT_WORKING_DAYS_JSON")"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "YAZILIM" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status "400" "mandatory minimum working days for CSE/AIE"
assert_body_contains "at least 20 working days" "mandatory minimum working days for CSE/AIE"

echo
echo "=== Rule 4b: mandatory minimum working days for ME ==="
set_student_profile "ME" "Makine Muhendisligi" "45"
AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 40))")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "21" "$DEFAULT_WORKING_DAYS_JSON")"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "ARGE" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status "400" "mandatory minimum working days for ME"
assert_body_contains "at least 22 working days" "mandatory minimum working days for ME"
set_student_profile "CSE" "Bilgisayar Muhendisligi" "45"

echo
echo "=== Rule 5: voluntary minimum working days ==="
AG_ID="$(next_agreement_id)"
VOLUNTARY_MIN_WORKING_DAYS_JSON='["MON","TUE","WED"]'
START_DATE="$(next_weekday_after "$((DATE_OFFSET_DAYS + 50))" "MON")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(python3 - <<PY
from datetime import date, timedelta
start_date = date.fromisoformat("${START_DATE}")
print((start_date + timedelta(days=20)).isoformat())
PY
)"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "VOLUNTARY" "$DEFAULT_VOLUNTARY_FIELD" "$VOLUNTARY_MIN_WORKING_DAYS_JSON")"
print_last_response
assert_status "400" "voluntary minimum working days"
assert_body_contains "at least 10 working days" "voluntary minimum working days"

echo
echo "=== Rule 9: overlap should fail ==="
OVERLAP_WORKING_DAYS_JSON='["MON","TUE","WED","THU"]'
BASE_OVERLAP_ID="$(next_agreement_id)"
BASE_START_DATE="$(next_weekday_after "$((DATE_OFFSET_DAYS + 60))" "MON")"
BASE_START_DATE="$(compute_safe_start_date "$OVERLAP_STUDENT_TOKEN" "$BASE_START_DATE")"
BASE_END_DATE="$(python3 - <<PY
from datetime import date, timedelta
start_date = date.fromisoformat("${BASE_START_DATE}")
print((start_date + timedelta(days=20)).isoformat())
PY
)"
api_call "POST" "/api/agreements" "$OVERLAP_STUDENT_TOKEN" "$(create_agreement_payload \
  "$BASE_OVERLAP_ID" "$BASE_START_DATE" "$BASE_END_DATE" "VOLUNTARY" "$DEFAULT_VOLUNTARY_FIELD" "$OVERLAP_WORKING_DAYS_JSON")"
print_last_response
assert_status "201" "overlap base create"
BASE_OVERLAP_ID="$(printf '%s' "$LAST_BODY" | extract_data_id)"
[[ -n "$BASE_OVERLAP_ID" ]] || fail "overlap base create: agreement id missing from create response"

OVERLAP_ID="$(next_agreement_id)"
OVERLAP_START_DATE="$(python3 - <<PY
from datetime import date, timedelta
base_start_date = date.fromisoformat("${BASE_START_DATE}")
print((base_start_date + timedelta(days=7)).isoformat())
PY
)"
OVERLAP_END_DATE="$(python3 - <<PY
from datetime import date, timedelta
overlap_start_date = date.fromisoformat("${OVERLAP_START_DATE}")
print((overlap_start_date + timedelta(days=20)).isoformat())
PY
)"
api_call "POST" "/api/agreements" "$OVERLAP_STUDENT_TOKEN" "$(create_agreement_payload \
  "$OVERLAP_ID" "$OVERLAP_START_DATE" "$OVERLAP_END_DATE" "VOLUNTARY" "DONANIM" "$OVERLAP_WORKING_DAYS_JSON")"
print_last_response
assert_status_one_of "400" "409" "overlap should fail"
assert_body_contains "overlap" "overlap should fail"

api_call "POST" "/api/agreements/$BASE_OVERLAP_ID/approve" "$OVERLAP_STUDENT_TOKEN"
print_last_response
assert_status "200" "prepare overlap base agreement for cleanup"

api_call "POST" "/api/agreements/$BASE_OVERLAP_ID/reject" "$COMPANY_TOKEN" '{"reason":"MISSING_DOCUMENT"}'
print_last_response
assert_status "200" "cleanup overlap base agreement"

echo
echo "=== Rule 7: repeated mandatory field should fail ==="
refresh_progress_for_token "$OVERLAP_STUDENT_TOKEN" "REPEAT"
if [[ "${REPEAT_COMPLETED_MANDATORY_COUNT}" -eq 0 ]]; then
  FIELD_FOR_REPEAT_TEST="$(pick_first_missing_cse_field "${REPEAT_COMPLETED_MANDATORY_FIELDS}")"
  ORIGINAL_STUDENT_TOKEN="$STUDENT_TOKEN"
  STUDENT_TOKEN="$OVERLAP_STUDENT_TOKEN"
  create_and_complete_agreement \
    "MANDATORY" \
    "$FIELD_FOR_REPEAT_TEST" \
    "$DEFAULT_WORKING_DAYS_JSON" \
    "20" \
    "$((DATE_OFFSET_DAYS + 90))" \
    "seed repeated mandatory field"
  STUDENT_TOKEN="$ORIGINAL_STUDENT_TOKEN"
  refresh_progress_for_token "$OVERLAP_STUDENT_TOKEN" "REPEAT"
else
  FIELD_FOR_REPEAT_TEST="${REPEAT_COMPLETED_MANDATORY_FIELDS%%|*}"
fi

AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 120))")"
START_DATE="$(compute_safe_start_date "$OVERLAP_STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "20" "$DEFAULT_WORKING_DAYS_JSON")"
api_call "POST" "/api/agreements" "$OVERLAP_STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "$FIELD_FOR_REPEAT_TEST" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status_one_of "400" "409" "repeated mandatory field should fail"
assert_body_contains_one_of "same internship field" "same field" "repeated mandatory field should fail"

echo
echo "=== Rule 8: maximum 2 completed mandatory internships ==="
refresh_student_progress
while [[ "$COMPLETED_MANDATORY_COUNT" -lt 2 ]]; do
  NEXT_FIELD="$(pick_first_missing_cse_field "$COMPLETED_MANDATORY_FIELDS")"
  create_and_complete_agreement \
    "MANDATORY" \
    "$NEXT_FIELD" \
    "$DEFAULT_WORKING_DAYS_JSON" \
    "20" \
    "$((DATE_OFFSET_DAYS + 150 + COMPLETED_MANDATORY_COUNT * 40))" \
    "seed mandatory count limit"
  refresh_student_progress
done

AG_ID="$(next_agreement_id)"
EXTRA_MANDATORY_FIELD="$(pick_first_missing_cse_field "$COMPLETED_MANDATORY_FIELDS")"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 250))")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "20" "$DEFAULT_WORKING_DAYS_JSON")"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "MANDATORY" "$EXTRA_MANDATORY_FIELD" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status_one_of "400" "409" "maximum 2 completed mandatory internships"
assert_body_contains "maximum" "maximum 2 completed mandatory internships"

echo
echo "=== Rule 6: voluntary total cap = 50 ==="
refresh_student_progress
while [[ "$COMPLETED_VOLUNTARY_DAYS" -lt 20 ]]; do
  create_and_complete_agreement \
    "VOLUNTARY" \
    "$DEFAULT_VOLUNTARY_FIELD" \
    "$DEFAULT_WORKING_DAYS_JSON" \
    "20" \
    "$((DATE_OFFSET_DAYS + 300 + COMPLETED_VOLUNTARY_DAYS * 2))" \
    "seed voluntary total cap"
  refresh_student_progress
done

AG_ID="$(next_agreement_id)"
START_DATE="$(iso_date_after "$((DATE_OFFSET_DAYS + 420))")"
START_DATE="$(compute_safe_start_date "$STUDENT_TOKEN" "$START_DATE")"
END_DATE="$(calculate_end_date_for_min_workdays "$START_DATE" "31" "$DEFAULT_WORKING_DAYS_JSON")"
END_DATE="$(ensure_min_calendar_span "$START_DATE" "$END_DATE" "20")"
api_call "POST" "/api/agreements" "$STUDENT_TOKEN" "$(create_agreement_payload \
  "$AG_ID" "$START_DATE" "$END_DATE" "VOLUNTARY" "$DEFAULT_VOLUNTARY_FIELD" "$DEFAULT_WORKING_DAYS_JSON")"
print_last_response
assert_status_one_of "400" "409" "voluntary total cap = 50"
assert_body_contains "50 total voluntary internship days" "voluntary total cap = 50"

echo
echo "=== DONE ==="
print_progress_summary "Final Rule-Test Student Progress"
echo "Rule enforcement test completed successfully."
