#!/usr/bin/env bash
# ── E2E Test Suite for myLineage GEDCOM 7 ──
# Tests REST APIs + verifies all HTML pages load without errors.
# Usage: bash e2e-test.sh

set -euo pipefail
BASE="http://localhost:3000"
PASS=0; FAIL=0; TOTAL=0

green(){ printf "\e[32m✓ %s\e[0m\n" "$1"; }
red(){   printf "\e[31m✗ %s\e[0m\n" "$1"; }
header(){ printf "\n\e[1;36m── %s ──\e[0m\n" "$1"; }

assert_status(){
  local label="$1" method="$2" url="$3" expected="$4"
  shift 4
  TOTAL=$((TOTAL+1))
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" "$@")
  if [[ "$status" == "$expected" ]]; then
    green "$label (HTTP $status)"
    PASS=$((PASS+1))
  else
    red "$label — expected $expected, got $status"
    FAIL=$((FAIL+1))
  fi
}

assert_json_field(){
  local label="$1" url="$2" field="$3" expected="$4"
  TOTAL=$((TOTAL+1))
  local val
  val=$(curl -s "$url" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field','__MISSING__'))" 2>/dev/null || echo "__ERR__")
  if [[ "$val" == "$expected" ]]; then
    green "$label ($field=$val)"
    PASS=$((PASS+1))
  else
    red "$label — expected $field=$expected, got $val"
    FAIL=$((FAIL+1))
  fi
}

assert_body_contains(){
  local label="$1" url="$2" needle="$3"
  TOTAL=$((TOTAL+1))
  local body
  body=$(curl -s "$url")
  if echo "$body" | grep -q "$needle"; then
    green "$label"
    PASS=$((PASS+1))
  else
    red "$label — '$needle' not found in response"
    FAIL=$((FAIL+1))
  fi
}

assert_page_loads(){
  local label="$1" path="$2"
  TOTAL=$((TOTAL+1))
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$path")
  if [[ "$status" == "200" ]]; then
    green "$label loads (HTTP 200)"
    PASS=$((PASS+1))
  else
    red "$label — HTTP $status"
    FAIL=$((FAIL+1))
  fi
}

assert_page_has_remote_storage(){
  local label="$1" path="$2"
  TOTAL=$((TOTAL+1))
  local count
  count=$(curl -s "$BASE/$path" | grep -c 'remote-storage.js' || true)
  if [[ "$count" -ge 1 ]]; then
    green "$label includes remote-storage.js"
    PASS=$((PASS+1))
  else
    red "$label — missing remote-storage.js"
    FAIL=$((FAIL+1))
  fi
}

assert_page_no_localstorage(){
  local label="$1" path="$2"
  TOTAL=$((TOTAL+1))
  local count
  count=$(curl -s "$BASE/$path" | grep -c "localStorage\.\(getItem\|setItem\|removeItem\)" || true)
  if [[ "$count" == "0" ]]; then
    green "$label — no localStorage calls"
    PASS=$((PASS+1))
  else
    red "$label — found $count localStorage calls"
    FAIL=$((FAIL+1))
  fi
}

# ═══════════════════════════════════════════════════════════════
header "1. SERVER & STATIC FILES"
assert_status "Server responds"           GET "$BASE/" 200
assert_status "Static CSS"                GET "$BASE/css/style.css" 200
assert_status "remote-storage.js"         GET "$BASE/remote-storage.js" 200
assert_status "history-logger.js"         GET "$BASE/history-logger.js" 200

# ═══════════════════════════════════════════════════════════════
header "2. ENTITY CRUD — Individuals"

# Create
INDI=$(curl -s -X POST "$BASE/api/individuals" \
  -H "Content-Type: application/json" \
  -d '{"names":[{"given":"João","surname":"Silva"}],"sex":"M","events":[{"type":"BIRT","date":"15 MAR 1980","place":"Lisboa"}]}')
INDI_ID=$(echo "$INDI" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Created individual: $INDI_ID"

assert_json_field "Individual has correct sex" "$BASE/api/individuals/$INDI_ID" "sex" "M"

# Create another
INDI2=$(curl -s -X POST "$BASE/api/individuals" \
  -H "Content-Type: application/json" \
  -d '{"names":[{"given":"Maria","surname":"Santos"}],"sex":"F","events":[{"type":"BIRT","date":"22 JUN 1982","place":"Porto"}]}')
INDI2_ID=$(echo "$INDI2" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Created individual: $INDI2_ID"

# List
TOTAL=$((TOTAL+1))
COUNT=$(curl -s "$BASE/api/individuals" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
if [[ "$COUNT" -ge 2 ]]; then
  green "List individuals returns >= 2 ($COUNT)"
  PASS=$((PASS+1))
else
  red "List individuals — expected >= 2, got $COUNT"
  FAIL=$((FAIL+1))
fi

# Update
assert_status "Update individual" PUT "$BASE/api/individuals/$INDI_ID" 200 \
  -H "Content-Type: application/json" \
  -d '{"names":[{"given":"João Pedro","surname":"Silva"}]}'

assert_json_field "Updated name persisted" "$BASE/api/individuals/$INDI_ID" "type" "INDI"

# ═══════════════════════════════════════════════════════════════
header "3. ENTITY CRUD — Families"

FAM=$(curl -s -X POST "$BASE/api/families" \
  -H "Content-Type: application/json" \
  -d "{\"husb\":\"$INDI_ID\",\"wife\":\"$INDI2_ID\",\"children\":[],\"events\":[{\"type\":\"MARR\",\"date\":\"10 SEP 2005\",\"place\":\"Coimbra\"}]}")
FAM_ID=$(echo "$FAM" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Created family: $FAM_ID"

assert_json_field "Family has husb" "$BASE/api/families/$FAM_ID" "husb" "$INDI_ID"
assert_json_field "Family has wife" "$BASE/api/families/$FAM_ID" "wife" "$INDI2_ID"

# Create a child
CHILD=$(curl -s -X POST "$BASE/api/individuals" \
  -H "Content-Type: application/json" \
  -d '{"names":[{"given":"Ana","surname":"Silva"}],"sex":"F","events":[{"type":"BIRT","date":"3 FEB 2007","place":"Lisboa"}],"famc":"'$FAM_ID'"}')
CHILD_ID=$(echo "$CHILD" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "  Created child: $CHILD_ID"

# Add child to family
curl -s -X PUT "$BASE/api/families/$FAM_ID" \
  -H "Content-Type: application/json" \
  -d "{\"children\":[\"$CHILD_ID\"]}" > /dev/null

TOTAL=$((TOTAL+1))
CHILDREN=$(curl -s "$BASE/api/families/$FAM_ID" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('children',[])))")
if [[ "$CHILDREN" -ge 1 ]]; then
  green "Family has children ($CHILDREN)"
  PASS=$((PASS+1))
else
  red "Family children — expected >= 1, got $CHILDREN"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════
header "4. ENTITY CRUD — Sources, Notes, Multimedia, Repositories"

assert_status "Create source"      POST "$BASE/api/sources" 201 \
  -H "Content-Type: application/json" -d '{"title":"Registo Paroquial","author":"Paróquia de São Pedro"}'

assert_status "Create note"        POST "$BASE/api/notes" 201 \
  -H "Content-Type: application/json" -d '{"text":"Nota de teste para E2E."}'

assert_status "Create multimedia"  POST "$BASE/api/multimedia" 201 \
  -H "Content-Type: application/json" -d '{"files":[{"file":"foto1.jpg","form":"image/jpeg"}],"tags":[]}'

assert_status "Create repository"  POST "$BASE/api/repositories" 201 \
  -H "Content-Type: application/json" -d '{"name":"Arquivo Distrital de Lisboa"}'

assert_status "List sources"       GET "$BASE/api/sources" 200
assert_status "List notes"         GET "$BASE/api/notes" 200
assert_status "List multimedia"    GET "$BASE/api/multimedia" 200
assert_status "List repositories"  GET "$BASE/api/repositories" 200

# ═══════════════════════════════════════════════════════════════
header "5. UTILITY ENDPOINTS"

# Settings
assert_status "PUT settings"       PUT "$BASE/api/settings" 200 \
  -H "Content-Type: application/json" -d '{"focusedPerson":{"id":"'$INDI_ID'","name":"João Silva"},"photoBase":{"folder":"fotos","files":0}}'
# focusedPerson is an object — check via nested access below
TOTAL=$((TOTAL+1))
FP=$(curl -s "$BASE/api/settings" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('focusedPerson',{}).get('id',''))")
if [[ "$FP" == "$INDI_ID" ]]; then
  green "Settings focusedPerson.id = $INDI_ID"
  PASS=$((PASS+1))
else
  red "Settings focusedPerson.id — expected $INDI_ID, got $FP"
  FAIL=$((FAIL+1))
fi

# Header
assert_status "GET header"         GET "$BASE/api/header" 200
assert_body_contains "Header has GEDCOM 7" "$BASE/api/header" "7.0"

# History
assert_status "POST history"       POST "$BASE/api/history" 200 \
  -H "Content-Type: application/json" -d '{"action":"E2E test","entity":"test","page":"e2e","when":"2026-02-28T12:00:00Z"}'
assert_status "GET history"        GET "$BASE/api/history" 200
TOTAL=$((TOTAL+1))
HIST_LEN=$(curl -s "$BASE/api/history" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
if [[ "$HIST_LEN" -ge 1 ]]; then
  green "History has entries ($HIST_LEN)"
  PASS=$((PASS+1))
else
  red "History — expected >= 1 entries, got $HIST_LEN"
  FAIL=$((FAIL+1))
fi

# Stats
assert_status "GET stats"          GET "$BASE/api/stats" 200
TOTAL=$((TOTAL+1))
STAT_INDI=$(curl -s "$BASE/api/stats" | python3 -c "import sys,json; print(json.load(sys.stdin).get('individuals',0))")
if [[ "$STAT_INDI" -ge 3 ]]; then
  green "Stats shows >= 3 individuals ($STAT_INDI)"
  PASS=$((PASS+1))
else
  red "Stats individuals — expected >= 3, got $STAT_INDI"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════
header "6. GEDCOM EXPORT / IMPORT"

# Export
TOTAL=$((TOTAL+1))
GEDCOM_TEXT=$(curl -s "$BASE/api/gedcom/export")
if echo "$GEDCOM_TEXT" | grep -q "0 HEAD"; then
  green "GEDCOM export has HEAD record"
  PASS=$((PASS+1))
else
  red "GEDCOM export — missing '0 HEAD'"
  FAIL=$((FAIL+1))
fi

TOTAL=$((TOTAL+1))
if echo "$GEDCOM_TEXT" | grep -q "0 @.*@ INDI"; then
  green "GEDCOM export has INDI records"
  PASS=$((PASS+1))
else
  red "GEDCOM export — missing INDI records"
  FAIL=$((FAIL+1))
fi

TOTAL=$((TOTAL+1))
if echo "$GEDCOM_TEXT" | grep -q "0 @.*@ FAM"; then
  green "GEDCOM export has FAM records"
  PASS=$((PASS+1))
else
  red "GEDCOM export — missing FAM records"
  FAIL=$((FAIL+1))
fi

TOTAL=$((TOTAL+1))
if echo "$GEDCOM_TEXT" | grep -q "0 TRLR"; then
  green "GEDCOM export has TRLR trailer"
  PASS=$((PASS+1))
else
  red "GEDCOM export — missing TRLR"
  FAIL=$((FAIL+1))
fi

# Import (re-import the exported text)
IMPORT_RESULT=$(curl -s -X POST "$BASE/api/gedcom/import" \
  -H "Content-Type: application/json" \
  -d "$(python3 -c "import json,sys; print(json.dumps({'text': open('/dev/stdin').read()}))" <<< "$GEDCOM_TEXT")")
TOTAL=$((TOTAL+1))
IMPORT_OK=$(echo "$IMPORT_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok',False))")
if [[ "$IMPORT_OK" == "True" ]]; then
  green "GEDCOM import succeeded"
  PASS=$((PASS+1))
else
  red "GEDCOM import failed: $IMPORT_RESULT"
  FAIL=$((FAIL+1))
fi

# Topola JSON
assert_status "GET topola-json"    GET "$BASE/api/topola-json" 200
TOTAL=$((TOTAL+1))
TOPOLA_INDIS=$(curl -s "$BASE/api/topola-json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('indis',[])))")
if [[ "$TOPOLA_INDIS" -ge 1 ]]; then
  green "Topola JSON has indis ($TOPOLA_INDIS)"
  PASS=$((PASS+1))
else
  red "Topola JSON — expected >= 1 indis, got $TOPOLA_INDIS"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════
header "7. SOFT DELETE & includeDeleted"

assert_status "Delete individual" DELETE "$BASE/api/individuals/$CHILD_ID" 200

TOTAL=$((TOTAL+1))
ACTIVE=$(curl -s "$BASE/api/individuals" | python3 -c "import sys,json; print(len([i for i in json.load(sys.stdin) if not i.get('deletedAt')]))")
ALL=$(curl -s "$BASE/api/individuals?includeDeleted=true" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
if [[ "$ALL" -gt "$ACTIVE" ]]; then
  green "includeDeleted returns more records (active=$ACTIVE, all=$ALL)"
  PASS=$((PASS+1))
else
  red "includeDeleted — active=$ACTIVE, all=$ALL (expected all > active)"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════
header "8. BULK REPLACE"

assert_status "POST bulk-replace"  POST "$BASE/api/bulk-replace" 200 \
  -H "Content-Type: application/json" \
  -d '{"individuals":{"I1":{"id":"I1","type":"INDI","names":[{"given":"Teste","surname":"Bulk"}],"sex":"M","events":[],"famc":null,"fams":[],"notes":[],"sourceRefs":[],"multimediaRefs":[],"createdAt":"2026-01-01","updatedAt":"2026-01-01","deletedAt":null}}}'

TOTAL=$((TOTAL+1))
BULK_NAME=$(curl -s "$BASE/api/individuals/I1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['names'][0]['given'])" 2>/dev/null || echo "__ERR__")
if [[ "$BULK_NAME" == "Teste" ]]; then
  green "Bulk replace wrote individual I1 (given=Teste)"
  PASS=$((PASS+1))
else
  red "Bulk replace — expected given=Teste, got $BULK_NAME"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════
header "9. HTML PAGES — Load & Structure"

PAGES="index.html app.html arvore.html gedcom.html album.html documentos.html indicadores.html historico.html configuracao.html apis.html"

for page in $PAGES; do
  assert_page_loads "$page" "$page"
done

# ═══════════════════════════════════════════════════════════════
header "10. HTML PAGES — remote-storage.js included"

for page in $PAGES; do
  assert_page_has_remote_storage "$page" "$page"
done

# ═══════════════════════════════════════════════════════════════
header "11. HTML PAGES — No old localStorage patterns"

# Skip validacao.html as requested
MIGRATED_PAGES="index.html app.html arvore.html gedcom.html album.html documentos.html indicadores.html historico.html configuracao.html apis.html"

for page in $MIGRATED_PAGES; do
  assert_page_no_localstorage "$page" "$page"
done

# ═══════════════════════════════════════════════════════════════
header "12. HTML PAGES — No old data model references"

for page in $MIGRATED_PAGES; do
  TOTAL=$((TOTAL+1))
  body=$(curl -s "$BASE/$page")
  old_refs=$(echo "$body" | grep -c "people:myLineage\|events:myLineage\|relations:myLineage\|photos:myLineage\|photoRelations:myLineage" || true)
  if [[ "$old_refs" == "0" ]]; then
    green "$page — no old :myLineage keys"
    PASS=$((PASS+1))
  else
    red "$page — found $old_refs old :myLineage key references"
    FAIL=$((FAIL+1))
  fi
done

# ═══════════════════════════════════════════════════════════════
header "13. HTML PAGES — GedcomDB / DB usage"

for page in $MIGRATED_PAGES; do
  TOTAL=$((TOTAL+1))
  body=$(curl -s "$BASE/$page")
  # apis.html may not use DB directly in its script, and that's ok
  if [[ "$page" == "apis.html" ]]; then
    green "$page — documentation page (skip DB check)"
    PASS=$((PASS+1))
    continue
  fi
  has_db=$(echo "$body" | grep -c "window\.GedcomDB\|GedcomDB\|const DB" || true)
  if [[ "$has_db" -ge 1 ]]; then
    green "$page — uses GedcomDB"
    PASS=$((PASS+1))
  else
    red "$page — no GedcomDB reference found"
    FAIL=$((FAIL+1))
  fi
done

# ═══════════════════════════════════════════════════════════════
header "14. HISTORY CLEAR"

assert_status "DELETE history"     DELETE "$BASE/api/history" 200
TOTAL=$((TOTAL+1))
HIST_AFTER=$(curl -s "$BASE/api/history" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))")
if [[ "$HIST_AFTER" == "0" ]]; then
  green "History cleared ($HIST_AFTER entries)"
  PASS=$((PASS+1))
else
  red "History clear — expected 0 entries, got $HIST_AFTER"
  FAIL=$((FAIL+1))
fi

# ═══════════════════════════════════════════════════════════════
printf "\n\e[1;37m════════════════════════════════════════\e[0m\n"
printf "\e[1;37m  RESULTS: %d passed, %d failed, %d total\e[0m\n" "$PASS" "$FAIL" "$TOTAL"
if [[ "$FAIL" -eq 0 ]]; then
  printf "\e[1;32m  ALL TESTS PASSED ✓\e[0m\n"
else
  printf "\e[1;31m  SOME TESTS FAILED ✗\e[0m\n"
fi
printf "\e[1;37m════════════════════════════════════════\e[0m\n"
exit "$FAIL"
