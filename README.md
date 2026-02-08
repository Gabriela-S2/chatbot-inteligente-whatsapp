# 🤖 ChatBot com Plataforma de Atendimento Humano

Este projeto consiste numa solução completa de atendimento via WhatsApp, integrando um **ChatBot inteligente** (baseado em IA do Google) e uma **Plataforma Web** para atendimento humano (transbordo).

Quando o bot não consegue resolver uma solicitação, ou quando solicitado pelo cliente, a conversa é transferida para um atendente humano que utiliza a interface web para responder.

## 📋 Pré-requisitos

Antes de começar, você precisará das seguintes contas e chaves de API:

1. **Conta no Google Cloud / AI Studio:**
* Necessária para obter a **Google API Key** (para o modelo Gemini).
* [Obter chave aqui](https://aistudio.google.com/).


2. **Conta na Twilio:**
* Necessária para integrar com o WhatsApp.
* Você precisará do `ACCOUNT SID`, `AUTH TOKEN` e do número de telefone configurado (Sandbox ou Oficial).
* [Criar conta Twilio](https://www.twilio.com/).


3. **Python 3.8+** instalado.

---

## 🚀 Instalação

1. **Clone o repositório:**
```bash
git clone https://github.com/SEU_USUARIO/chatbot-atendimento.git
cd chatbot-atendimento

```


2. **Crie um ambiente virtual (recomendado):**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

```


3. **Instale as dependências:**
Como o projeto é dividido em dois módulos, instale as dependências de ambos:
```bash
pip install -r Bot/requirements.txt
pip install -r Plataforma/requirements.txt

```



---

## ⚙️ Configuração (.env)

Crie um arquivo chamado `.env` na **raiz** do projeto e preencha com as suas credenciais.

**Exemplo de `.env`:**

```ini
# --- Configurações do Google Gemini (IA) ---
GOOGLE_API_KEY=sua_chave_api_google_aqui

# --- Configurações do Twilio (WhatsApp) ---
TWILIO_ACCOUNT_SID=seu_account_sid
TWILIO_AUTH_TOKEN=seu_auth_token
TWILIO_PHONE_NUMBER=whatsapp:+14155238886

# --- Configurações de Segurança (Flask) ---
FLASK_SECRET_KEY=uma_chave_secreta_e_aleatoria_aqui

# --- Configurações de Email (Para recuperação de senha) ---
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=seu_email@gmail.com
MAIL_PASSWORD=sua_senha_de_app_gmail
MAIL_DEFAULT_SENDER=seu_email@gmail.com

# --- Configurações de Domínio (Importante para Mídia) ---
# Se usar Ngrok, coloque o link HTTPS do Ngrok da plataforma (ex: https://xyz.ngrok.io)
# Se usar Cloud, coloque o domínio real (ex: https://minha-plataforma.com)
NGROK_PLATFORM_URL=http://localhost:5001 

```

---

## 🖥️ Como Executar

O projeto pode ser executado localmente (para desenvolvimento) ou em servidores de produção (nuvem).

### Opção A: Desenvolvimento Local com Ngrok

Ideal para testes no seu próprio computador. O **Ngrok** é necessário para expor o seu servidor local para que o Twilio possa enviar mensagens para ele.

1. **Inicie a Plataforma (Atendimento Humano):**
```bash
cd Plataforma
python app.py
# Rodará na porta 5001

```


2. **Inicie o Bot (Robô):**
Abra outro terminal:
```bash
cd Bot
python app.py
# Rodará na porta 5000

```


3. **Exponha com Ngrok:**
Você precisará de túneis para as portas.
```bash
ngrok http 5000  # Para o Bot (Link A)
ngrok http 5001  # Para a Plataforma (Link B)

```


4. **Configuração Final:**
* No painel da **Twilio**: Cole o "Link A" (do bot) no campo *Webhook* de mensagens recebidas (ex: `https://xxxx.ngrok.io/whatsapp`).
* No arquivo **.env**: Atualize a variável `NGROK_PLATFORM_URL` com o "Link B" (da plataforma).



### Opção B: Produção com Gunicorn (Recomendado)

Para hospedar em serviços como Render, Heroku, Railway ou AWS. O projeto já está configurado para usar o **Gunicorn** como servidor de aplicação, o que é mais robusto e seguro.

1. Certifique-se de que o ficheiro `Procfile` está presente na pasta da aplicação.
2. O comando de inicialização (definido no Procfile ou no painel da hospedagem) deve ser:
**Para a Plataforma:**
```bash
cd Plataforma && gunicorn app:app

```


**Para o Bot:**
```bash
cd Bot && gunicorn app:app

```



---

## 📂 Estrutura do Projeto

* `/Bot`: Contém o código da inteligência artificial e o webhook principal do WhatsApp.
* `db.py`: Módulo compartilhado de banco de dados.


* `/Plataforma`: Contém a interface web (Dashboard) para os atendentes.
* `static/` & `templates/`: Arquivos Frontend.



## 🤝 Contribuição

1. Faça um Fork do projeto.
2. Crie uma Branch para sua Feature (`git checkout -b feature/IncrivelFeature`).
3. Faça o Commit (`git commit -m 'Add some IncrivelFeature'`).
4. Faça o Push (`git push origin feature/IncrivelFeature`).
5. Abra um Pull Request.
