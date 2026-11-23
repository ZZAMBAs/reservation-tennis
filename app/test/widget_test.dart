import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:tennis_reservation/account_session.dart';
import 'package:tennis_reservation/main.dart' as app;

void main() {
  testWidgets('홈에서 마이페이지로 이동하고 돌아온다', (tester) async {
    await tester.pumpWidget(const app.TennisReservationApp());
    expect(find.text('다음 예약 오픈'), findsOneWidget);

    await tester.tap(find.text('마이페이지'));
    await tester.pumpAndSettle();
    expect(find.text('알림 설정'), findsOneWidget);

    await tester.tap(find.text('홈'));
    await tester.pumpAndSettle();
    expect(find.text('다음 예약 오픈'), findsOneWidget);
  });

  testWidgets('Firebase 설정이 없는 Android 디버그 앱에서 홈을 표시한다', (tester) async {
    const coreApi =
        'dev.flutter.pigeon.firebase_core_platform_interface.FirebaseCoreHostApi';
    const codec = StandardMessageCodec();
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockDecodedMessageHandler(
      const BasicMessageChannel<Object?>('$coreApi.initializeCore', codec),
      (_) async => [<Object?>[]],
    );
    messenger.setMockDecodedMessageHandler(
      const BasicMessageChannel<Object?>('$coreApi.optionsFromResource', codec),
      (_) async => [
        'Exception',
        'java.lang.Exception: Failed to load FirebaseOptions from resource. '
            'Check that you have defined values.xml correctly.',
        null,
      ],
    );

    await app.main();
    await tester.pump();
    expect(find.text('다음 예약 오픈'), findsOneWidget);
  }, variant: TargetPlatformVariant({TargetPlatform.android}));

  testWidgets('마이페이지는 복원한 계정을 표시하고 로그인과 로그아웃을 처리한다', (tester) async {
    final session = _TestAccountSession();
    addTearDown(session.changes.close);
    await tester.pumpWidget(app.TennisReservationApp(accountSession: session));
    await tester.tap(find.text('마이페이지'));
    await tester.pumpAndSettle();
    expect(find.text('계정 확인 중'), findsOneWidget);

    session.changes.add('pilot@example.test');
    await tester.pumpAndSettle();
    expect(find.text('pilot@example.test'), findsOneWidget);
    await tester.tap(find.text('로그아웃'));
    await tester.pumpAndSettle();
    expect(find.text('pilot@example.test'), findsNothing);

    final signIn = find.text('Google로 로그인');
    await tester.tap(signIn);
    await tester.pump();
    await tester.tap(signIn);
    expect(session.signInCalls, 1);
    session.signInResult.completeError(
      const AccountActionException('연결 상태를 확인해 주세요.'),
    );
    await tester.pumpAndSettle();
    expect(find.text('연결 상태를 확인해 주세요.'), findsOneWidget);

    session.signInResult = Completer<String?>();
    await tester.tap(signIn);
    session.signInResult.complete('pilot@example.test');
    await tester.pumpAndSettle();
    expect(find.text('연결 상태를 확인해 주세요.'), findsNothing);
    expect(find.text('pilot@example.test'), findsOneWidget);
  });
}

class _TestAccountSession implements AccountSession {
  final changes = StreamController<String?>.broadcast();
  var signInResult = Completer<String?>();
  int signInCalls = 0;

  @override
  Stream<String?> get account => changes.stream;

  @override
  Future<void> signIn() async {
    signInCalls++;
    final email = await signInResult.future;
    if (email != null) changes.add(email);
  }

  @override
  Future<void> signOut() async => changes.add(null);
}
