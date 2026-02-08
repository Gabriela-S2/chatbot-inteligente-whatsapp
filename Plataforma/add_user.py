import os
import sys
from getpass import getpass

# Adiciona o diretório da plataforma ao path para que possamos importar o 'app'
# Isso permite executar este script a partir da pasta raiz do projeto.
sys.path.append(os.path.join(os.path.dirname(__file__), 'Plataforma'))

# Garante que o diretório do banco de dados exista antes de importar o app
# que tentará se conectar ao banco de dados.
db_directory = os.path.join(os.path.dirname(__file__), 'bot')
os.makedirs(db_directory, exist_ok=True)

try:
    # Importa as instâncias da aplicação e do banco de dados
    from Plataforma.app import app, db, Attendant
except ImportError as e:
    print("Erro: Não foi possível importar a aplicação Flask.")
    print("Certifique-se de que está a executar este script a partir da pasta raiz do seu projeto 'ChatBot v1.1 (Final)'.")
    print(f"Detalhes do erro: {e}")
    sys.exit(1)

def add_attendant():
    """
    Adiciona um novo atendente ao banco de dados da aplicação.
    """
    print("--- Adicionar Novo Atendente ---")
    username = input("Nome de usuário: ")
    email = input("Email: ")
    password = getpass("Senha: ")
    confirm_password = getpass("Confirme a senha: ")

    if password != confirm_password:
        print("\nERRO: As senhas não coincidem.")
        return

    if not all([username, email, password]):
        print("\nERRO: Todos os campos são obrigatórios.")
        return

    # O 'app_context' é necessário para interagir com a base de dados
    with app.app_context():
        # --- INÍCIO DA MODIFICAÇÃO ---
        # Garante que todas as tabelas sejam criadas na base de dados
        db.create_all()
        # --- FIM DA MODIFICAÇÃO ---

        # Verifica se o email ou username já existem
        if Attendant.query.filter((Attendant.username == username) | (Attendant.email == email)).first():
            print(f"\nERRO: O nome de usuário '{username}' ou o email '{email}' já está em uso.")
            return

        # Cria a nova instância do atendente
        new_attendant = Attendant(username=username, email=email)
        new_attendant.set_password(password)

        try:
            db.session.add(new_attendant)
            db.session.commit()
            print(f"\n>>> Atendente '{username}' adicionado com sucesso! <<<")
        except Exception as e:
            db.session.rollback()
            print(f"\nERRO: Falha ao adicionar atendente ao banco de dados.")
            print(f"Detalhes: {e}")

if __name__ == '__main__':
    add_attendant()
