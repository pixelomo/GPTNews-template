import json
import os
import logging
import traceback
from flask import Flask, request, jsonify, send_from_directory, render_template, redirect, url_for
from flask_restful import Resource, Api
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta
from dateutil.parser import parse
from sqlalchemy import Column, String, func, Integer, DateTime, ForeignKey
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import relationship
from flask import render_template
from flask_migrate import Migrate
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Length
from werkzeug.security import generate_password_hash, check_password_hash
logging.basicConfig(level=logging.DEBUG)

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DB_URL', 'sqlite:///articles.db').replace('postgres://', 'postgresql://')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)
api = Api(app)
migrate = Migrate(app, db)
app.secret_key = os.environ.get('SECRET_KEY')

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False, unique=True)
    password = db.Column(db.String(200), nullable=False)

class LoginForm(FlaskForm):
    username = StringField('Username', validators=[DataRequired(), Length(min=2, max=100)])
    password = PasswordField('Password', validators=[DataRequired()])
    submit = SubmitField('Login')

@app.route('/login', methods=['GET', 'POST'])
def login():
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and check_password_hash(user.password, form.password.data):
            login_user(user)
            return redirect(url_for('index'))
        else:
            print('Login Unsuccessful. Please check username and password', 'danger')
    return render_template('login.html', title='Login', form=form)

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

def load_dummy_data():
    with open('dummy_data.json', 'r') as file:
        raw_data = json.load(file)
    data = []
    for article in raw_data["values"]:
        formatted_article = {
            "id": article[0],
            "title": article[1],
            "pubDate": datetime.strptime(article[2], '%Y-%m-%d %H:%M:%S'), # Convert string to datetime
            "link": article[3],
            "source": article[4],
            "html": article[5],
            "content_translated": article[6],
            "title_translated": article[7],
            "text_chinese": article[8],
            "title_chinese": article[9],
            "text_indonesian": article[10],
            "title_indonesian": article[11],
            "text_korean": article[12],
            "title_korean": article[13],
            "published": article[14]
        }
        data.append(formatted_article)

    return data

@app.route('/api/get_dummy_data')
def get_dummy_data():
    if os.environ.get('FLASK_DEBUG') == '1':
        return jsonify(load_dummy_data())
    else:
        return jsonify({"error": "Dummy data is only available in development environment"})

@app.route('/')
# @login_required
def index():
    return render_template('index.html')

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route("/news/<lang>")
def news_by_language(lang):
    # Convert lang to lowercase
    lang = lang.lower().capitalize()  # Convert only the first letter to uppercase
    # Ensure you fetch articles specific to the language
    published_articles = PublishedArticle.query.filter_by(language=lang).join(Article).all()

    return render_template("news.html", articles=published_articles, language=lang)

@app.route("/news/<lang>/<int:article_id>")
def article_detail(lang, article_id):
    # Convert lang to proper case, e.g., 'japanese' to 'Japanese'
    lang = lang.lower()

    # Fetch the article based on its id
    article = Article.query.get(article_id)
    if not article:
        return "Article not found", 404

    # Fetch the corresponding PublishedArticle for the publication_date
    published_article = PublishedArticle.query.filter_by(article_id=article_id, language=lang.capitalize()).first()
    if not published_article:
        return "Published article not found", 404

    return render_template("article_detail.html", article=article, published_article=published_article, language=lang)

@app.route('/static/favicon.ico')
def favicon():
    return send_from_directory(os.path.join(app.root_path, 'static'), 'favicon.ico', mimetype='image/vnd.microsoft.icon')

@app.route("/api/publish_article/<int:article_id>", methods=["POST"])  # Kept POST as per your preference, and article_id type specified
def publish_article(article_id):
    try:  # Wrap in try except to handle any unexpected errors
        print(request.json)
        article = Article.query.get(article_id)
        if not article:
            return jsonify(success=False, message="Article does not exist"), 404

        # Update the fields
        activeLanguage = request.json["activeLanguage"]

        if activeLanguage == "Japanese":
            article.title_translated = request.json["title_translated"]
            article.content_translated = request.json["content_translated"]
        else:
            setattr(article, f"title_{activeLanguage.lower()}", request.json[f"title_{activeLanguage.lower()}"])
            setattr(article, f"text_{activeLanguage.lower()}", request.json[f"text_{activeLanguage.lower()}"])

        # Since article is updated, explicitly add it to the session.
        db.session.add(article)

        # Check if article already published in this language
        published_entry = PublishedArticle.query.filter_by(article_id=article_id, language=activeLanguage).first()

        # If not published_entry, then create a new PublishedArticle entry.
        if not published_entry:
            new_published_entry = PublishedArticle(article_id=article_id, language=activeLanguage, publication_date=datetime.utcnow())
            db.session.add(new_published_entry)

        db.session.commit()
        return jsonify(success=True, message="Article updated and published")
    except Exception as e:  # Catch any unexpected errors and rollback the transaction
        db.session.rollback()
        return jsonify(success=False, message=str(e)), 500

@app.route("/api/unpublish_article/<int:article_id>/<string:language>", methods=["POST"])
def unpublish_article(article_id, language):
    try:
        article = Article.query.get(article_id)
        if not article:
            return jsonify(success=False, message="Article does not exist"), 404

        published_entry = PublishedArticle.query.filter_by(article_id=article_id, language=language).first()
        if published_entry:
            db.session.delete(published_entry)
            db.session.commit()
            return jsonify(success=True, message=f"Article unpublished in {language}!")
        else:
            return jsonify(success=False, message=f"Article was not published in {language}."), 404
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, message=str(e)), 500

