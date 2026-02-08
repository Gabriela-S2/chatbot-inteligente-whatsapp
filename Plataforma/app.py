# -*- coding: utf-8 -*-

# --- Importações de Módulos ---
# Módulos padrão do Python
import sys
import os
import datetime
import sqlite3
import smtplib
from functools import wraps
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Módulos de bibliotecas externas (instalados via requirements.txt)
from flask import (Flask, render_template, jsonify, request,
                   redirect, url_for, session, flash, make_response, send_from_directory)
from dotenv import load_dotenv
from twilio.rest import Client
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

# --- Configuração de Caminho e Importações do Projeto ---
# Esta seção garante que a aplicação Flask possa encontrar e importar funções do diretório 'bot'
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..'))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# Tenta importar as funções de banco de dados do módulo 'bot'
# Isso é crucial para que a plataforma e o bot compartilhem o mesmo banco de dados.
try:
    from bot.db import (
        inicializar_db, get_db_connection,
        salvar_nome_contato, get_nome_contato,
        get_mensagens_prontas, add_mensagem_pronta,
        create_password_reset_token, validate_password_reset_token,
        invalidate_password_reset_token, update_user_password,
        set_conversation_status, get_conversation_status,
        salvar_mensagem
    )
except ImportError as e:
    # Se a importação falhar, a aplicação não pode funcionar. O programa é encerrado.
    print(f"ERRO CRÍTICO: Não foi possível importar de 'bot.db'. Erro: {e}")
    sys.exit(1)

# --- Configuração Inicial da Aplicação ---
# Carrega as variáveis de ambiente (chaves de API, senhas) do arquivo .env
load_dotenv(os.path.join(project_root, '.env'))

# Cria a instância principal da aplicação Flask
app = Flask(__name__)
# Define uma chave secreta para a sessão, essencial para segurança
app.secret_key = os.getenv('FLASK_SECRET_KEY')

# Configura a pasta onde os arquivos de mídia (fotos, vídeos) enviados serão armazenados
UPLOAD_FOLDER = os.path.join(current_dir, 'uploads')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True) # Garante que a pasta exista

# --- Carregamento de Credenciais ---
# Carrega as credenciais do Twilio e de e-mail do arquivo .env
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
MAIL_SERVER = os.getenv('MAIL_SERVER')
MAIL_PORT = int(os.getenv('MAIL_PORT', 587))
MAIL_USE_TLS = os.getenv('MAIL_USE_TLS', 'True').lower() == 'true'
MAIL_USERNAME = os.getenv('MAIL_USERNAME')
MAIL_PASSWORD = os.getenv('MAIL_PASSWORD')
MAIL_DEFAULT_SENDER = os.getenv('MAIL_DEFAULT_SENDER')

# Validação para garantir que as credenciais mais importantes foram carregadas
if not all([app.secret_key, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
    raise ValueError("Variáveis de ambiente críticas (Flask/Twilio) não definidas. Verifique seu .env")

# Inicia o cliente da API do Twilio, que será usado para enviar mensagens
client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


# --- Funções Auxiliares ---

def send_email(to_email, subject, body):
    """Função para enviar e-mails (usado na redefinição de senha)."""
    if not all([MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER]):
        print(f"AVISO: Configurações de e-mail incompletas. Não é possível enviar e-mail para {to_email}.")
        return False
    msg = MIMEMultipart('alternative')
    msg['From'] = MAIL_DEFAULT_SENDER
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'html'))
    try:
        with smtplib.SMTP(MAIL_SERVER, MAIL_PORT) as server:
            if MAIL_USE_TLS:
                server.starttls()
            server.login(MAIL_USERNAME, MAIL_PASSWORD)
            server.sendmail(MAIL_DEFAULT_SENDER, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"ERRO ao enviar e-mail para {to_email}: {e}")
        return False

