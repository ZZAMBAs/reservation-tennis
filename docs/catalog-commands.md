# 시설·오픈 일정 관리

서버 디렉터리에서 `npm run manage -- facility examples/bucheon-stadium.json`과 `npm run manage -- facility examples/gmuc-city.json`으로 우선 시설을 등록한다. 지원 방식은 검증 전 `open_only`로 저장된다. API나 크롤링 어댑터의 검증이 끝나면 별도 수집 설정으로 활성화한다.

오픈 일정은 실제 공지를 확인하고 아래 구조의 JSON을 만든 뒤 `npm run manage -- opening <JSON 경로>`로 등록한다. 날짜와 시각은 예시이므로 실제 운영 DB에 그대로 등록하지 않는다.

```json
{
  "id": "bucheon-example-general",
  "facilityId": "bucheon-stadium",
  "reservationType": "general",
  "periodStart": "2026-12-01",
  "periodEnd": "2026-12-31",
  "opensAt": "2026-11-28T09:00:00+09:00",
  "sourceUrl": "https://reserv.bucheon.go.kr/",
  "confirmedAt": "2026-11-20T12:00:00+09:00"
}
```

같은 ID를 등록하면 일정이 수정되고 버전이 증가한다. `npm run manage -- cancel-opening <ID>`는 일정 취소로 저장한다. 한 번 취소한 일정을 다시 등록하면 활성화된다.

개발 DB에서 샘플을 만들려면 `APP_MODE=development`를 설정한 뒤 `npm run manage -- sample`을 실행한다. 12개 코트와 12분 후 오픈 예정인 개발 시설을 생성한다. `NODE_ENV=production`이면 샘플 명령은 실패한다. 샘플은 한 시간 동안 홈 조회에 사용되며 만료되면 다시 생성할 수 있다.
