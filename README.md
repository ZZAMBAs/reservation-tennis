# 테니스장 예약 알림

[요구사항과 인터뷰 결정](interview-decision.md) · [홈·마이페이지 시안](design/home-and-my-page.png)

작업 순서와 브랜치 운영 기준은 [마일스톤](milestones.md)을 따른다.

Android SDK, Firebase, EC2와 HTTPS를 준비하는 순서는 [사용자 준비 안내](docs/environment-setup.md)에 정리했다.

Flutter 앱은 홈과 마이페이지의 기본 화면을 제공한다. 서버에는 계정 설정·기기 저장, 시설·오픈 일정 관리와 홈 조회가 구현되어 있다. [API 계약](docs/api.md)과 [시설 등록 명령](docs/catalog-commands.md)을 참고한다. 실제 예약처 수집, Android 로그인·푸시와 앱 API 연결은 후속 작업이다.

## 서버 실행

Node.js 24를 설치한 환경에서 의존성을 설치하고 명시적인 개발 모드로 실행한다.

```powershell
cd server
npm.cmd ci
$env:APP_MODE = 'development'
npm.cmd run dev
```

배포 구성을 시험하려면 프로젝트 루트에서 Docker 엔진을 시작한 후 실행한다.

```powershell
docker compose up --build -d
docker compose ps
```

두 방법 모두 `http://127.0.0.1:3000/healthz`에서 SQLite 연결을 확인한다. 직접 실행하면 `server/data/tennis-reservation.sqlite`가 생성된다. `SQLITE_DB_PATH`로 바꿀 수 있다. Compose에서는 `app-data` 볼륨에 파일을 저장한다. Compose 포트를 바꾸려면 `.env.example`을 `.env`로 복사하고 `PORT`를 수정한다. Compose와 직접 실행 중 한 가지를 선택한다.

현재 Compose는 루프백에 바인딩하는 로컬 개발 구성이다. `/v1` API를 호출할 때 `Authorization: Bearer dev:test-user`를 사용한다. 운영에서는 `APP_MODE=production`, `FIREBASE_PROJECT_ID`, `ALLOWED_EMAILS`와 Firebase 서버 인증이 필요하다. 인증 없는 `/healthz`는 DB 준비 상태만 확인한다.

## Android 앱 실행

Flutter 3.50 이상과 Android SDK를 설치하고 Android 에뮬레이터 또는 기기를 연결한 뒤 실행한다.

```powershell
cd app
flutter pub get
flutter run
```

현재 Android 앱 ID는 `dev.tennisreservation.tennis_reservation`이다. Firebase 앱 등록은 이 값을 기준으로 진행할 수 있다.
