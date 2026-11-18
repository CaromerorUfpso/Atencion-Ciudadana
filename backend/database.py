import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Lee el archivo .env para obtener la dirección de la base de datos
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# El "engine" es la conexión con PostgreSQL
engine = create_engine(DATABASE_URL)

# Cada petición a la API usa una "sesión" para hablar con la base de datos
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