def login_required(f):
    """
    Um 'decorator' do Flask. Ele "envolve" outras funções (rotas)
    e verifica se o usuário está logado antes de permitir o acesso.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Você precisa estar logado para acessar esta página.', 'info')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


# --- Rotas de Autenticação (Login, Cadastro, Logout) ---

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Página de Login."""
    if 'user_id' in session: # Se já estiver logado, redireciona para o dashboard
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        conn = get_db_connection()
        user = conn.execute('SELECT * FROM atendentes WHERE email = ?', (email,)).fetchone()
        conn.close()
        # Verifica se o usuário existe e se a senha está correta
        if user and check_password_hash(user['senha'], password):
            # Salva informações do usuário na sessão
            session['user_id'] = user['id']
            session['user_name'] = user['nome']
            session['user_sector'] = user['setor']
            return redirect(url_for('dashboard'))
        else:
            flash('Email ou senha inválidos.', 'danger')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Página de Cadastro de novos atendentes."""
    if request.method == 'POST':
        # Coleta dados do formulário
        nome = request.form['nome']
        email = request.form['email']
        password = request.form['password']
        setor = request.form['setor']
        setor_bd = 'Atendente do Financeiro' if setor == 'Financeiro' else 'Atendente Geral'
        # Gera um hash seguro da senha antes de salvar no banco
        hashed_password = generate_password_hash(password)
        conn = get_db_connection()
        try:
            conn.execute('INSERT INTO atendentes (nome, email, setor, senha) VALUES (?, ?, ?, ?)',
                         (nome, email, setor_bd, hashed_password))
            conn.commit()
            flash('Cadastro realizado com sucesso! Faça login para continuar.', 'success')
            return redirect(url_for('login'))
        except sqlite3.IntegrityError: # Trata o caso de e-mail já existente
            flash(f'O email {email} já está cadastrado.', 'warning')
        finally:
            conn.close()
    return render_template('register.html')

@app.route('/logout')
def logout():
    """Rota para fazer logout do sistema."""
    session.clear() # Limpa todos os dados da sessão
    flash('Você foi desconectado.', 'info')
    return redirect(url_for('login'))

# --- Rotas de Redefinição de Senha ---

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    """Página para solicitar a redefinição de senha."""
    if request.method == 'POST':
        email = request.form.get('email')
        conn = get_db_connection()
        user = conn.execute('SELECT id, email FROM atendentes WHERE email = ?', (email,)).fetchone()
        conn.close()
        if user:
            # Gera um token seguro e com tempo de expiração
            token = create_password_reset_token(user['id'])
            if token:
                # Cria o link de redefinição e envia por e-mail
                reset_link = url_for('reset_password', token=token, _external=True)
                subject = "Redefinição de Senha - Plataforma de Atendimento"
                body = render_template('email/reset_password_email.html', reset_link=reset_link)
                send_email(user['email'], subject, body)
        # Mostra uma mensagem genérica por segurança
        flash('Se o e-mail estiver cadastrado, um link de redefinição foi enviado.', 'info')
        return redirect(url_for('forgot_password'))
    return render_template('forgot_password.html')


@app.route('/reset_password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    """Página para efetivamente criar a nova senha."""
    user_id = validate_password_reset_token(token) # Valida o token recebido
    if not user_id:
        flash('Link de redefinição inválido ou expirado.', 'danger')
        return redirect(url_for('login'))
    if request.method == 'POST':
        new_password = request.form.get('new_password')
        # ... (Lógica para confirmar e atualizar a senha)
        hashed_password = generate_password_hash(new_password)
        update_user_password(user_id, hashed_password)
        invalidate_password_reset_token(token) # Invalida o token após o uso
        flash('Sua senha foi redefinida com sucesso! Faça login.', 'success')
        return redirect(url_for('login'))
    return render_template('reset_password.html', token=token)


# --- Rotas Principais da Plataforma ---

@app.route('/')
@login_required # Protegida por login
def dashboard():
    """Renderiza o painel principal de atendimento."""
    return render_template('index.html', user_name=session['user_name'])

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    """
    Serve os arquivos de mídia. Essencial para que o WhatsApp (via Twilio)
    possa buscar a imagem/vídeo a partir de uma URL pública.
    """
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)


# --- API Endpoints (para o Frontend) ---
# Estas rotas são chamadas pelo JavaScript (main.js) para buscar e enviar dados dinamicamente.

@app.route('/api/conversations')
@login_required
def api_get_conversations():
    """API para buscar a lista de conversas ativas para o atendente logado."""
    user_sector = session.get('user_sector')
    conn = get_db_connection()
    # Query complexa que busca a última mensagem de cada conversa em atendimento humano
    # destinada ao setor do atendente logado.
    query = """
    SELECT s.contact_number, cs.nome_contato, m.texto_mensagem AS last_message_body,
           m.data_recebimento AS last_message_time, m.remetente AS last_message_sender, s.assigned_sector
    FROM conversation_status s
    LEFT JOIN contatos_salvos cs ON s.contact_number = cs.numero_cliente
    JOIN (SELECT numero_cliente, MAX(id) AS max_id FROM mensagens GROUP BY numero_cliente) AS latest
      ON REPLACE(latest.numero_cliente, 'whatsapp:', '') = s.contact_number
    JOIN mensagens m ON latest.max_id = m.id
    WHERE s.status = 'HUMAN' AND s.assigned_sector = ?
    ORDER BY m.data_recebimento DESC;
    """
    try:
        conversations_raw = conn.execute(query, (user_sector,)).fetchall()
        processed_list = [dict(row) for row in conversations_raw]
        return jsonify(processed_list) # Retorna os dados em formato JSON
    finally:
        conn.close()

@app.route('/conversation/<path:contact_number>')
@login_required
def get_conversation_details(contact_number):
    """API para buscar o histórico de mensagens de uma conversa específica."""
    full_contact_number = f"whatsapp:{contact_number}"
    conn = get_db_connection()
    messages_raw = conn.execute('SELECT remetente, texto_mensagem FROM mensagens WHERE numero_cliente = ? ORDER BY data_recebimento ASC', (full_contact_number,)).fetchall()
    conn.close()
    # Formata o histórico para o frontend
    chat_history = [{'body': msg['texto_mensagem'], 'direction': 'inbound' if (msg['remetente'] or "").lower() == 'user' else 'outbound'} for msg in messages_raw]
    return jsonify({'messages': chat_history})

@app.route('/send-message', methods=['POST'])
@login_required
def send_message():
    """API para enviar uma mensagem de texto para o cliente via Twilio."""
    data = request.json
    contact, message_body = data.get('to'), data.get('message')
    if not contact or not message_body:
        return jsonify({'status': 'erro', 'message': 'Dados inválidos.'}), 400
    
    attendant_name = session.get('user_name', 'Atendente')
    message_with_signature = f"[{attendant_name}]: {message_body}"
    to_number = f"whatsapp:{contact}"
    
    try:
        # Envia a mensagem usando a API do Twilio
        message = client.messages.create(from_=TWILIO_PHONE_NUMBER, body=message_with_signature, to=to_number)
        # Salva a mensagem enviada no banco de dados para manter o histórico
        salvar_mensagem(to_number, 'human', message_body, 'RESPOSTA_HUMANA', session['user_sector'])
        return jsonify({'status': 'sucesso', 'sid': message.sid})
    except Exception as e:
        return jsonify({'status': 'erro', 'message': str(e)}), 500

@app.route('/api/send_media', methods=['POST'])
@login_required
def send_media():
    """API para enviar um arquivo de mídia (imagem, vídeo) para o cliente."""
    if 'file' not in request.files:
        return jsonify({'status': 'erro', 'message': 'Nenhum arquivo enviado'}), 400
    
    file = request.files['file']
    contact_number = request.form.get('to')
    caption = request.form.get('caption', '') # Legenda é opcional

    if file.filename == '' or not contact_number:
        return jsonify({'status': 'erro', 'message': 'Nome de arquivo ou contato inválido'}), 400

    if file:
        filename = secure_filename(file.filename)
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path) # Salva o arquivo no servidor

        # Pega a URL pública (configurada com ngrok no .env) para montar o link da mídia
        base_url = os.getenv('NGROK_PLATFORM_URL')
        if not base_url:
            return jsonify({'status': 'erro', 'message': 'URL público da plataforma não configurado no .env'}), 500
            
        media_url = f"{base_url}/uploads/{filename}"
        to_number = f"whatsapp:{contact_number}"
        
        try:
            # Envia a mensagem com mídia usando a API do Twilio
            message = client.messages.create(
                from_=TWILIO_PHONE_NUMBER,
                body=caption,
                media_url=[media_url],
                to=to_number
            )
            # ... (Lógica para salvar a mensagem de mídia no banco)
            return jsonify({'status': 'sucesso', 'sid': message.sid})
        except Exception as e:
            return jsonify({'status': 'erro', 'message': str(e)}), 500

@app.route('/api/close_conversation', methods=['POST'])
@login_required
def close_conversation():
    """API para encerrar o atendimento humano e devolver a conversa para o robô."""
    contact_number = request.json.get('contact_number')
    if not contact_number: return jsonify({'status': 'erro', 'message': 'Contato não fornecido'}), 400
    try:
        # Altera o status da conversa no banco de dados para 'BOT'
        set_conversation_status(contact_number, 'BOT')
        log_message = f"Atendimento encerrado por {session['user_name']}."
        salvar_mensagem(f"whatsapp:{contact_number}", 'system', log_message, 'ENCERRAMENTO', session['user_sector'])
        return jsonify({'status': 'sucesso'})
    except Exception as e:
        return jsonify({'status': 'erro', 'message': str(e)}), 500

# ... (outras rotas de API para gerenciar contatos, mensagens prontas, etc.)

# --- Inicialização da Aplicação ---
if __name__ == '__main__':
    # Garante que as tabelas do banco de dados existam ao iniciar
    inicializar_db()
    # Inicia o servidor web usando Waitress, que é mais robusto para produção
    from waitress import serve
    serve(app, host='0.0.0.0', port=5001)