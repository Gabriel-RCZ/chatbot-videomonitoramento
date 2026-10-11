const { ipcRenderer } = require("electron");
const QRCode = require("qrcode");

const btnIniciar =
    document.getElementById("btnIniciar");

const btnParar =
    document.getElementById("btnParar");

const btnLimpar =
    document.getElementById("btnLimpar");

const statusBot =
    document.getElementById("statusBot");

const log =
    document.getElementById("log");

const areaQr =
    document.getElementById("areaQr");

const imagemQr =
    document.getElementById("imagemQr");

// =====================================
// BOTÕES
// =====================================

btnIniciar.addEventListener("click", () => {
    ipcRenderer.send("iniciar-bot");
});

btnParar.addEventListener("click", () => {
    ipcRenderer.send("parar-bot");
});

btnLimpar.addEventListener("click", () => {
    const confirmar = confirm(
        "ATENÇÃO!\n\n" +
        "A sessão atual do WhatsApp será apagada.\n\n" +
        "Será necessário escanear um novo QR Code.\n\n" +
        "Deseja continuar?"
    );

    if (confirmar) {
        ipcRenderer.send("limpar-sessao");
    }
});

// =====================================
// LOG
// =====================================

ipcRenderer.on("log-bot", (event, mensagem) => {
    log.textContent += "\n" + mensagem;
    log.scrollTop = log.scrollHeight;
});

// =====================================
// STATUS
// =====================================

ipcRenderer.on("status-bot", (event, status) => {
    if (status === "iniciando") {
        statusBot.textContent = "🟡 Iniciando...";

    } else if (status === "qr") {
        statusBot.textContent =
            "🟡 Aguardando leitura do QR Code";

    } else if (status === "conectado") {
        statusBot.textContent =
            "🟢 WhatsApp conectado";

    } else if (status === "erro") {
        statusBot.textContent = "🟠 Erro";

    } else {
        statusBot.textContent = "🔴 Parado";
    }
});

// =====================================
// RECEBER QR
// =====================================

ipcRenderer.on("qr-code", async (event, qr) => {
    try {
        const imagem = await QRCode.toDataURL(qr, {
            width: 280,
            margin: 2,
            errorCorrectionLevel: "M"
        });

        imagemQr.src = imagem;
        areaQr.style.display = "block";

    } catch (erro) {
        log.textContent +=
            "\n❌ Erro ao gerar QR gráfico: " +
            erro.message;
    }
});

// =====================================
// OCULTAR QR
// =====================================

ipcRenderer.on("ocultar-qr", () => {
    areaQr.style.display = "none";
    imagemQr.src = "";
});