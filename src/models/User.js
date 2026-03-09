export class User {
  constructor(id, name, email, phone, profileImage, bio) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.phone = phone;
    this.profileImage = profileImage;
    this.bio = bio;
    this.postsCount = 0;
    this.followersCount = 0;
    this.followingCount = 0;
    this.likesCount = 0;
    this.isAdmin = false;
  }
}

export class UserStats {
  constructor(userId, postsCount, followersCount, followingCount, likesCount) {
    this.userId = userId;
    this.postsCount = postsCount;
    this.followersCount = followersCount;
    this.followingCount = followingCount;
    this.likesCount = likesCount;
  }
}
