# 사용자 준비 안내

2026-11-23 기준으로 Flutter 3.50.1 설치와 Android 라이선스 수락, Firebase 프로젝트·Android 앱 등록 및 설정 파일 다운로드를 사용자가 완료했다. 실제 점검에서도 Android 도구와 라이선스가 정상이며, Android SDK는 `%LOCALAPPDATA%\Android\sdk`에 있다. 아직 연결된 Android 기기는 없고, 앱 경로의 `google-services.json`도 없다. EC2·HTTPS는 이후 준비한다. 개발 중인 기능과 검증 결과는 [마일스톤](../milestones.md)에 기록한다.

## 현재 상태에서 바로 진행할 순서

1. **새 Android 프로젝트나 템플릿을 만들지 않는다.** 저장소의 `app`은 기존 Flutter 프로젝트이며 `app/android`도 이미 있다. Android Studio에서는 `app`을 Open한다. Android 네이티브 설정만 볼 때는 `app/android`를 연다.
2. Codex와 터미널을 다시 열어 새 PATH가 반영됐는지 확인한다. 이 점검 세션에서는 `flutter`가 PATH에 없어 SDK의 절대 경로로 실행했다. 새 터미널에서도 동일하면 PATH 항목이 SDK 루트가 아닌 `C:\Users\rksid\develop\flutter\bin`인지 확인한다. 시스템 PATH를 중복 수정할 필요는 없다.
3. Android 기기를 USB로 연결하고 USB 디버깅 승인을 한 뒤 아래 명령으로 기기 ID를 확인한다. 데이터 전송이 가능한 케이블을 사용한다.

```powershell
Set-Location app # 저장소 루트에서 실행
& 'C:\Users\rksid\develop\flutter\bin\flutter.bat' devices
& 'C:\Users\rksid\develop\flutter\bin\flutter.bat' run -d <Android-기기-ID>
```

