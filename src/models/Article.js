export class Article {
  constructor(id, title, content, author, category, publishedDate, image) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.author = author;
    this.category = category;
    this.publishedDate = publishedDate;
    this.image = image;
    this.likesCount = 0;
    this.commentsCount = 0;
    this.isSaved = false;
  }
}

export class Category {
  constructor(id, name, icon) {
    this.id = id;
    this.name = name;
    this.icon = icon;
  }
}
