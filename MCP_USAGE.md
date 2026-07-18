# 투어/레저/택시 공고 MCP 서버 사용 가이드

이 문서는 오픈클로가 "공고(postings) MCP 서버"에 접속해서 투어/레저/택시 참여인원 모집 공고를 조회·등록·참여하는 방법을 설명한다.

## 1. 접속 정보

- MCP 엔드포인트: `https://a2apractice-postings.fly.dev/mcp`
- Transport: Streamable HTTP (stateless — 세션 유지 없이 매 요청 독립적으로 처리됨)
- 인증 없음 (누구나 호출 가능한 테스트 서버, 실데이터 아님)

MCP 클라이언트 설정 파일을 쓰는 구조라면 아래처럼 등록:

```json
{
  "mcpServers": {
    "postings": {
      "url": "https://a2apractice-postings.fly.dev/mcp"
    }
  }
}
```

등록 후 `tools/list`를 호출하면 아래 5개 툴이 보인다.

## 2. 데이터 모델

공고(posting) 하나는 다음 필드를 가진다.

| 필드          | 타입                          | 설명                         |
| ------------- | ----------------------------- | ---------------------------- |
| id            | number                        | 공고 고유 id                 |
| type          | "tour" \| "leisure" \| "taxi" | 공고 종류 (투어/레저/택시)   |
| country       | string                        | 나라                         |
| city          | string                        | 도시                         |
| place         | string \| null                | 장소 — **tour/leisure 전용**. taxi면 항상 null |
| departure     | string \| null                | 출발지 — **taxi 전용**. tour/leisure면 항상 null |
| destination   | string \| null                | 목적지 — **taxi 전용**. tour/leisure면 항상 null |
| date          | string                        | 날짜 (예: "2026-08-01")      |
| time          | string                        | 시간 (예: "10:00")           |
| minPeople     | number                        | 최소 진행 인원               |
| maxPeople     | number                        | 최대 수용 인원               |
| currentPeople | number                        | 현재 채워진 인원             |
| needsNego     | boolean                       | 네고(추가 협의) 필요 여부    |
| price         | number                        | 가격                         |
| agentId       | string                        | 이 공고를 올린 에이전트의 id |
| createdAt     | string                        | 생성 시각                    |

### `needsNego`가 왜 중요한가

`currentPeople`이 `maxPeople`을 초과하는 순간 `needsNego`가 `true`로 바뀐다. 즉 이미 정원이 다 찬 상태에서도 참여를 원하는 사람이 있었다는 뜻이다. 오픈클로는 검색 결과에서 `needsNego: true`인 공고를 발견하면, "정원은 찼지만 인원 추가가 가능한지 공고를 올린 에이전트(`agentId`)와 네고해볼 수 있는 상태"라고 사용자에게 안내해야 한다. `needsNego`는 한 번 true가 되면 다시 false로 돌아가지 않는다 (되돌리는 API 없음).

## 3. 툴별 사용법

### 3.1 `search_postings` — 공고 검색

**언제 호출하나:** 사용자가 "제주도 투어 찾아줘", "부산 택시 있나?"처럼 조건에 맞는 공고를 찾고 싶어 할 때. 가장 먼저/자주 쓰게 될 툴이다.

**파라미터** (전부 선택, 원하는 조건만 넣으면 됨):

- `q` (string): 키워드. `type`/`country`/`city`/`place`/`departure`/`destination` 중 아무 필드에나 부분일치하면 걸린다. 정확한 필터링 조건이 애매할 때 우선 이걸로 넓게 검색.
- `type` ("tour"|"leisure"|"taxi"): 공고 종류로 정확히 필터링
- `country`, `city`: 정확히 일치하는 값으로 필터링 (부분일치 아님 — 부분일치가 필요하면 `q` 사용)
- `date`: 정확한 날짜로 필터링

**응답:** 공고 배열 (조건에 맞는 게 없으면 빈 배열 `[]`, 에러 아님)

**호출 예시:**

```json
{ "city": "제주", "type": "tour" }
```

```json
{ "q": "해운대" }
```

### 3.2 `get_posting` — 특정 공고 단건 조회

