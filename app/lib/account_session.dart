import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

abstract interface class AccountSession {
  Stream<String?> get account;

  Future<void> signIn();
  Future<void> signOut();
}

class AccountActionException implements Exception {
  const AccountActionException(this.message);

  final String message;
}

class FirebaseAccountSession implements AccountSession {
  FirebaseAccountSession(this._auth);

  final FirebaseAuth _auth;
  final GoogleSignIn _google = GoogleSignIn.instance;
  bool _googleInitialized = false;

  @override
  late final Stream<String?> account = _auth.authStateChanges().map(
    (user) => user == null ? null : (user.email ?? 'Google 계정'),
  );

  Future<void> _initializeGoogle() async {
    if (_googleInitialized) return;
    await _google.initialize();
    _googleInitialized = true;
  }

  @override
  Future<void> signIn() async {
    try {
      await _initializeGoogle();
      final account = await _google.authenticate();
      final token = account.authentication.idToken;
      if (token == null || token.isEmpty) {
        throw const AccountActionException('Google 인증을 완료하지 못했습니다.');
      }
      await _auth.signInWithCredential(
        GoogleAuthProvider.credential(idToken: token),
      );
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled) return;
      if (error.code == GoogleSignInExceptionCode.clientConfigurationError ||
          error.code == GoogleSignInExceptionCode.providerConfigurationError) {
        throw const AccountActionException('Google 로그인 설정을 확인해 주세요.');
      }
      throw const AccountActionException('Google 로그인에 실패했습니다. 다시 시도해 주세요.');
    } on FirebaseAuthException catch (error) {
      if (error.code == 'network-request-failed') {
        throw const AccountActionException('연결 상태를 확인하고 다시 시도해 주세요.');
      }
      if (error.code == 'operation-not-allowed') {
        throw const AccountActionException('Google 로그인 설정을 확인해 주세요.');
      }
      throw const AccountActionException('Google 로그인에 실패했습니다. 다시 시도해 주세요.');
    }
  }

  @override
  Future<void> signOut() async {
    await _auth.signOut();
    try {
      await _initializeGoogle();
      await _google.signOut();
    } on Exception {
      throw const AccountActionException(
        '앱에서 로그아웃했지만 Google 계정 선택을 초기화하지 못했습니다.',
      );
    }
  }
}
