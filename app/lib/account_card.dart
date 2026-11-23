import 'package:material_ui/material_ui.dart';

import 'account_session.dart';

class AccountCard extends StatefulWidget {
  const AccountCard({super.key, required this.session});

  final AccountSession? session;

  @override
  State<AccountCard> createState() => _AccountCardState();
}

class _AccountCardState extends State<AccountCard> {
  bool _busy = false;
  String? _error;

  Future<void> _perform(Future<void> Function() action) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    String? message;
    try {
      await action();
    } on AccountActionException catch (error) {
      message = error.message;
    } on Exception {
      message = '계정 처리 중 오류가 발생했습니다. 다시 시도해 주세요.';
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = widget.session;
    if (session == null) {
      return const Card(
        child: ListTile(
          leading: Icon(Icons.person_outline),
          title: Text('계정'),
          subtitle: Text('이 앱에서 Google 로그인을 사용할 수 없습니다.'),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: StreamBuilder<String?>(
          stream: session.account,
          builder: (context, snapshot) {
            final account = snapshot.data;
            final ready = snapshot.connectionState != ConnectionState.waiting;
            final status = snapshot.hasError
                ? '계정 상태를 확인하지 못했습니다.'
                : ready
                ? account ?? '로그인하지 않았습니다.'
                : '계정 확인 중';
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('계정', style: Theme.of(context).textTheme.titleMedium),
                Text(status),
                if (_error case final message?) Text(message),
                if (_busy) const LinearProgressIndicator(),
                if (ready && !snapshot.hasError)
                  OutlinedButton(
                    onPressed: _busy
                        ? null
                        : () => _perform(
                            account == null ? session.signIn : session.signOut,
                          ),
                    child: Text(account == null ? 'Google로 로그인' : '로그아웃'),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
