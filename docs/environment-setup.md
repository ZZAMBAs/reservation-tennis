# 사용자 준비 안내

Flutter 3.50.1과 Android 빌드 환경에서 디버그 APK와 서명 지문을 확인했다. 앱에 Firebase Core를 연결했고, 로컬 `google-services.json`의 프로젝트와 Android 패키지가 일치하는 것을 확인했다. Google 로그인에 필요한 OAuth 항목은 이 파일에 아직 없다. 사용자 작업은 아래 1절에, 개발·검증 상태는 [마일스톤](../milestones.md)에 기록한다.

## 1. 사용자 작업 · Firebase 콘솔 설정과 파일 배치

1. Firebase의 기존 프로젝트를 연다. 프로젝트 설정 → 내 앱에서 패키지 `dev.tennisreservation.tennis_reservation`으로 등록한 앱을 선택한다. 등록 화면의 **SDK 추가**는 Flutter 앱 코드에 적용했다.
2. 해당 앱에 **현재 디버그 APK의 SHA-1**을 추가한다. 이전 검증에서 안내한 지문은 같은 디버그 키를 사용하는 동안 그대로 쓸 수 있다. 키가 바뀌었거나 새 PC라면, APK를 빌드한 후 저장소의 `app/android`에서 `.\gradlew.bat signingReport`를 실행하고 `Variant: debug` 아래의 `SHA1`을 사용한다. Java가 감지되지 않으면 Android Studio에 포함된 JDK 경로를 현재 터미널의 `JAVA_HOME`으로 지정한다.
3. Authentication에 처음 들어가면 **시작하기**를 누른다. Sign-in method에서 **Google**을 활성화하고 지원 이메일을 선택한 뒤 저장한다. SHA-1 등록과 Google 활성화를 마친 뒤 프로젝트 설정의 같은 Android 앱에서 `google-services.json`을 다시 다운로드한다.
4. 새 파일을 저장소의 `app/android/app/google-services.json`에 놓는다. 다운로드 파일명에 `(1)`이 붙었다면 목적지에서는 정확히 `google-services.json`으로 둔다. Git 제외 여부는 저장소 루트에서 `git check-ignore -v -- app/android/app/google-services.json`으로 확인할 수 있다. 이미 파일을 교체했는데 OAuth 항목이 없으면 같은 프로젝트에서 지문과 Google 로그인 설정이 각각 저장됐는지 확인한 뒤 다시 내려받는다. 완료 여부만 공유한다. [Firebase Android Google 로그인 설정](https://firebase.google.com/docs/auth/android/google-signin)

## 2. 기존 Flutter 앱 실행과 SDK 연결

기기 연결은 1절과 병행할 수 있다. Android Studio에서 저장소의 기존 `app` 폴더를 연다. 휴대전화의 개발자 옵션에서 USB 디버깅을 켜고 데이터 전송이 가능한 케이블로 연결한 뒤 휴대전화에서 이 PC를 허용한다. 저장소 루트에서 다음을 실행한다.

```powershell
Set-Location app
flutter devices
```

기기가 표시되면 `app` 폴더에서 `flutter run -d 'DEVICE_ID'`를 실행한다. `DEVICE_ID`는 목록의 실제 ID로 바꾼다. 현재 APK에서는 홈과 마이페이지를 확인할 수 있다. `flutter`를 찾지 못하면 새 터미널을 열고 Flutter SDK의 `bin`이 PATH에 있는지 확인한다. 기존 APK는 `app/build/app/outputs/flutter-apk/app-debug.apk`에 있다. 빌드와 서명 검증은 [실행 검증 기록](runtime-verification.md)에 남겼다. [Flutter Android 환경 설정](https://docs.flutter.dev/platform-integration/android/setup)

새 PC에서 재현할 때는 `flutter doctor -v`로 Android 도구를 확인한다. 현재 빌드는 SDK Platform 36과 NDK `28.2.13676358`을 사용한다. `app`에서 `flutter build apk --debug`를 실행한다.

Android 빌드는 Google Services Gradle 플러그인으로 로컬 JSON을 앱 리소스에 반영하며, Flutter 앱은 그 설정으로 Firebase Core를 초기화한다. 설정 파일이 없는 디버그 빌드에서는 기본 홈·마이페이지를 열 수 있다. Android 프로필·릴리스 빌드에는 Firebase 설정 파일이 필요하다. Google 로그인과 FCM은 후속 개발 작업이며 실제 Android 기기에서 검증한다. 승인 계정과 서버 인증 정보는 3절에서 별도로 준비한다. [Flutter Firebase 연결](https://firebase.google.com/docs/flutter/setup)

## 로컬 설정과 보안 관리

- `google-services.json`, 생성될 `firebase_options.dart`, 실제 `.env`·`server.env`, 서비스 계정 JSON, 개인 키·서명 키, `key.properties`, SQLite와 백업·로그는 Git에서 제외한다. `.env.example`과 `*.env.example`만 가짜 예시 값으로 커밋한다. lock 파일과 소스는 계속 추적한다.
- Firebase 프로젝트 ID와 Android 클라이언트 설정은 서버 개인 키와 성격이 다르며, 클라이언트 설정은 APK에도 포함된다. 이 프로젝트는 사용자 요청에 따라 클라이언트 설정 파일도 로컬로 관리한다. 서버 서비스 계정 키와 API 비밀 키를 Flutter `.env`나 앱 자산에 넣지 않는다. 서버 비밀은 서버에서만 사용한다.
- 실제 서버 환경 파일과 개인 키는 저장소 밖 `%LOCALAPPDATA%\TennisReservation`에 둔다. 파일 이름이 임의라면 제외 규칙만 믿고 저장소에 복사하지 않는다. 파일 내용이나 비밀번호는 채팅·이슈·PR에 올리지 않는다.
- 공개 문서·커밋·이슈·PR의 명령과 예시는 저장소 기준 상대 경로나 환경 변수를 사용한다. 개인 계정명, 실제 홈 경로, 비공개 설정값은 예시에 넣지 않는다.
- 커밋 전 `git status --short`, `git diff --cached --name-only`, `git diff --cached --check`로 범위를 확인하고, 설정 파일은 `git check-ignore -v <경로>`로 제외 여부를 확인한다. 강제 추가(`git add -f`)는 사용하지 않는다. `.gitignore`는 이미 추적된 파일이나 과거 이력을 제거하지 않는다. 과거에 유효한 비밀이 공개됐다면 삭제만으로 끝내지 말고 키를 폐기·재발급한다.
- Firebase를 실행하기 위한 별도 컨테이너는 필요 없다. 앱과 Node.js 서버는 Google의 Firebase 서비스에 통신한다. SQLite는 Node.js 컨테이너 내부 라이브러리와 영속 볼륨으로 사용하며 별도 DB 서버를 띄우지 않는다.

## 3. Firebase 서버 인증 파일 준비

Firebase는 Google 클라우드 서비스다. EC2의 Node.js 서버는 Google API와 HTTPS로 통신하며 서버 인증 정보가 필요하다. 이 문서에서는 소규모 초기 구성을 위해 서비스 계정 JSON 파일 방식을 사용한다.

이 단계는 실제 서버 인증·푸시를 검증할 때 필요하다. 테스트에 사용할 Google 계정을 정해 `ALLOWED_EMAILS`에 넣고, 푸시 검증 전에 Firebase 프로젝트 설정 → Cloud Messaging에서 FCM HTTP v1 활성화 여부를 확인한다. [FCM 서버 인증](https://firebase.google.com/docs/cloud-messaging/auth-server)

1. Firebase 프로젝트 설정의 Service accounts 또는 연결된 Google Cloud IAM에서 서비스 계정을 준비한다. 서버는 Firebase Auth 토큰 폐기·사용자 상태 확인과 FCM 발송 권한이 필요하다. 권한을 직접 구성할 경우 해당 프로젝트에 필요한 Auth 사용자 조회와 FCM 발송 범위로 한정한다.
2. 해당 서비스 계정의 키 생성이 허용되는 계정이면 JSON 키를 생성해 내려받는다. 조직 정책이 키 생성을 금지하면 정책을 해제하기보다 그 상태를 알려주고 지원되는 인증 방식을 정한다.
3. 파일을 저장소 밖의 `%LOCALAPPDATA%\TennisReservation\firebase-service-account.json`에 보관한다. 이 JSON에는 개인 키가 있으므로 채팅이나 GitHub 이슈·PR에 첨부하지 않는다. 서버 인증 파일과 Android 앱의 `google-services.json`은 서로 다른 파일이다.
4. 같은 디렉터리에 `server.env`를 만들고 실제 값으로 채운다. 아래 경로의 사용자 이름 부분은 실제 로컬 경로로 바꾼다.

```dotenv
APP_MODE=production
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=your-project-id
ALLOWED_EMAILS=tester@example.com
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/your-name/AppData/Local/TennisReservation/firebase-service-account.json
```

이 파일로 서버를 시작할 때는 `server` 디렉터리에서 다음을 사용한다. 로컬 개발 Compose는 별도의 테스트 계정을 사용하는 구성이므로 이 파일을 넣어도 실제 Firebase 모드로 바뀌지 않는다. 운영 Compose에 인증 파일을 연결하는 작업은 M5에서 수행한다.

```powershell
npm.cmd ci
node --env-file="$env:LOCALAPPDATA\TennisReservation\server.env" src/index.ts
```

완료 후 인증 파일과 환경 파일이 지정한 위치에 있다고 알려주면 된다. 실제 키 값은 전달할 필요가 없다. [Firebase Admin SDK 인증](https://firebase.google.com/docs/admin/setup)

## 4. 예약처 데이터 준비

공공 API 키를 발급받았다면 **제공처와 API 명세 링크, 승인 여부, 필수 설정 항목 이름**을 알려준다. 실제 값은 `server.env`에 `BUCHEON_API_KEY`, `GMUC_API_KEY` 등 제공처별 변수로 넣는다. API가 요구하는 베이스 URL과 추가 식별값은 실제 명세를 확인한 뒤 안내한다. 이 변수들은 연동 검증 전이며 현재 서버가 임의의 API에 자동 접속하지 않는다.

키가 없으면 공개 예약 화면의 수집 경로를 검증한다. 공개 시설 목록과 날짜별 달력을 시간대별 빈자리로 간주하지 않는다. 실제로 사용할 수 있는 코트·시간대 응답과 제공처의 조회 조건을 확인한 뒤 수집 기능을 연결한다. 운영기관에 별도 신청이 필요한 경우 신청을 준비하고, 조회 경로를 확보하기 전에는 오픈 일정과 공식 링크를 제공한다. 현재 근거와 남은 확인은 [예약처 조사](provider-verification.md)에 있다.

## 5. 실기기 검증 이후 AWS와 HTTPS 준비

AWS는 실제 배포 시점에 준비한다. 인스턴스를 먼저 생성하면 사용 시간에 따라 요금이 발생할 수 있으므로 계정의 무료 플랜·크레딧 적용과 비용 알림을 먼저 확인한다. [AWS 비용 예산 설정](https://docs.aws.amazon.com/us_en/awsaccountbilling/latest/aboutv2/budgets-create.html)

| 준비 항목 | 초기 구성과 확인 방법 |
| --- | --- |
| 계정·권한 | 본인이 관리하는 AWS 계정과 인스턴스를 운영할 IAM 권한. 로그인 비밀번호나 AWS 비밀 키는 채팅에 보내지 않는다. |
| 리전·인스턴스 | 서울 리전에서 Linux x86_64 인스턴스 한 대를 준비한다. 초기 Node·SQLite 파일럿은 t3.micro급에서 메모리를 측정하며, 브라우저 기반 수집이 필요하면 측정 결과에 따라 크기를 정한다. 무료 적용 여부는 계정에서 확인한다. |
| 영속 디스크 | 서버와 같은 인스턴스의 EBS에 `/var/lib/tennis-reservation`을 마련한다. 기본 Ubuntu 구성이라면 먼저 16GiB 정도의 디스크와 여유 공간을 확인한다. SQLite를 위한 별도 RDS·DB 계정은 필요 없다. |
| 접속 | SSH를 쓰면 로컬에 키 파일을 보관하고 22번 포트는 접속할 본인 IP에 한정한다. 이미 Systems Manager 접속을 구성했다면 그 방법을 알려준다. |
| 외부 포트 | HTTPS용 443과 인증서 발급·갱신용 80을 준비한다. Node 내부 3000과 SQLite 파일은 외부에 직접 공개하지 않는다. 서버에서 Google API와 예약처로의 외부 HTTPS 접속이 가능해야 한다. |
| DNS | 소유한 도메인의 하위 이름 하나를 API용으로 정한다. 유지할 공인 접속 주소에 DNS A 레코드를 연결하고 도메인 이름·서버 접속 방법을 알려준다. TLS 인증서 연결은 개발 배포 작업에서 수행한다. |
| 백업 | 인스턴스 밖의 비공개 S3 버킷 또는 다른 저장소를 준비한다. S3를 사용하면 공개 접근을 막고 해당 백업 위치의 쓰기·복원 권한만 인스턴스 역할에 준다. |

EC2를 생성했다면 리전, 인스턴스 ID, 운영체제, 접속 주소·방법, 도메인과 데이터·백업 위치를 알려준다. 인스턴스 내부의 실제 비밀값은 `/etc/tennis-reservation/server.env`와 해당 서비스 계정 파일에 보관한다. Docker 설치, 앱 서비스 설정, 데이터 디렉터리 권한, HTTPS 연결과 백업·복원 명령은 M5의 개발 작업에서 제공한다. [EC2 시작 안내](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html)

## 6. 비공개 파일럿 배포 준비

Firebase App Distribution에서 테스터로 초대할 Google 계정을 정한다. 개발 작업에서 파일럿용 릴리스 서명 키와 APK를 준비하면 그 인증서 SHA-1도 Firebase에 추가한다. 이후 APK가 같은 키로 서명되도록 키와 비밀번호는 별도 보관한다. 실제 배포 APK에서 로그인·푸시·외부 예약 링크가 동작하는지 확인한 뒤 테스터를 확대한다. [Firebase Android 비공개 배포](https://firebase.google.com/docs/app-distribution/android/distribute-console)
