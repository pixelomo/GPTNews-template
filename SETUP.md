To set up your cloned Flask app with Heroku, PostgreSQL, and Alembic, you'll follow these steps. Once the app is deployed on heroku, and PostgreSQL is set up, focus on the Alembic migration and the security aspects.

**Init Project:**
- New Github repo cloned locally
- Copy over all files in GPTNewsTemplate to repo
- Commit
- New heroku app connected to repo
- Set Github as deployment method on heroku
- Enable Automatic deploys on heroku
- Manually deploy the branch on heroku as it wont auto deploy until next commit and we want to deploy, configure dynos etc
- Configure add-ons PostGres & Scheduler

**Step-by-Step Guide:**

1. **Clone the repository locally:**
   ```sh
   git clone <your-repository-url>
   cd <your-repository-name>
   ```

2. **Set up a virtual environment:**
   ```sh
   # Create a virtual environment
   python3 -m venv venv

   # Activate the virtual environment
   # On Windows:
   venv\Scripts\activate
   # On Linux or macOS:
   source venv/bin/activate
   ```

3. **Install your dependencies:**
   ```sh
   pip install -r requirements.txt
   ```

4. **Initialize Alembic:**
   ```sh
   alembic init migrations
   ```
   After initializing Alembic, you will have an `alembic.ini` file and a `migrations/` directory.

   Delete `alembic.ini` from root and `env.py` from /migrations

   Copy `alembic.ini, env.py` from CTNews /migrations, Paste in to migrations

   DO NOT COPY versions dir

6. **Generate an Alembic migration:**

   Make sure your app is properly configured to connect to your Heroku database locally using the `DB_URL` from Heroku config vars.
   Check heroku config vars, copy DATABASE_URL, create DB_URL with same value
   Add ANTHROPIC_API_KEY & OPENAI_API_KEY if needed

   ```sh
   export PYTHONPATH="${PYTHONPATH}:/Users/alan/Documents/Web/ProjectName"
   cd migrations
   alembic revision --autogenerate -m "Initial migration"
    ```

   if autogenerate doesn't work then manually generate
   `alembic revision -m "Initial migration"`

   update the version file

   ```
    def upgrade():
        op.create_table('article',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=None), nullable=False),
        sa.Column('pubDate', sa.DateTime(), nullable=False),
        sa.Column('link', sa.String(length=None), nullable=False),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('title_chinese', sa.Text(), nullable=True),
        sa.Column('text_chinese', sa.Text(), nullable=True),
        sa.Column('title_indonesian', sa.Text(), nullable=True),
        sa.Column('text_indonesian', sa.Text(), nullable=True),
        sa.Column('title_korean', sa.Text(), nullable=True),
        sa.Column('text_korean', sa.Text(), nullable=True),
        sa.Column('html', sa.Text(), nullable=True),
        sa.Column('title_translated', sa.String(length=None), nullable=True),
        sa.Column('content_translated', sa.Text(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('published', sa.Boolean(), nullable=False),
        sa.Column('edited_japanese', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('link')
        )
        op.create_table('user',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=150), nullable=False),
        sa.Column('password', sa.String(length=200), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username')
        )
        op.create_table('published_articles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('language', sa.String(length=50), nullable=False),
        sa.Column('publication_date', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['article_id'], ['article.id'], ),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_table('analysis',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
        )

    def downgrade():
        op.drop_table('analysis')
        op.drop_table('published_articles')
        op.drop_table('user')
        op.drop_table('article')
    ```

7. **Run the migration:**

   After executing the last command, Alembic will create a new script in the `migrations/versions/` directory.

   To apply migrations to your Heroku database, you can push the changes and have a release command run migrations or run it manually:

   ```sh
   alembic upgrade head
   ```
   on heroku after deploy

   `heroku run "cd migrations && alembic upgrade head" --app appname`

8. **Generate a new secret key:**

   Python provides a simple way to generate a new secret key:

   ```python
   import os
   print(os.urandom(24))
   ```

   Copy the output and set it as the `SECRET_KEY` in your Heroku app’s Config Vars:

   ```sh
   heroku config:set SECRET_KEY='your_new_secret_key'
   ```

9. **Change the password:**

    Ensure venv is activated
    `source venv/bin/activate`

    start shell
    `flask shell`

    Create new password and set hashed password in heroku
    ```
    from werkzeug.security import generate_password_hash
    hashed_password = generate_password_hash('new_password')
    print(hashed_password)
    exit()
    ```
    heroku config:set SECRET_KEY=your_new_secret_key --app herokuappname

10. **Update briefing:**

    Edit briefings.py as necessary for the purpose of the app.

    Change the first line which refers to Cointelegraph

11. **Edit articles spider:**

    Edit `articles/spiders/articles.py` file to scrape the desired website

**Anything Else:**

- **Environment Variables:** Make sure all required environment variables like `OPENAI_API_KEY` are set up on Heroku.

- **Dependencies:** Update `requirements.txt` if you have any new dependencies.

- **Procfile:** Make sure you have a `Procfile` that specifies how Heroku should run your app, which might look something like this:

  ```
  web: gunicorn app:app
  ```

- **Database Backups:** It’s important to ensure regular backups of your Heroku PostgreSQL database as a safety measure.

- **Testing:** Ensure you test locally with Heroku environment variables to see that everything is working as expected before pushing the changes to the Heroku remote.

- **Git:** After making changes to your code, don't forget to commit them and push to Heroku:

  ```sh
  git add .
  git commit -m "Set up Alembic, modify the secret key, and update the password"
  git push heroku master
  ```

Once you've completed these steps, your cloned Flask app should be properly set up with Heroku, PostgreSQL, and Alembic. Remember to safeguard your secret key and never commit it to your repository.
