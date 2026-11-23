# M1 구동 검증

확인일은 2026-11-20이며 이슈 #5의 검증 결과다. 기준 코드는 `f0d8098`이며 이 브랜치는 실행 테스트만 추가한다.

| 항목 | 명령과 결과 |
| --- | --- |
| 서버 HTTP·SQLite | `cd server` 후 `npm test`. 상태 확인 200, 미존재 경로 404, 허용되지 않은 메서드 405를 확인한다. 서버 재시작 후 직접 기록한 SQLite 행과 `quick_check`를 검증했다. |
| Docker Compose | `pwsh -File scripts/verify-compose.ps1` 통과. 이미지 빌드, healthcheck, 컨테이너 재생성 후 SQLite 행 보존, `quick_check`, HTTP readiness를 확인하고 테스트 자원을 정리했다. |
| Flutter 분석 | Flutter 3.50.0에서 `flutter analyze --no-pub` 통과. |
| Flutter 화면 전환 | `flutter test --no-pub` 통과. 홈에서 마이페이지로 이동하고 돌아오는 기존 테스트다. |
| Android 개발 환경 | `flutter doctor -v`에서 Android SDK를 찾지 못했다. APK 빌드와 실기기 설치는 아직 검증하지 못했다. |

## 재현

Docker Desktop을 시작하고 루트에서 `pwsh -File scripts/verify-compose.ps1`을 실행한다. 스크립트는 임의의 프로젝트 이름과 사용 가능한 루프백 포트로 컨테이너를 빌드해 healthcheck를 확인한다. SQLite에 테스트 행을 기록한 다음 컨테이너를 재생성하고 데이터 보존과 HTTP readiness를 확인한다. 마지막에는 해당 실행에서 생성한 Compose 자원만 정리한다.

Android 개발 환경을 준비한 뒤 `flutter doctor -v`, `flutter build apk --debug`, 실제 기기에서의 실행을 확인해야 M1의 Android 항목을 완료할 수 있다. 현재 릴리스 설정은 디버그 서명을 사용하므로 파일럿 배포 전 M5에서 운영 서명으로 변경한다.

## 2026-11-23 Android 후속 검증

이슈 #18에서 Flutter 3.50.1과 Android 도구·라이선스 정상 상태를 확인했다. 이 세션에는 새 PATH가 반영되지 않아 SDK 절대 경로를 사용했다. `flutter devices`에는 Windows와 브라우저만 표시되어 Android 실기기 실행은 미검증이다.

- 첫 `flutter build apk --debug`는 Windows 한글 경로 검사에서 실패했다. 환경 변수로만 옵션을 전달한 재시도도 같은 검사에서 중단됐다.
- `app/android/gradle.properties`에 `android.overridePathCheck=true`를 적용한 뒤 다시 빌드했다. SDK Platform 36 설치 후 약 195초 만에 APK 생성에 성공했다. 산출물은 `app/build/app/outputs/flutter-apk/app-debug.apk`이며 Git에서 제외된다. 빌드 설정 커밋은 `8d2123e`다.
- 첫 빌드의 SDK 설치 중 병렬로 시도한 `signingReport`는 NDK 설치 미완료로 실패했다. APK 빌드가 끝난 뒤 순차 재실행해 `BUILD SUCCESSFUL`과 debug SHA-1을 확인했다. 이후 재현에서는 SDK 설치와 서명 조회를 순서대로 실행한다.
- 실제 Google 로그인·FCM과 릴리스 서명 검증은 아직 수행하지 않았다. 앱의 Firebase 연결은 M4에서 진행한다.
