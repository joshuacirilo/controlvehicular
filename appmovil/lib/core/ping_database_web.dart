import 'package:sqflite_common/sqlite_api.dart';
import 'package:sqflite_common_ffi_web/sqflite_ffi_web.dart';

/// Needs `web/sqlite3.wasm` and `web/sqflite_sw.js`, generated with
/// `dart run sqflite_common_ffi_web:setup`.
DatabaseFactory get pingDatabaseFactory => databaseFactoryFfiWeb;