**언제 호출하나:** `search_postings`로 이미 id를 알고 있고, 그 공고의 최신 상태(특히 `currentPeople`, `needsNego`가 바뀌었는지)를 다시 확인하고 싶을 때. 예를 들어 참여 신청 직전에 정원이 이미 찼는지 최종 확인하는 용도.

**파라미터:** `id` (number 또는 string)

**응답:** 공고 1건. 존재하지 않는 id면 에러(`isError: true`)와 함께 `"공고를 찾을 수 없습니다"` 메시지 반환.

### 3.3 `create_posting` — 새 공고 등록

**언제 호출하나:** 사용자가 직접 투어/레저/택시 동승자를 모집하는 공고를 올리고 싶어 할 때.

**공통 필수 파라미터:**

- `type`: `"tour"` | `"leisure"` | `"taxi"` 중 하나여야 함
- `country`, `city`: string
- `date`: string (예: `"2026-08-01"`)
- `time`: string (예: `"10:00"`)
- `minPeople`, `maxPeople`: 정수. `minPeople`은 `maxPeople`보다 클 수 없음
- `price`: number
- `agentId`: 이 공고를 올리는 에이전트(오픈클로 자신 또는 대리하는 사용자)의 id

**`type`에 따라 추가로 필요한 파라미터가 다르다:**

- `type`이 `"tour"` 또는 `"leisure"`면 → `place` (string, 필수). `departure`/`destination`은 보내지 않는다.
- `type`이 `"taxi"`면 → `departure`, `destination` (둘 다 string, 필수). `place`는 보내지 않는다 (택시는 장소가 아니라 출발지→목적지 개념이라 필드 자체가 다르다).

**호출 예시 (tour/leisure):**
```json
{ "type": "tour", "country": "South Korea", "city": "Seoul", "place": "Gyeongbokgung Palace", "date": "2026-08-01", "time": "10:00", "minPeople": 2, "maxPeople": 4, "price": 50000, "agentId": "agent-1" }
```

**호출 예시 (taxi):**
```json
{ "type": "taxi", "country": "South Korea", "city": "Busan", "departure": "Gimhae Airport", "destination": "Haeundae Beach", "date": "2026-08-05", "time": "09:00", "minPeople": 1, "maxPeople": 3, "price": 30000, "agentId": "agent-2" }
```

**주의:**

- `country`, `city`, `place`, `departure`, `destination`은 모두 영어로 적는다
- `currentPeople`은 서버가 자동으로 0에서 시작시킨다 (파라미터로 넘길 필요/방법 없음)
- `needsNego`도 서버가 자동으로 false에서 시작시킨다
- `type`에 맞지 않는 필드를 빠뜨리면(예: taxi인데 departure 누락) 에러 메시지로 구체적인 사유가 온다 — 그 메시지를 그대로 사용자에게 보여주면 된다

### 3.4 `join_posting` — 참여인원 +1

**언제 호출하나:** 사용자가 특정 공고에 참여(동승/합류)하기로 확정했을 때. 호출할 때마다 `currentPeople`이 1씩 늘어난다 — **여러 명이 한 번에 참여하려면 인원 수만큼 여러 번 호출**해야 한다 (한 번에 N명 늘리는 파라미터는 없음).

**파라미터:** `id` (number 또는 string)

**동작:**

- `currentPeople`을 무조건 +1 (이미 `maxPeople`에 도달했어도 계속 증가함 — 대기/초과 신청도 기록으로 남긴다는 의미)
- 그 결과 `currentPeople`이 `maxPeople`을 넘으면 `needsNego`가 `true`로 바뀜
- 존재하지 않는 id면 에러 반환

**호출 흐름 예시:** 사용자가 "이 공고에 참여할래"라고 하면 → `get_posting`으로 현재 상태 확인 → 정원 여유 있으면 바로 `join_posting` 호출 → 정원이 이미 다 찼다면(`currentPeople >= maxPeople`) 사용자에게 "정원이 다 찼는데 그래도 신청해서 네고를 시도해보시겠어요?"처럼 확인 후 `join_posting` 호출 (호출하면 `needsNego: true`가 되어 이후 검색하는 다른 에이전트도 이 상태를 알 수 있게 됨)

### 3.5 `delete_posting` — 공고 삭제