@app.route("/api/save_draft/<int:article_id>", methods=["POST"])
def save_draft(article_id):
    try:
        article = Article.query.get(article_id)
        if not article:
            return jsonify(success=False, message="Article does not exist"), 404

        # Update the fields
        activeLanguage = request.json["activeLanguage"]

        if activeLanguage == "Japanese":
            article.title_translated = request.json["title_translated"]
            article.content_translated = request.json["content_translated"]
        else:
            setattr(article, f"title_{activeLanguage.lower()}", request.json[f"title_{activeLanguage.lower()}"])
            setattr(article, f"text_{activeLanguage.lower()}", request.json[f"text_{activeLanguage.lower()}"])

        # Since article is updated, explicitly add it to the session.
        db.session.add(article)
        db.session.commit()

        return jsonify(success=True, message="Draft saved")
    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, message=str(e)), 500

class Article(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String, nullable=False)
    pubDate = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    link = db.Column(db.String, nullable=False, unique=True)
    text = db.Column(db.Text, nullable=True)
    title_chinese = db.Column(db.Text, nullable=True)
    text_chinese = db.Column(db.Text, nullable=True)
    title_indonesian = db.Column(db.Text, nullable=True)
    text_indonesian = db.Column(db.Text, nullable=True)
    title_korean = db.Column(db.Text, nullable=True)
    text_korean = db.Column(db.Text, nullable=True)
    html = db.Column(db.Text, nullable=True)
    title_translated = db.Column(db.String, nullable=True)
    content_translated = db.Column(db.Text, nullable=True)
    source = db.Column(String)
    published = db.Column(db.Boolean, default=False, nullable=False)
    published_articles = relationship("PublishedArticle", back_populates="article", cascade="all, delete-orphan")
    edited_japanese = db.Column(db.Text, nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "pubDate": self.pubDate.isoformat(),
            "link": self.link,
            "text": self.text,
            "html": self.html,
            "source": self.source,
            "title_translated": self.title_translated,
            "content_translated": self.content_translated,
            "title_chinese": self.title_chinese,
            "text_chinese": self.text_chinese,
            "title_indonesian": self.title_indonesian,
            "text_indonesian": self.text_indonesian,
            "title_korean": self.title_korean,
            "text_korean": self.text_korean,
            "published": self.published,
            "published_articles": [pa.to_dict() for pa in self.published_articles],
            "edited_japanese": self.edited_japanese,
        }

class PublishedArticle(db.Model):
    __tablename__ = 'published_articles'

    id = db.Column(Integer, primary_key=True)
    article_id = db.Column(Integer, ForeignKey('article.id'), nullable=False)
    language = db.Column(String(50), nullable=False)
    publication_date = db.Column(DateTime, default=datetime.utcnow)
    # Relationship to the main Article model
    article = relationship("Article", back_populates="published_articles")

    def to_dict(self):
        return {
            "id": self.id,
            "article_id": self.article_id,
            "language": self.language,
            "publication_date": self.publication_date.isoformat() if self.publication_date else None,
        }

class SaveArticleResource(Resource):
    def post(self):
        data = request.get_json()
        pubDate = parse(data["pubDate"])

        article = Article(
            title=data["title"],
            pubDate=pubDate,
            link=data["link"],
            text=data["text"],
            html=data["html"],
            source=data["source"],
            title_translated=data["title_translated"],
            content_translated=data["content_translated"],
            title_chinese=data["title_chinese"],
            text_chinese=data["text_chinese"],
            title_indonesian=data["title_indonesian"],
            text_indonesian=data["text_indonesian"],
            title_korean=data["title_korean"],
            text_korean=data["text_korean"],
            published=data["published"],
        )
        print(f"Article to be saved: {article.__dict__}")
        try:
            db.session.add(article)
            db.session.commit()
            return {"message": "Article saved successfully."}
        except IntegrityError:
            db.session.rollback()
            return {"message": "Article with the same link already exists."}, 409

class GetAllArticlesResource(Resource):
    def get(self):
        try:
            articles = Article.query.all()
            return jsonify([article.to_dict() for article in articles])
        except Exception as e:
            return {"error": str(e)}, 500

@app.errorhandler(500)
def handle_500_error(e):
    print(traceback.format_exc())  # or log it
    return jsonify(error="Internal Server Error"), 500

class ArticleCountResource(Resource):
    def get(self):
        count = Article.query.count()
        return jsonify({"count": count})

def remove_duplicates():
    with app.app_context():
        articles = ArticleStats.query.all()
        unique_titles = set()
        duplicates = []

        for article in articles:
            if article.title in unique_titles:
                duplicates.append(article)
            else:
                unique_titles.add(article.title)

        for duplicate in duplicates:
            try:
                db.session.delete(duplicate)
                db.session.commit()
                print(f"Deleted duplicate article: {duplicate.title}")
            except IntegrityError:
                db.session.rollback()
                print("Error deleting duplicate article.")

class Analysis(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    summary = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

@app.route("/analysis")
def analysis():
    latest_analysis = Analysis.query.order_by(Analysis.created_at.desc()).first()
    return render_template("analysis.html", analysis=latest_analysis.summary if latest_analysis else None)

api.add_resource(SaveArticleResource, "/api/save_article")
api.add_resource(GetAllArticlesResource, "/api/get_all_articles")
api.add_resource(ArticleCountResource, "/api/get_article_count")

if __name__ == '__main__':
    if os.environ.get('FLASK_ENV') == 'development':
        dummy_data = load_dummy_data()
    app.run()