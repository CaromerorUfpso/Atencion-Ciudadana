
from getpass import getpass

from sqlalchemy import text

from auth import hashear_password
from database import SessionLocal


def main():
    print("=== Crear funcionario ===")
    usuario = input("Usuario (sin espacios): ").strip().lower()
    nombre1 = input("Primer nombre: ").strip()
    nombre2 = input("Segundo nombre (Enter si no tiene): ").strip() or None
    apellido_1 = input("Primer apellido: ").strip()
    apellido_2 = input("Segundo apellido (Enter si no tiene): ").strip() or None

    password = getpass("Contraseña (no se ve mientras escribes): ")
    confirmar = getpass("Repite la contraseña: ")

    if not usuario or " " in usuario or not nombre1 or not apellido_1:
        print("Faltan datos o el usuario tiene espacios.")
        return
    if password != confirmar:
        print("Las contraseñas no coinciden.")
        return
    if len(password) < 8:
        print("La contraseña debe tener mínimo 8 caracteres.")
        return
    if len(password.encode()) > 72:
        print("La contraseña es demasiado larga (máximo 72 caracteres).")
        return

    db = SessionLocal()
    try:
        existe = db.execute(
            text("SELECT 1 FROM funcionario WHERE usuario = :u"), {"u": usuario}
        ).scalar()
        if existe:
            print(f"Ya existe un funcionario con el usuario '{usuario}'.")
            return

        nuevo_id = db.execute(
            text(
                """
                INSERT INTO funcionario
                    (usuario, nombre1, nombre2, apellido_1, apellido_2, password_hash)
                VALUES (:usuario, :n1, :n2, :a1, :a2, :hash)
                RETURNING id
                """
            ),
            {
                "usuario": usuario, "n1": nombre1, "n2": nombre2,
                "a1": apellido_1, "a2": apellido_2,
                "hash": hashear_password(password),
            },
        ).scalar()
        db.commit()
        print(f"Funcionario '{usuario}' creado con id {nuevo_id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()