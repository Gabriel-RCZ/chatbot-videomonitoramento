const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let janela;
let processoBot = null;

// =====================================================
// FUNÇÕES AUXILIARES
// =====================================================

function esperar(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function enviarLog(event, mensagem) {
    try {
        event.reply("log-bot", mensagem);
    } catch (erro) {
        console.log(mensagem);
    }
}

function enviarStatus(event, status) {
    try {
        event.reply("status-bot", status);
    } catch (erro) {
        console.log("Status:", status);
    }
}

// =====================================================
// CRIAR JANELA
// =====================================================

function criarJanela() {
    janela = new BrowserWindow({
        width: 900,
        height: 760,
        minWidth: 750,
        minHeight: 600,

        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    janela.loadFile(
        path.join(__dirname, "index.html")
    );

    janela.removeMenu();
}

// =====================================================
// INICIALIZAÇÃO DO ELECTRON
// =====================================================

app.whenReady().then(() => {

    criarJanela();

    app.on("activate", () => {

        if (BrowserWindow.getAllWindows().length === 0) {
            criarJanela();
        }

    });

});

// =====================================================
// EXECUTAR POWERSHELL
// =====================================================

function executarPowerShell(comando) {

    return new Promise((resolve) => {

        const powershell = spawn(
            "powershell.exe",
            [
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                comando
            ],
            {
                windowsHide: true,
                shell: false
            }
        );

        powershell.on("close", () => {
            resolve();
        });

        powershell.on("error", () => {
            resolve();
        });

    });

}

// =====================================================
// ENCERRAR CHATBOT
// =====================================================

async function encerrarChatbot(event = null) {

    if (!processoBot || !processoBot.pid) {

        processoBot = null;

        return;
    }

    const pid = processoBot.pid;

    if (event) {

        enviarLog(
            event,
            `⏹ Encerrando chatbot (PID ${pid})...`
        );

    }

    try {

        if (process.platform === "win32") {

            await new Promise((resolve) => {

                const killer = spawn(
                    "taskkill",
                    [
                        "/PID",
                        String(pid),
                        "/T",
                        "/F"
                    ],
                    {
                        windowsHide: true,
                        shell: false
                    }
                );

                killer.on("close", () => {
                    resolve();
                });

                killer.on("error", () => {
                    resolve();
                });

            });

        } else {

            try {

                processoBot.kill("SIGKILL");

            } catch (erro) {

                console.log(erro);

            }

        }

    } catch (erro) {

        if (event) {

            enviarLog(
                event,
                "⚠️ Aviso ao encerrar chatbot: " +
                erro.message
            );

        }

    }

    processoBot = null;

    // Dá tempo para Chromium liberar os arquivos
    await esperar(2000);
}

// =====================================================
// INICIAR CHATBOT
// =====================================================

ipcMain.on("iniciar-bot", (event) => {

    // -------------------------------------------------
    // EVITA DUPLICIDADE
    // -------------------------------------------------

    if (processoBot) {

        enviarLog(
            event,
            "⚠️ O chatbot já está em execução."
        );

        return;
    }

    // -------------------------------------------------
    // CAMINHOS
    // -------------------------------------------------

    let pastaProjeto;
    let caminhoBot;

    if (app.isPackaged) {

        // Dentro do EXE
        pastaProjeto = process.resourcesPath;

        caminhoBot = path.join(
            process.resourcesPath,
            "app.asar",
            "chatbot.js"
        );

    } else {

        // Desenvolvimento / VS Code
        pastaProjeto =
            path.join(__dirname, "..");

        caminhoBot =
            path.join(
                pastaProjeto,
                "chatbot.js"
            );

    }

    // -------------------------------------------------
    // CONFERE CHATBOT.JS
    // -------------------------------------------------

    if (!fs.existsSync(caminhoBot)) {

        enviarStatus(event, "erro");

        enviarLog(
            event,
            "❌ Arquivo chatbot.js não encontrado."
        );

        return;
    }

    // -------------------------------------------------
    // STATUS
    // -------------------------------------------------

    enviarStatus(event, "iniciando");

    event.reply("ocultar-qr");

    enviarLog(
        event,
        "⏳ Iniciando chatbot..."
    );

    // -------------------------------------------------
    // INICIA NODE
    // -------------------------------------------------

    if (app.isPackaged) {

        // EXE compilado:
        // usa o runtime Node embutido no Electron

        processoBot = spawn(
            process.execPath,
            [caminhoBot],
            {
                cwd: pastaProjeto,
                shell: false,
                windowsHide: true,
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: "1"
                }
            }
        );

    } else {

        // Desenvolvimento / VS Code

        processoBot = spawn(
            "node",
            [caminhoBot],
            {
                cwd: pastaProjeto,
                shell: false,
                windowsHide: true
            }
        );

    }

    // =================================================
    // SAÍDA DO CHATBOT
    // =================================================

    processoBot.stdout.on("data", (dados) => {

        const texto = dados.toString();

        /*
         * Um pacote do stdout pode conter
         * várias linhas.
         */

        const linhas =
            texto.split(/\r?\n/);

        for (const linhaOriginal of linhas) {

            const linha =
                linhaOriginal.trim();

            if (!linha) {
                continue;
            }

            // =========================================
            // QR CODE
            // =========================================

            if (
                linha.startsWith("QR_CODE_DATA:")
            ) {

                const qr =
                    linha.substring(
                        "QR_CODE_DATA:".length
                    );

                event.reply(
                    "qr-code",
                    qr
                );

                enviarStatus(
                    event,
                    "qr"
                );

                enviarLog(
                    event,
                    "📱 QR Code gerado. Aguardando leitura pelo WhatsApp."
                );

                continue;
            }

            // =========================================
            // LOG NORMAL
            // =========================================

            enviarLog(
                event,
                linha
            );

            const minusculo =
                linha.toLowerCase();

            // =========================================
            // WHATSAPP CONECTADO
            // =========================================

            if (
                linha.includes("WHATSAPP_CONECTADO") ||
                minusculo.includes("whatsapp conectado") ||
                minusculo.includes("tudo certo") ||
                minusculo.includes("client is ready") ||
                minusculo.includes("cliente conectado")
            ) {

                enviarStatus(
                    event,
                    "conectado"
                );

                event.reply(
                    "ocultar-qr"
                );

                enviarLog(
                    event,
                    "✅ WhatsApp autenticado e chatbot pronto para atendimento."
                );

            }

        }

    });

    // =================================================
    // ERROS DO CHATBOT
    // =================================================

    processoBot.stderr.on("data", (dados) => {

        const erro =
            dados.toString().trim();

        if (!erro) {
            return;
        }

        enviarLog(
            event,
            "❌ " + erro
        );

    });

    // =================================================
    // ERRO AO INICIAR PROCESSO
    // =================================================

    processoBot.on("error", (erro) => {

        processoBot = null;

        enviarStatus(
            event,
            "erro"
        );

        enviarLog(
            event,
            "❌ Erro ao iniciar chatbot: " +
            erro.message
        );

    });

    // =================================================
    // CHATBOT ENCERRADO
    // =================================================

    processoBot.on("close", (codigo) => {

        processoBot = null;

        enviarStatus(
            event,
            "parado"
        );

        event.reply(
            "ocultar-qr"
        );

        enviarLog(
            event,
            `⛔ Chatbot encerrado. Código: ${codigo}`
        );

    });

});

// =====================================================
// PARAR CHATBOT
// =====================================================

ipcMain.on(
    "parar-bot",
    async (event) => {

        if (!processoBot) {

            enviarLog(
                event,
                "⚠️ O chatbot já está parado."
            );

            return;
        }

        await encerrarChatbot(event);

        enviarStatus(
            event,
            "parado"
        );

        event.reply(
            "ocultar-qr"
        );

        enviarLog(
            event,
            "✅ Chatbot parado."
        );

    }
);

// =====================================================
// NOVO QR CODE
// LIMPAR AUTENTICAÇÃO + CACHE
// =====================================================

ipcMain.on(
    "limpar-sessao",
    async (event) => {

        try {

            const pastaProjeto =
                path.join(__dirname, "..");

            const pastaAuth =
                path.join(
                    pastaProjeto,
                    ".wwebjs_auth"
                );

            const pastaCache =
                path.join(
                    pastaProjeto,
                    ".wwebjs_cache"
                );

            // =========================================
            // INÍCIO
            // =========================================

            enviarStatus(
                event,
                "iniciando"
            );

            event.reply(
                "ocultar-qr"
            );

            enviarLog(
                event,
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            enviarLog(
                event,
                "🧹 INICIANDO LIMPEZA DA SESSÃO"
            );

            enviarLog(
                event,
                "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            );

            // =========================================
            // 1 - ENCERRA CHATBOT
            // =========================================

            if (
                processoBot &&
                processoBot.pid
            ) {

                await encerrarChatbot(event);

            } else {

                enviarLog(
                    event,
                    "ℹ️ Chatbot já está parado."
                );

            }

            // =========================================
            // 2 - ENCERRA CHROME / CHROMIUM
            // =========================================

            enviarLog(
                event,
                "⏳ Liberando processos do WhatsApp Web..."
            );

            /*
             * Equivalente a:
             *
             * Get-Process chrome, chromium
             * -ErrorAction SilentlyContinue |
             * Stop-Process -Force
             * -ErrorAction SilentlyContinue
             */

            await executarPowerShell(
                "Get-Process chrome, chromium " +
                "-ErrorAction SilentlyContinue | " +
                "Stop-Process -Force " +
                "-ErrorAction SilentlyContinue"
            );

            // Aguarda o Windows liberar arquivos

            await esperar(2500);

            // =========================================
            // 3 - APAGA AUTENTICAÇÃO
            // =========================================

            enviarLog(
                event,
                "🧹 Apagando autenticação do WhatsApp..."
            );

            const comandoAuth =
                `Remove-Item ` +
                `-LiteralPath '${pastaAuth.replace(/'/g, "''")}' ` +
                `-Recurse ` +
                `-Force ` +
                `-ErrorAction SilentlyContinue`;

            await executarPowerShell(
                comandoAuth
            );

            // =========================================
            // 4 - APAGA CACHE
            // =========================================

            enviarLog(
                event,
                "🧹 Apagando cache do WhatsApp Web..."
            );

            const comandoCache =
                `Remove-Item ` +
                `-LiteralPath '${pastaCache.replace(/'/g, "''")}' ` +
                `-Recurse ` +
                `-Force ` +
                `-ErrorAction SilentlyContinue`;

            await executarPowerShell(
                comandoCache
            );

            // =========================================
            // 5 - AGUARDA
            // =========================================

            await esperar(1500);

            // =========================================
            // 6 - CONFERE RESULTADO
            // =========================================

            const authExiste =
                fs.existsSync(pastaAuth);

            const cacheExiste =
                fs.existsSync(pastaCache);

            // =========================================
            // SUCESSO
            // =========================================

            if (
                !authExiste &&
                !cacheExiste
            ) {

                enviarStatus(
                    event,
                    "parado"
                );

                enviarLog(
                    event,
                    "✅ Autenticação removida."
                );

                enviarLog(
                    event,
                    "✅ Cache removido."
                );

                enviarLog(
                    event,
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                );

                enviarLog(
                    event,
                    "📱 LIMPEZA CONCLUÍDA."
                );

                enviarLog(
                    event,
                    "▶ Clique em INICIAR CHATBOT para gerar um novo QR Code."
                );

                enviarLog(
                    event,
                    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
                );

                return;
            }

            // =========================================
            // ALGUM ARQUIVO CONTINUA BLOQUEADO
            // =========================================

            enviarStatus(
                event,
                "erro"
            );

            if (authExiste) {

                enviarLog(
                    event,
                    "⚠️ A pasta .wwebjs_auth ainda está bloqueada."
                );

            }

            if (cacheExiste) {

                enviarLog(
                    event,
                    "⚠️ A pasta .wwebjs_cache ainda está bloqueada."
                );

            }

            enviarLog(
                event,
                "⚠️ Não foi possível concluir totalmente a limpeza."
            );

        } catch (erro) {

            enviarStatus(
                event,
                "erro"
            );

            enviarLog(
                event,
                "❌ Erro durante a limpeza: " +
                erro.message
            );

        }

    }
);

// =====================================================
// FECHAR PROGRAMA
// =====================================================

app.on(
    "window-all-closed",
    async () => {

        if (processoBot) {

            try {

                await encerrarChatbot();

            } catch (erro) {

                console.log(
                    "Erro ao encerrar chatbot:",
                    erro
                );

            }

        }

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);