**언제 호출하나:** 자신(agentId)이 올린 공고를 취소/삭제하고 싶을 때. 예를 들어 사용자가 "아까 올린 공고 취소해줘"라고 하거나, 정원이 다 차서 더 이상 모집할 필요가 없을 때.

**파라미터:**
- `id` (number 또는 string): 삭제할 공고 id
- `agentId` (string): 이 공고를 올렸던 agentId. **공고의 `agentId`와 정확히 일치해야만 삭제된다** — 다른 agentId로 호출하면 거부됨

**동작:** 성공하면 `{ id, deleted: true }` 반환. 존재하지 않는 id면 `"공고를 찾을 수 없습니다"` 에러, agentId가 다르면 `"본인이 올린 공고만 삭제할 수 있습니다"` 에러.

**주의:** 삭제는 되돌릴 수 없다 (복구 API 없음). 삭제 전에 정말 그 공고가 맞는지 `get_posting`으로 한 번 확인하는 게 안전하다.

## 4. 대표 시나리오

**시나리오 A — 여행 상품 탐색**

1. 사용자: "8월 초에 제주도에서 할 만한 투어 있어?"
2. `search_postings({ city: "제주", type: "tour" })` 호출
3. 결과 목록을 사용자에게 보여주고, 그중 관심있는 공고는 `get_posting`으로 최신 인원 현황 재확인 후 안내

**시나리오 B — 참여 신청**

1. 사용자가 특정 공고(id=5)에 참여하고 싶다고 함
2. `get_posting({ id: 5 })`로 `currentPeople`/`maxPeople` 확인
3. 여유 있으면 `join_posting({ id: 5 })` 호출, 결과의 `currentPeople`/`needsNego`를 사용자에게 알려줌
4. 여유가 없으면(`currentPeople >= maxPeople`) 네고 가능성을 안내하고, 사용자가 원하면 그래도 `join_posting` 호출

**시나리오 C — 공고 등록 (taxi)**

1. 사용자: "내일 김해공항에서 해운대까지 택시 같이 탈 사람 구하는 공고 올려줘, 최대 3명, 3만원"
2. `type: "taxi"`이므로 `place`가 아니라 `departure`(김해공항), `destination`(해운대)을 채워야 함을 인지하고, 나머지 필드(country, city, date, time, minPeople, maxPeople, price, agentId)도 확인/보완
3. `create_posting({ type: "taxi", departure: "Gimhae Airport", destination: "Haeundae Beach", ... })` 호출, 생성된 `id`를 사용자에게 알려줌

**시나리오 C' — 공고 등록 (tour/leisure)**

1. 사용자: "이번 주말 제주 한라산 등반 투어 같이 갈 사람 구하는 공고 올려줘, 최대 4명, 5만원"
2. `type: "tour"`이므로 `place`(한라산)를 채워야 함 — `departure`/`destination`은 사용하지 않음
3. `create_posting({ type: "tour", place: "Hallasan", ... })` 호출, 생성된 `id`를 사용자에게 알려줌

**시나리오 D — 네고 상태 확인**

1. 사용자: "정원 넘게라도 신청된 공고들 있어?"
2. `search_postings`로 넓게 검색한 뒤, 결과 중 `needsNego: true`인 것만 골라 사용자에게 보여주고 해당 공고의 `agentId`에게 네고를 시도해볼 수 있다고 안내

**시나리오 E — 공고 삭제**

1. 사용자: "아까 올린 공고 취소해줘"
2. 삭제할 공고의 id와, 그 공고를 올릴 때 썼던 agentId를 확인 (필요하면 `search_postings`/`get_posting`으로 재확인)
3. `delete_posting({ id, agentId })` 호출. agentId가 안 맞으면 에러가 오니, 자신이 올린 공고가 맞는지 다시 확인하라고 사용자에게 안내

## 5. 에러 처리

모든 툴 호출 실패는 MCP 응답의 `isError: true`와 함께 `content`에 `{"error": "설명"}` 형태의 JSON 텍스트로 온다. 이 메시지를 그대로 파싱해서 사용자에게 이유를 전달하면 된다 (예: `"공고를 찾을 수 없습니다"`, `"필수 필드 누락: city"`, `"type은 tour, leisure, taxi 중 하나여야 합니다"`).
