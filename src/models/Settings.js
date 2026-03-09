export class UserSettings {
  constructor(userId) {
    this.userId = userId;
    this.language = 'mn'; // 'en' for English, 'mn' for Mongolian
    this.theme = 'dark'; // 'light' or 'dark'
    this.notificationsEnabled = true;
    this.privacyLevel = 'public'; // 'public', 'friends', 'private'
    this.emailNotifications = false;
    this.pushNotifications = true;
  }
}
