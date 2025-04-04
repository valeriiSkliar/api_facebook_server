export class AppConfig {
  static readonly PORT = process.env.PORT || 3000;
  static readonly NODE_ENV = process.env.NODE_ENV || 'development';
}
