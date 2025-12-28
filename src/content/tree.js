// Element, previous and next button selectors could be stale.

class Article {
  constructor(element, isRoot = false) {
    if (element === null && isRoot) {
      this.element = null;
      this.turnId = null;
      this.turnType = null;
      this.isRoot = true;
      this.prevButton = null;
      this.nextButton = null;
      this.hasPrev = false;
      this.hasNext = false;
    }
    else {
      this.element = element;
      this.turnId = element.getAttribute("data-turn-id");
      this.turnType = element.getAttribute("data-turn"); // "user" or "assistant"
      this.isRoot = isRoot;

      this.prevButton = element.querySelector(
        'button[aria-label="Previous response"]'
      );
  
      this.nextButton = element.querySelector(
        'button[aria-label="Next response"]'
      );
  
      this.hasPrev = !this.prevButton || this.prevButton.disabled;
      this.hasNext = !this.nextButton || this.nextButton.disabled;
    }
  }

  getText() {
    return (this.element.innerText || "").trim();
  }

  getNextArticle() {
    const articles = Array.from(document.querySelectorAll("article"));

    if (this.isRoot || this.turnId === null || this.turnId === undefined) {
        if (articles.length === 0) {
            return null;
        } 
        else {
            return new Article(articles[0], false);
        }
    }

    const index = articles.findIndex(
      (article) => article.getAttribute("data-turn-id") === this.turnId
    );

    if (index === -1 || index === articles.length - 1) {
      return null;
    }

    nextArticle = new Article(articles[index + 1], false);
    return nextArticle;
  }
}

class Node {
    constructor(article) {
        this.article = article;
        this.children = [];
    }

    addChild(node) {
        this.children.push(node);
    }

    isLeaf() {
        nextArticle = this.article.getNextArticle();
        return nextArticle === null;
    }

    hasMoreChildren() {
        nextArticle = this.article.getNextArticle();
        if (nextArticle.hasNext) {
            return true;
        }
        return false;
    }
}

class Tree {
    constructor() {
        let articleRoot = new Article(null, true);
        this.root = new Node(articleRoot);
        this.buildTree(this.root);
    }

    buildTree(node) {
        if (node.isLeaf()) {
            return;
        }

        let currChildArticle = node.article.getNextArticle();
        let currChildNode = new Node(currChildArticle);
        
        while (true) {
            this.buildTree(currChildNode);
            node.addChild(currChildNode);
            if (!node.hasMoreChildren()) {
                break;
            }
            currChildArticle.nextButton.click();
            currChildArticle = node.getNextArticle();
            currChildNode = new Node(currChildArticle);
        }
    }
}