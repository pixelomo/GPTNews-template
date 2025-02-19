from sqlalchemy import text
from app import app, db

def cleanup():
    print('Running cleanup')
    with app.app_context():
        sql = text('DELETE FROM article WHERE "pubDate" < NOW() - INTERVAL \'4 days\';')
        result = db.engine.execute(sql)
        print(f'{result.rowcount} rows deleted')

if __name__ == '__main__':
    cleanup()
