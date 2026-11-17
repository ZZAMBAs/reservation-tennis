import 'package:flutter_test/flutter_test.dart';
import 'package:tennis_reservation/main.dart';

void main() {
  testWidgets('홈에서 마이페이지로 이동하고 돌아온다', (tester) async {
    await tester.pumpWidget(const TennisReservationApp());
    expect(find.text('다음 예약 오픈'), findsOneWidget);

    await tester.tap(find.text('마이페이지'));
    await tester.pumpAndSettle();
    expect(find.text('알림 설정'), findsOneWidget);

    await tester.tap(find.text('홈'));
    await tester.pumpAndSettle();
    expect(find.text('다음 예약 오픈'), findsOneWidget);
  });
}
