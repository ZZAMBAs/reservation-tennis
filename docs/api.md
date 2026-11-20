# 서버 API

M2의 API이며 `/v1`은 `Authorization: Bearer <Firebase ID 토큰>`을 요구한다. Firebase에서 검증한 Google 계정과 서버의 `ALLOWED_EMAILS`에 등록된 이메일만 허용한다. `APP_MODE=development`에서는 `dev:test-user`, `dev:other-user`만 테스트 계정으로 사용한다. 운영 모드에서 개발 인증을 사용할 수 없다.

| 경로 | 메서드 | 동작 |
| --- | --- | --- |
| `/healthz` | GET | 인증 없이 SQLite 준비 상태 확인. 성공 200, DB 오류 503. |
| `/v1/facilities` | GET | 등록된 시설과 예약 링크·지원 범위 반환. |
| `/v1/home` | GET | 관심 시설과 접수 유형의 오픈 일정·현재 슬롯·시설 조회 상태. `cursor` 쿼리와 응답 `nextCursor`로 다음 10개를 조회한다. |
| `/v1/me/preferences` | GET, PUT | 현재 계정의 설정 읽기·전체 교체. |
| `/v1/me/device` | GET, PUT, DELETE | 활성 기기 읽기·변경·해제. GET은 `installationId`만 반환한다. |

설정 PUT의 본문은 다음과 같다. 비어 있는 `rules`는 선택한 시설의 모든 이용일·시간을 뜻한다. 복수 조건은 OR, 각 조건 안의 항목은 AND로 해석한다. 날짜 범위 양끝과 시간대 전체 포함 기준은 한국 시간에 적용한다. 홈 조회는 시설·접수 유형에 따르며 푸시의 요일·시간 조건으로 줄이지 않는다.

```json
{
  "selections": [{"facilityId": "bucheon-stadium", "types": ["general"]}],
  "openAlerts": true,
  "vacancyAlerts": true,
  "rules": [{"facilityId": "bucheon-stadium", "weekdays": [6, 7], "fromTime": "09:00", "toTime": "12:00", "fromDate": "2026-12-01", "toDate": "2026-12-15"}]
}
```

요일은 월요일 1부터 일요일 7이다. 시간·날짜 조건을 쓸 때는 시작·끝 값을 모두 넣는다. 같은 이용일 하나를 지정하려면 날짜 양끝을 같게 한다. 타입은 `general`, 지원되는 시설의 `resident`다.

기기 PUT은 `installationId`, `pushTarget`, `activate`를 받는다. `activate=true`는 새 활성 기기를 선택하고, `false`는 이미 활성인 설치의 전달 대상 갱신에 사용한다. 이전 기기의 갱신이나 로그아웃으로 새 활성 기기가 바뀌지 않는다. 기기 DELETE는 `installationId`만 받는다. 실제 FCM 식별값은 M4의 SDK 등록 결과를 사용한다.

JSON 쓰기는 `Content-Type: application/json`과 최대 32KiB 본문을 사용한다. 입력 오류는 400, 인증 실패 401, 미승인 계정 403, 잘못된 메서드 405, 크기 초과 413, 형식 불일치 415를 반환한다. 내부 오류는 실제 비밀값이나 DB 오류 대신 `internal_error`만 응답한다. UID는 인증 결과로 결정하며 클라이언트 본문·쿼리의 UID로 변경할 수 없다.

시각 숫자는 UTC Unix 밀리초다. `facilityStates`는 `open_only`, `delayed`, `current`와 마지막 성공 확인 시각을 담는다. 오픈 일정은 운영자 CLI로 검증 후 등록한다. 실제 수집, 알림 상세·클릭·결과 기록은 후속 M3·M4에서 추가한다.
