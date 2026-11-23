import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
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
}
