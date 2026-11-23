import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import 'account_card.dart';
import 'account_session.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  AccountSession? accountSession;
  if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
    try {
      await Firebase.initializeApp();
      accountSession = FirebaseAccountSession(FirebaseAuth.instance);
    } on PlatformException catch (error) {
      // FlutterFire reports absent Android resources as a platform error.
      final missingConfig =
          error.code == 'Exception' &&
          (error.message?.startsWith(
                'java.lang.Exception: Failed to load FirebaseOptions from resource.',
              ) ??
              false);
      if (!kDebugMode || !missingConfig) rethrow;
      debugPrint('Android debug build started without Firebase configuration.');
    }
  }
  runApp(TennisReservationApp(accountSession: accountSession));
}

class TennisReservationApp extends StatelessWidget {
  const TennisReservationApp({super.key, this.accountSession});

  final AccountSession? accountSession;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '테니스장 알림',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF183C30)),
      ),
      home: ReservationShell(accountSession: accountSession),
    );
  }
}

class ReservationShell extends StatefulWidget {
  const ReservationShell({super.key, this.accountSession});

  final AccountSession? accountSession;

  @override
  State<ReservationShell> createState() => _ReservationShellState();
}

class _ReservationShellState extends State<ReservationShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_selectedIndex == 0 ? '테니스장 알림' : '마이페이지')),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          const HomePage(),
          MyPage(accountSession: widget.accountSession),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        onDestinationSelected: (index) =>
            setState(() => _selectedIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: '홈',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: '마이페이지',
          ),
        ],
      ),
    );
  }
}

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        Card(
          child: ListTile(
            leading: Icon(Icons.event_outlined),
            title: Text('다음 예약 오픈'),
            subtitle: Text('확인된 일정이 없습니다.'),
          ),
        ),
        Card(
          child: ListTile(
            leading: Icon(Icons.sports_tennis),
            title: Text('예약 가능한 자리'),
            subtitle: Text('표시할 예약 정보가 없습니다.'),
          ),
        ),
      ],
    );
  }
}

class MyPage extends StatelessWidget {
  const MyPage({super.key, this.accountSession});

  final AccountSession? accountSession;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        AccountCard(session: accountSession),
        const Card(
          child: ListTile(
            leading: Icon(Icons.favorite_outline),
            title: Text('관심 시설'),
            subtitle: Text('등록된 시설이 없습니다.'),
          ),
        ),
        const Card(
          child: ListTile(
            leading: Icon(Icons.notifications_outlined),
            title: Text('알림 설정'),
            subtitle: Text('저장된 알림 조건이 없습니다.'),
          ),
        ),
      ],
    );
  }
}
