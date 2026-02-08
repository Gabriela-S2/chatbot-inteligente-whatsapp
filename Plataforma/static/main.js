document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const conversationListEl = document.getElementById('conversation-list');
    const contactListEl = document.getElementById('contact-list');
    const chatWindowEl = document.getElementById('chat-window');
    const chatHeaderEl = document.getElementById('chat-header');
    const messageFormEl = document.getElementById('message-form');
    const messageInputEl = document.getElementById('message-input');
    const conversationSearchEl = document.getElementById('conversation-search');
    const contactSearchEl = document.getElementById('contact-search');
    const closeConversationBtn = document.getElementById('close-conversation-btn');
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPicker = document.querySelector('emoji-picker');
    const readyMessagesListEl = document.getElementById('ready-messages-list');
    const attachBtn = document.getElementById('attach-btn');
    const mediaInput = document.getElementById('media-input');
    
    // Modais
    const createReadyMessageModalEl = document.getElementById('createReadyMessageModal');
    const startNewConversationModalEl = document.getElementById('startNewConversationModal');
    const mediaCaptionModalEl = document.getElementById('mediaCaptionModal');

    const createReadyMessageModal = createReadyMessageModalEl ? new bootstrap.Modal(createReadyMessageModalEl) : null;
    const startNewConversationModal = startNewConversationModalEl ? new bootstrap.Modal(startNewConversationModalEl) : null;
    const mediaCaptionModal = mediaCaptionModalEl ? new bootstrap.Modal(mediaCaptionModalEl) : null;

    const saveReadyMessageBtn = document.getElementById('saveReadyMessageBtn');
    const readyMessageNameInput = document.getElementById('readyMessageName');
    const readyMessageContentInput = document.getElementById('readyMessageContent');
    const sendNewConversationBtn = document.getElementById('sendNewConversationBtn');
    const newContactNumberInput = document.getElementById('newContactNumber');
    const newInitialMessageInput = document.getElementById('newInitialMessage');
    const sendMediaBtn = document.getElementById('sendMediaBtn');
    const mediaCaptionInput = document.getElementById('mediaCaptionInput');
    const mediaPreviewEl = document.getElementById('media-preview');

    let currentContact = null;
    let allConversations = [];
    let allContacts = [];
    let chatUpdateInterval;
    let selectedFile = null; // Variável para guardar o ficheiro selecionado

    // --- Funções Auxiliares ---
    const showAlert = (message, type = 'danger') => {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'fixed';
        wrapper.style.top = '20px';
        wrapper.style.right = '20px';
        wrapper.style.zIndex = '2000';
        wrapper.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">${message}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        document.body.append(wrapper);
        setTimeout(() => wrapper.remove(), 4000);
    };

    // --- Funções de API e Renderização ---
    const fetchAndRenderConversations = async () => {
        try {
            const response = await fetch('/api/conversations');
            if (!response.ok) throw new Error('Falha ao buscar conversas ativas.');
            allConversations = await response.json();
            filterAndRenderList(allConversations, conversationSearchEl.value, conversationListEl, 'conversa');
        } catch (error) { console.error(error); }
    };

    const fetchAndRenderAllContacts = async () => {
        try {
            const response = await fetch('/api/contacts');
            if (!response.ok) throw new Error('Falha ao buscar contatos.');
            allContacts = await response.json();
            filterAndRenderList(allContacts, contactSearchEl.value, contactListEl, 'contato');
        } catch (error) { console.error(error); }
    };

    const filterAndRenderList = (items, searchTerm, listElement, type) => {
        if (!listElement) return;
        const lowerCaseSearchTerm = searchTerm.toLowerCase();
        const filtered = items.filter(item => 
            (item.contact_number?.toLowerCase().includes(lowerCaseSearchTerm)) || 
            (item.contact_name?.toLowerCase().includes(lowerCaseSearchTerm))
        );
        
        listElement.innerHTML = '';
        if (filtered.length === 0) {
            listElement.innerHTML = `<p class="text-muted p-3">Nenhum ${type} encontrado.</p>`;
            return;
        }

        filtered.forEach(item => {
            const a = document.createElement('a');
            a.href = '#';
            a.className = `list-group-item list-group-item-action conversation-item ${item.contact_number === currentContact ? 'active' : ''}`;
            a.dataset.contact = item.contact_number;
            const displayName = item.contact_name || item.contact_number;
            
            if (type === 'conversa') {
                const time = new Date(item.last_message_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                a.innerHTML = `<div class="d-flex w-100 justify-content-between"><h5 class="mb-1 text-truncate">${displayName}</h5><small>${time}</small></div><p class="mb-1 text-muted text-truncate">${item.last_message_body}</p>`;
            } else {
                a.innerHTML = `<h5 class="mb-1 text-truncate">${displayName}</h5><small class="text-muted">${item.contact_number}</small>`;
            }
            a.addEventListener('click', (e) => handleConversationClick(e, item.contact_number));
            listElement.appendChild(a);
        });
    };

    const handleConversationClick = async (event, contactNumber) => {
        event.preventDefault();
        currentContact = contactNumber;
        if (chatUpdateInterval) clearInterval(chatUpdateInterval);

        document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll(`[data-contact="${contactNumber}"]`).forEach(el => el.closest('.conversation-item').classList.add('active'));

        updateChatHeader(currentContact);
        if (chatWindowEl) chatWindowEl.innerHTML = '<p class="text-center">Carregando...</p>';
        if (messageFormEl) messageFormEl.style.display = 'flex';
        if (closeConversationBtn) closeConversationBtn.style.display = 'block';
        if (emojiPicker) emojiPicker.style.display = 'none';

        await fetchAndRenderChat(currentContact);
        chatUpdateInterval = setInterval(() => fetchAndRenderChat(currentContact), 5000);
    };
    
    const updateChatHeader = (contact) => {
        if (!chatHeaderEl) return;
        const contactInfo = allContacts.find(c => c.contact_number === contact) || allConversations.find(c => c.contact_number === contact);
        const displayName = contactInfo?.contact_name || contact;
        chatHeaderEl.innerHTML = `Conversa com: ${displayName} <span id="edit-contact-name" class="badge bg-secondary ms-2" style="cursor: pointer;" title="Editar nome">✏️</span>`;
        const editBtn = document.getElementById('edit-contact-name');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                const newName = prompt("Digite um novo nome para este contato:", displayName);
                if (newName?.trim()) saveContactName(contact, newName.trim());
            });
        }
    };

    const fetchAndRenderChat = async (contact) => {
        if (!chatWindowEl) return;
        try {
            const response = await fetch(`/conversation/${contact}`);
            if (!response.ok) return;
            const data = await response.json();
            chatWindowEl.innerHTML = '';
            data.messages.forEach(msg => {
                const bubble = document.createElement('div');
                bubble.className = `chat-bubble ${msg.direction}`;
                
                // <<< LÓGICA PARA RENDERIZAR MÍDIA RECEBIDA >>>
                const mediaRegex = /\[(Imagem|Vídeo|Áudio|Arquivo) recebido do cliente\]\((.*?)\)/;
                const match = msg.body.match(mediaRegex);

                if (match) {
                    const mediaType = match[1];
                    const mediaUrl = match[2];
                    let mediaElement = '';

                    if (mediaType === 'Imagem') {
                        mediaElement = `<a href="${mediaUrl}" target="_blank"><img src="${mediaUrl}" class="img-thumbnail mt-2" alt="Imagem recebida"></a>`;
                    } else if (mediaType === 'Vídeo') {
                        mediaElement = `<video controls class="img-thumbnail mt-2" style="max-width: 100%;"><source src="${mediaUrl}"></video>`;
                    } else if (mediaType === 'Áudio') {
                        mediaElement = `<audio controls src="${mediaUrl}" class="w-100 mt-2"></audio>`;
                    } else {
                        mediaElement = `<a href="${mediaUrl}" target="_blank" class="btn btn-outline-secondary mt-2"><i class="bi bi-file-earmark-arrow-down"></i> Baixar Arquivo</a>`;
                    }
                    // Extrai a legenda, se houver
                    const caption = msg.body.split('\nLegenda: ')[1] || '';
                    bubble.innerHTML = `${mediaElement}<p class="mt-1 mb-0">${caption}</p>`;
                } else {
                    bubble.textContent = msg.body;
                }
                
                chatWindowEl.prepend(bubble);
            });
        } catch (error) { console.error("Erro ao buscar chat:", error); }
    };

    const fetchReadyMessages = async () => {
        if (!readyMessagesListEl) return;
        try {
            const response = await fetch('/api/ready_messages');
            const messages = await response.json();
            
            const dynamicItems = readyMessagesListEl.querySelectorAll('li:not(:first-child)');
            dynamicItems.forEach(item => {
                if (!item.querySelector('.dropdown-divider')) item.remove();
            });

            const divider = readyMessagesListEl.querySelector('.dropdown-divider');
            if(divider) {
                messages.sort((a,b) => a.nome.localeCompare(b.nome)).forEach(msg => {
                    const li = document.createElement('li');
                    li.innerHTML = `<a class="dropdown-item" href="#">${msg.nome}</a>`;
                    li.querySelector('a').addEventListener('click', e => {
                        e.preventDefault();
                        if (messageInputEl) {
                            messageInputEl.value += msg.conteudo;
                            messageInputEl.focus();
                        }
                    });
                    readyMessagesListEl.insertBefore(li, divider);
                });
            }
        } catch (error) { console.error('Erro ao carregar mensagens prontas:', error); }
    };

    const saveContactName = async (contact, name) => {
        try {
            await fetch('/api/save_contact_name', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contact_number: contact, contact_name: name })
            });
            showAlert('Nome do contato salvo!', 'success');
            fetchAndRenderAllContacts();
            fetchAndRenderConversations();
        } catch (error) { showAlert('Erro ao salvar nome.'); }
    };

    // --- Event Listeners ---
     if (messageFormEl) {
        messageFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const messageText = messageInputEl.value.trim();
            if (!currentContact || !messageText) return;
            
            const tempId = `temp_${Date.now()}`;
            const tempBubble = document.createElement('div');
            tempBubble.className = 'chat-bubble outbound';
            tempBubble.id = tempId;
            tempBubble.innerHTML = `${messageText} <span class="message-status"><i class="bi bi-clock"></i></span>`;
            if (chatWindowEl) chatWindowEl.prepend(tempBubble);

            messageInputEl.value = '';
            try {
                const response = await fetch('/send-message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ to: currentContact, message: messageText })
                });
                
                const sentBubble = document.getElementById(tempId);
                if (sentBubble) {
                    if (response.ok) {
                        sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-check"></i>';
                    } else {
                        sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-x text-danger"></i>';
                    }
                }
            } catch (error) { 
                const sentBubble = document.getElementById(tempId);
                if (sentBubble) {
                    sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-x text-danger"></i>';
                }
            }
        });
    }

    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            if (mediaInput) mediaInput.click();
        });
    }
    
    if (mediaInput) {
        mediaInput.addEventListener('change', () => {
            if (mediaInput.files.length > 0) {
                selectedFile = mediaInput.files[0];
                if (mediaPreviewEl) {
                    const isImage = selectedFile.type.startsWith('image/');
                    mediaPreviewEl.innerHTML = isImage 
                        ? `<img src="${URL.createObjectURL(selectedFile)}" class="img-fluid rounded" alt="preview">`
                        : `<p class="text-muted"><i class="bi bi-file-earmark-text" style="font-size: 2rem;"></i><br>${selectedFile.name}</p>`;
                }
                if (mediaCaptionModal) mediaCaptionModal.show();
            }
        });
    }
    
    if (mediaInput) {
        mediaInput.addEventListener('change', async () => {
            if (mediaInput.files.length === 0 || !currentContact) return;

            const file = mediaInput.files[0];
            const caption = messageInputEl.value.trim();
            
            const formData = new FormData();
            formData.append('file', file);
            formData.append('to', currentContact);
            formData.append('caption', caption);

            const tempId = `temp_${Date.now()}`;
            const tempBubble = document.createElement('div');
            tempBubble.className = 'chat-bubble outbound';
            tempBubble.id = tempId;
            const isImage = file.type.startsWith('image/');
            const filePreview = isImage ? `<img src="${URL.createObjectURL(file)}" class="img-thumbnail mt-2" alt="preview">` : `<p class="text-muted mt-2"><i class="bi bi-file-earmark"></i> ${file.name}</p>`;
            tempBubble.innerHTML = `${filePreview}<div>${caption} <span class="message-status"><i class="bi bi-clock"></i></span></div>`;
            if (chatWindowEl) chatWindowEl.prepend(tempBubble);
            
            messageInputEl.value = '';

            try {
                const response = await fetch('/api/send_media', {
                    method: 'POST',
                    body: formData
                });

                const sentBubble = document.getElementById(tempId);
                if (sentBubble) {
                    if (response.ok) {
                        sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-check"></i>';
                    } else {
                        const errorData = await response.json();
                        showAlert(errorData.message || 'Erro ao enviar mídia.');
                        sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-x text-danger"></i>';
                    }
                }
            } catch (error) {
                const sentBubble = document.getElementById(tempId);
                if (sentBubble) {
                    sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-x text-danger"></i>';
                }
                showAlert('Erro de rede ao enviar mídia.');
            } finally {
                mediaInput.value = '';
            }
        });
    }

    if (sendMediaBtn) {
        sendMediaBtn.addEventListener('click', async () => {
            if (!selectedFile || !currentContact) return;
            const caption = mediaCaptionInput.value.trim();
            const formData = new FormData();
            formData.append('file', selectedFile);
            formData.append('to', currentContact);
            formData.append('caption', caption);
            if (mediaCaptionModal) mediaCaptionModal.hide();
            
            // Lógica de feedback visual
            const tempId = `temp_${Date.now()}`;
            const tempBubble = document.createElement('div');
            tempBubble.className = 'chat-bubble outbound';
            tempBubble.id = tempId;
            const isImage = selectedFile.type.startsWith('image/');
            const filePreview = isImage ? `<img src="${URL.createObjectURL(selectedFile)}" class="img-thumbnail mt-2" alt="preview">` : `<p class="text-muted mt-2"><i class="bi bi-file-earmark"></i> ${selectedFile.name}</p>`;
            tempBubble.innerHTML = `${filePreview}<div>${caption} <span class="message-status"><i class="bi bi-clock"></i></span></div>`;
            if (chatWindowEl) chatWindowEl.prepend(tempBubble);

            try {
                const response = await fetch('/api/send_media', { method: 'POST', body: formData });
                const sentBubble = document.getElementById(tempId);
                if (sentBubble) {
                    if (response.ok) {
                        sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-check"></i>';
                    } else {
                        const errorData = await response.json();
                        showAlert(errorData.message || 'Erro ao enviar mídia.');
                        sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-x text-danger"></i>';
                    }
                }
            } catch (error) {
                const sentBubble = document.getElementById(tempId);
                if (sentBubble) sentBubble.querySelector('.message-status').innerHTML = '<i class="bi bi-x text-danger"></i>';
                showAlert('Erro de rede ao enviar mídia.');
            } finally {
                if (mediaInput) mediaInput.value = '';
                selectedFile = null;
                if (mediaCaptionInput) mediaCaptionInput.value = '';
            }
        });
    }
    

    if (closeConversationBtn) {
        closeConversationBtn.addEventListener('click', async () => {
            if (!currentContact || !confirm("Tem certeza que deseja encerrar este atendimento? O robô voltará a responder.")) return;
            try {
                const response = await fetch('/api/close_conversation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact_number: currentContact })
                });
                if (!response.ok) throw new Error("Falha ao encerrar");

                if (chatWindowEl) chatWindowEl.innerHTML = '<div class="alert alert-info m-3">Atendimento encerrado.</div>';
                if (chatHeaderEl) chatHeaderEl.textContent = 'Selecione uma conversa';
                if (messageFormEl) messageFormEl.style.display = 'none';
                closeConversationBtn.style.display = 'none';
                if (chatUpdateInterval) clearInterval(chatUpdateInterval);
                currentContact = null;
                fetchAndRenderConversations();
            } catch (error) { showAlert('Erro ao encerrar conversa.'); }
        });
    }

    if (saveReadyMessageBtn) {
        saveReadyMessageBtn.addEventListener('click', async () => {
            const name = readyMessageNameInput.value.trim();
            const content = readyMessageContentInput.value.trim();
            if (!name || !content) return showAlert('Nome e conteúdo são obrigatórios.');
            try {
                const response = await fetch('/api/add_ready_message', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, content })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.message || 'Erro desconhecido.');
                }
                showAlert('Mensagem rápida criada com sucesso!', 'success');
                if (createReadyMessageModal) createReadyMessageModal.hide();
                fetchReadyMessages();
                readyMessageNameInput.value = '';
                readyMessageContentInput.value = '';
            } catch (error) { showAlert(error.message); }
        });
    }

    if (sendNewConversationBtn) {
        sendNewConversationBtn.addEventListener('click', async () => {
            const contact = newContactNumberInput.value.trim();
            const message = newInitialMessageInput.value.trim();
            if (!contact || !message) return showAlert('Número e mensagem são obrigatórios.');
            try {
                const response = await fetch('/start_new_conversation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contact_number: contact, initial_message: message })
                });
                if (!response.ok) throw new Error('Falha ao enviar mensagem inicial.');
                showAlert('Nova conversa iniciada com sucesso!', 'success');
                if (startNewConversationModal) startNewConversationModal.hide();
                fetchAndRenderConversations();
            } catch (error) { showAlert(error.message); }
        });
    }
    
    if (attachBtn) {
        attachBtn.addEventListener('click', () => {
            if (mediaInput) mediaInput.click();
        });
    }
    
    
    if (emojiBtn) {
        emojiBtn.addEventListener('click', () => {
            if (emojiPicker) {
                emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    if (emojiPicker) {
        emojiPicker.addEventListener('emoji-click', event => {
            if (messageInputEl) messageInputEl.value += event.detail.unicode;
        });
    }

    if (conversationSearchEl) conversationSearchEl.addEventListener('keyup', () => filterAndRenderList(allConversations, conversationSearchEl.value, conversationListEl, 'conversa'));
    if (contactSearchEl) contactSearchEl.addEventListener('keyup', () => filterAndRenderList(allContacts, contactSearchEl.value, contactListEl, 'contato'));

    // --- Inicialização ---
    fetchAndRenderConversations();
    fetchAndRenderAllContacts();
    fetchReadyMessages();
    setInterval(fetchAndRenderConversations, 15000);
});