4. 기존 앱의 디버그 빌드 후 `app/android`에서 `./gradlew.bat signingReport`로 debug SHA-1을 확인한다. Java를 찾지 못하면 Android Studio의 JDK 경로를 현재 PowerShell 세션에만 지정한 뒤 실행한다.

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
./gradlew.bat signingReport
```

현재 저장소의 한글 경로에서는 Android Gradle 플러그인의 경로 사전 검사가 빌드를 중단했다. 이를 지원하는 프로젝트 옵션 `android.overridePathCheck=true`를 `app/android/gradle.properties`에 적용했고, **디버그 APK 빌드와 `signingReport`가 통과했다.** Android SDK Platform 36도 빌드 중 설치됐다. 경로 허용 옵션 자체는 모든 네이티브 도구의 호환을 보장하지 않으므로 향후 경로 문제가 발생하면 OneDrive 밖의 영문 경로에 별도 체크아웃해 빌드한다. APK는 `app/build/app/outputs/flutter-apk/app-debug.apk`에 있다. 이 APK는 홈·마이페이지 보일러플레이트이며 아직 Firebase 로그인을 제공하지 않는다.

5. Firebase 콘솔의 프로젝트 설정 → 내 앱 → 등록한 Android 앱에 debug SHA-1을 추가한다. Authentication → Sign-in method에서 Google을 활성화하고 지원 이메일을 선택한다. **이 두 설정 후 `google-services.json`을 다시 내려받아** `app/android/app/google-services.json`에 둔다. 콘솔의 네이티브 Android Gradle 예제는 직접 붙이지 않는다. Flutter용 Firebase 패키지·Gradle 연결은 개발 작업에서 적용한다. [Google 로그인 설정](https://firebase.google.com/docs/auth/android/google-signin), [Flutter Firebase 연결](https://firebase.google.com/docs/flutter/setup)
6. 승인할 Google 계정 목록과 서버 서비스 계정 파일을 아래 3절에 따라 준비한다. Firebase 연결 코드는 아직 앱에 없으므로 파일을 복사한 것만으로 로그인·푸시가 동작하지 않는다. 실제 서버 인증·푸시와 기기 검증은 개발 작업에서 이어간다.

## 로컬 설정과 보안 관리

- `google-services.json`, 생성될 `firebase_options.dart`, 실제 `.env`·`server.env`, 서비스 계정 JSON, 개인 키·서명 키, `key.properties`, SQLite와 백업·로그는 Git에서 제외한다. `.env.example`과 `*.env.example`만 가짜 예시 값으로 커밋한다. lock 파일과 소스는 계속 추적한다.
- Firebase 프로젝트 ID와 Android 클라이언트 설정은 서버 개인 키와 성격이 다르며, 클라이언트 설정은 APK에도 포함된다. 이 프로젝트는 사용자 요청에 따라 클라이언트 설정 파일도 로컬로 관리한다. 서버 서비스 계정 키와 API 비밀 키를 Flutter `.env`나 앱 자산에 넣지 않는다. 서버 비밀은 서버에서만 사용한다.
- 실제 서버 환경 파일과 개인 키는 저장소 밖 `%LOCALAPPDATA%\TennisReservation`에 둔다. 파일 이름이 임의라면 제외 규칙만 믿고 저장소에 복사하지 않는다. 파일 내용이나 비밀번호는 채팅·이슈·PR에 올리지 않는다.
- 커밋 전 `git status --short`, `git diff --cached --name-only`, `git diff --cached --check`로 범위를 확인하고, 설정 파일은 `git check-ignore -v <경로>`로 제외 여부를 확인한다. 강제 추가(`git add -f`)는 사용하지 않는다. `.gitignore`는 이미 추적된 파일이나 과거 이력을 제거하지 않는다. 과거에 유효한 비밀이 공개됐다면 삭제만으로 끝내지 말고 키를 폐기·재발급한다.
- Firebase를 실행하기 위한 별도 컨테이너는 필요 없다. 앱과 Node.js 서버는 Google의 Firebase 서비스에 통신한다. SQLite는 Node.js 컨테이너 내부 라이브러리와 영속 볼륨으로 사용하며 별도 DB 서버를 띄우지 않는다.

## 1. 먼저 Android 빌드 환경과 테스트 기기 준비

1. Flutter SDK는 `C:\Users\rksid\develop\flutter`에 설치되어 있다. 사용자 확인 버전은 3.50.1이며 실제 도구 점검에서도 확인했다. 기존 분석·화면 전환 테스트는 Flutter 3.50.0, Dart 3.14.0에서 통과했다.
2. Android Studio를 설치하고 SDK Manager에서 Android SDK Platform 36, SDK Build-Tools, Platform-Tools, Command-line Tools를 설치한다. 현재 Flutter 기본값이 요구하는 NDK는 `28.2.13676358`이며 SDK Tools의 NDK(Side by side)에서 해당 버전을 설치할 수 있다. IDE의 Flutter 플러그인만 설치한 상태에서는 APK 빌드가 되지 않는다.
3. 터미널을 다시 열고 `flutter doctor -v`를 실행한다. `flutter doctor --android-licenses`로 표시되는 조건을 직접 확인·수락한다. SDK가 기본 위치에 없으면 `flutter config --android-sdk <실제 경로>`로 지정한다.
4. Android 기기에서 개발자 옵션과 USB 디버깅을 켜고, USB로 연결한 뒤 기기 화면에서 이 PC의 디버깅을 허용한다. `flutter devices`에 기기가 표시되는지 확인한다. 에뮬레이터로도 기본 UI를 검증할 수 있지만 파일럿 전에는 Google Play 서비스가 있는 실제 Android 기기로 푸시를 확인한다.
5. 프로젝트의 `app`에서 `flutter pub get`, `flutter build apk --debug`를 실행한다. 성공하면 `app/build/app/outputs/flutter-apk/app-debug.apk`가 생성된다. 개발에서는 기기를 연결한 상태에서 `flutter run`으로 실행할 수 있다.

완료 후 알려줄 내용은 Flutter 버전, Android SDK 경로, `flutter doctor`의 Android 항목 성공 여부, 테스트 기기 연결 여부다. [Flutter Android 환경 설정](https://docs.flutter.dev/platform-integration/android/setup)

## 2. Firebase 프로젝트와 앱 등록

1. 본인 Google 계정으로 Firebase 콘솔에서 이 서비스용 프로젝트를 만든다. Project settings에서 **프로젝트 ID**를 확인한다. 표시 이름과 프로젝트 ID는 서로 다를 수 있다.
2. Android 앱을 추가하고 패키지 이름에 `dev.tennisreservation.tennis_reservation`을 입력한다. 이 패키지 이름을 기준으로 향후 APK도 빌드한다.
3. 1단계의 디버그 빌드 후 `app/android`에서 `./gradlew.bat signingReport`를 실행해 실제 debug 인증서의 SHA-1을 확인한다. Firebase의 Android 앱에 SHA-1을 등록한다. 직접 찾기 어렵다면 Android SDK 준비 후 개발 작업에서 지문을 추출할 수 있다.
4. Authentication의 로그인 제공업체에서 **Google**을 활성화하고 프로젝트 지원 이메일을 지정한다. SHA-1과 로그인 설정을 마친 다음 Android 앱 설정 파일 `google-services.json`을 다시 내려받아 프로젝트의 `app/android/app/google-services.json`에 둔다. 이 파일은 Git에서 제외되어 있다.
5. 테스트에 참여할 Google 계정을 정하고 서버의 `ALLOWED_EMAILS`에 등록할 목록을 준비한다. 실제 이메일 목록은 환경 파일에만 보관한다.
6. Project settings의 Cloud Messaging에서 Firebase Cloud Messaging API(HTTP v1)가 활성화되어 있는지 확인한다. 모바일 앱은 Firebase SDK를 통해 등록하고 서버는 Admin SDK로 전달한다. 이 작업에 Firebase 서버를 따로 설치할 필요는 없다.

완료 후 알려줄 내용은 프로젝트 ID, Android 앱 등록과 Google 로그인 활성화 여부, `google-services.json` 배치 여부다. 실제 Google 로그인과 FCM은 M4에서 앱을 연결한 뒤 검증한다. [Firebase Android Google 로그인](https://firebase.google.com/docs/auth/android/google-signin), [FCM 서버 인증](https://firebase.google.com/docs/cloud-messaging/auth-server)

## 3. Firebase 서버 인증 파일 준비

Firebase는 Google 클라우드 서비스다. EC2의 Node.js 서버는 Google API와 HTTPS로 통신하며 서버 인증 정보가 필요하다. 이 문서에서는 소규모 초기 구성을 위해 서비스 계정 JSON 파일 방식을 사용한다.

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

지금 먼저 준비할 것은 **Android SDK·기기와 Firebase 프로젝트**다. EC2·DNS·백업은 실제 로그인과 알림의 실기기 확인 이후 마련하면 된다.
