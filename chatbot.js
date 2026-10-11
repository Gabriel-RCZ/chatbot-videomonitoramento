// =====================================
// IMPORTAÇÕES
// =====================================
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const { Client, MessageMedia, LocalAuth } = require("whatsapp-web.js");

// =====================================
// LOCALIZA CHROME OU MICROSOFT EDGE
// =====================================
function localizarNavegador() {

  const candidatos = [

    // GOOGLE CHROME
    process.env.PROGRAMFILES &&
      `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,

    process.env["PROGRAMFILES(X86)"] &&
      `${process.env["PROGRAMFILES(X86)"]}\\Google\\Chrome\\Application\\chrome.exe`,

    process.env.LOCALAPPDATA &&
      `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,

    // MICROSOFT EDGE
    process.env.PROGRAMFILES &&
      `${process.env.PROGRAMFILES}\\Microsoft\\Edge\\Application\\msedge.exe`,

    process.env["PROGRAMFILES(X86)"] &&
      `${process.env["PROGRAMFILES(X86)"]}\\Microsoft\\Edge\\Application\\msedge.exe`,

    process.env.LOCALAPPDATA &&
      `${process.env.LOCALAPPDATA}\\Microsoft\\Edge\\Application\\msedge.exe`

  ].filter(Boolean);


  for (const caminho of candidatos) {

    if (fs.existsSync(caminho)) {

      const nome =
        caminho
          .toLowerCase()
          .includes("msedge.exe")
          ? "Microsoft Edge"
          : "Google Chrome";

      console.log(
        `🌐 Navegador localizado: ${nome}`
      );

      console.log(
        `🌐 Caminho: ${caminho}`
      );

      return caminho;
    }
  }

  return null;
}


// =====================================
// DEFINE O NAVEGADOR
// =====================================

const caminhoNavegador =
  localizarNavegador();


if (!caminhoNavegador) {

  console.error(
    "❌ Google Chrome ou Microsoft Edge não encontrado."
  );

  process.exit(1);
}


// =====================================
// CONFIGURAÇÃO DO CLIENTE
// =====================================
const client = new Client({

  authStrategy: new LocalAuth(),

  puppeteer: {

    headless: true,

    // Usa Chrome ou Edge encontrado no computador
    executablePath: caminhoNavegador,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],

  },

});


// =====================================
// QR CODE
// =====================================
client.on("qr", (qr) => {

  console.log(
    "QR_CODE_DATA:" + qr
  );

});


// =====================================
// WHATSAPP CONECTADO
// =====================================
client.on("ready", () => {

  console.log(
    "✅ Tudo certo! WhatsApp conectado."
  );

});


// =====================================
// DESCONEXÃO
// =====================================
client.on(
  "disconnected",
  (reason) => {

    console.log(
      "⚠️ Desconectado:",
      reason
    );

  }
);


// =====================================
// INICIALIZA
// =====================================
client.initialize();


// =====================================
// FUNÇÃO DE DELAY
// =====================================
const delay =
  (ms) =>
    new Promise(
      (res) =>
        setTimeout(
          res,
          ms
        )
    );


// =====================================
// CONTROLE DOS FLUXOS
// =====================================

// Contatos aguardando nome e CPF
const aguardandoDesbloqueio =
  new Set();

// Contatos aguardando resposta sobre garantia
const aguardandoGarantia =
  new Set();


// =====================================
// FUNIL DE MENSAGENS (SOMENTE PRIVADO)
// =====================================
client.on(
  "message",
  async (msg) => {

    try {

      // Ignora grupos
      if (
        !msg.from ||
        msg.from.endsWith("@g.us")
      ) {

        return;
      }


      const texto =
        msg.body
          ? msg.body
              .trim()
              .toLowerCase()
          : "";


      // Pequeno atraso antes das respostas
      const typing =
        async () => {

          await delay(2000);

        };


      // =====================================
      // MENSAGEM INICIAL / MENU
      // =====================================
      if (
        /^(menu|oi|olá|ola|bom dia|boa tarde|hop|boa noite)$/i
          .test(texto)
      ) {

        // Cancela qualquer fluxo anterior
        aguardandoDesbloqueio
          .delete(msg.from);

        aguardandoGarantia
          .delete(msg.from);


        await typing();


        const hora =
          new Date().getHours();


        let saudacao =
          "Olá";


        if (
          hora >= 5 &&
          hora < 12
        ) {

          saudacao =
            "Bom dia";

        }

        else if (
          hora >= 12 &&
          hora < 18
        ) {

          saudacao =
            "Boa tarde";

        }

        else {

          saudacao =
            "Boa noite";

        }


        await client.sendMessage(

          msg.from,

          `${saudacao}! 👋\n\n` +

          `Bem-vindo ao atendimento da Gerência de Videomonitoramento.\n\n` +

          `Como podemos ajudar? Digite o número correspondente à opção desejada:\n\n` +

          `1️⃣ Cadastro/atualização de IP de câmeras\n` +

          `2️⃣ Criação de usuários no Vigia Mais/Sentry OCR\n` +

          `3️⃣ Desbloqueio Sentry OCR\n` +

          `4️⃣ Extração/retirada de imagens\n` +

          `5️⃣ Informações de adesão ao programa Vigia Mais\n` +

          `6️⃣ Reparo/Manutenção de câmeras\n` +

          `7️⃣ Outros assuntos\n\n` +

          `Digite o número da opção desejada.`

        );


        return;
      }


      // ==================================================
      // FLUXO ATIVO - DESBLOQUEIO SENTRY
      // ==================================================
      // IMPORTANTE:
      // Esta verificação precisa acontecer antes das
      // opções do menu principal.
      // ==================================================

      if (
        aguardandoDesbloqueio
          .has(msg.from)
      ) {

        // Remove tudo que não seja número
        const numeros =
          texto.replace(
            /\D/g,
            ""
          );


        // CPF deve possuir exatamente 11 números
        if (
          numeros.length === 11
        ) {

          // Finaliza o fluxo
          aguardandoDesbloqueio
            .delete(msg.from);


          await typing();


          await client.sendMessage(

            msg.from,

            `✅ Seu login será desbloqueado e te informaremos em breve.`

          );

        }

        else {

          await typing();


          await client.sendMessage(

            msg.from,

            `⚠️ Não consegui identificar o CPF.\n\n` +

            `Por favor, informe seu *nome e CPF com 11 dígitos*.`

          );

        }


        return;
      }


      // ==================================================
      // FLUXO ATIVO - GARANTIA / MANUTENÇÃO
      // ==================================================
      // Também precisa ficar ANTES das opções 1 e 2
      // do menu principal.
      // ==================================================

      if (
        aguardandoGarantia
          .has(msg.from)
      ) {

        // -------------------------------------
        // RESPOSTA 1 - ESTÁ NA GARANTIA
        // -------------------------------------
        if (
          texto === "1"
        ) {

          aguardandoGarantia
            .delete(msg.from);


          await typing();


          await client.sendMessage(

            msg.from,

            `✅ *Câmera dentro do período de garantia*\n\n` +

            `Para solicitar o reparo/manutenção, entre em contato diretamente com o *Suporte Técnico da Intelbras* pelo link abaixo:\n\n` +

            `https://www.intelbras.com/pt-br/contato/suporte-tecnico`

          );


          return;
        }


        // -------------------------------------
        // RESPOSTA 2 - FORA DA GARANTIA
        // -------------------------------------
        if (
          texto === "2"
        ) {

          aguardandoGarantia
            .delete(msg.from);


          await typing();


          await client.sendMessage(

            msg.from,

            `⚠️ *Câmera fora do período de garantia*\n\n` +

            `Neste caso, existem duas alternativas:\n\n` +

            `1️⃣ O cooperado poderá *custear a manutenção/reparo da câmera*.\n\n` +

            `2️⃣ Caso não seja viável realizar o reparo, poderá ser solicitada a *baixa da câmera* e realizado um *pedido de aditivo* para substituição.\n\n` +

            `Para dar continuidade ao procedimento, entre em contato com a Gerência de Videomonitoramento.`

          );


          return;
        }


        // -------------------------------------
        // RESPOSTA INVÁLIDA
        // -------------------------------------

        await typing();


        await client.sendMessage(

          msg.from,

          `⚠️ Não consegui identificar a opção.\n\n` +

          `Por favor, informe:\n\n` +

          `1️⃣ Sim, a câmera está na garantia\n` +

          `2️⃣ Não, a câmera está fora da garantia`

        );


        return;
      }


      // =====================================
      // OPÇÃO 1
      // CADASTRO/ATUALIZAÇÃO DE CÂMERAS
      // =====================================

      if (
        texto === "1"
      ) {

        await typing();


        await client.sendMessage(

          msg.from,

          `📹 *Cadastro/atualização de IP de câmeras*\n\n` +

          `Para subir as câmeras no Vigia Mais, preciso que você preencha a planilha abaixo com os dados das câmeras.\n\n` +

          `Também preciso que você informe o *nome do órgão responsável pelas câmeras* (quem contratou você para realizar a instalação).\n\n` +

          `Após preencher, encaminhe a planilha de volta por este WhatsApp.`

        );


        // Aguarda 1 segundo
        await delay(1000);


        // Carrega a planilha
        const planilha =
          MessageMedia.fromFilePath(
            "./Modelo de importação de câmeras.xlsx"
          );


        // Envia a planilha
        await client.sendMessage(

          msg.from,

          planilha,

          {

            caption:
              "📎 Planilha para cadastro/atualização das câmeras no Vigia Mais"

          }

        );


        return;
      }


      // =====================================
      // OPÇÃO 2
      // CRIAÇÃO DE USUÁRIOS
      // =====================================

      if (
        texto === "2"
      ) {

        await typing();


        await client.sendMessage(

          msg.from,

          `👤 *Criação de usuários no Vigia Mais/Sentry OCR*\n\n` +

          `Segue abaixo o link para cadastramento de usuário dos sistemas Sentry e Vigia Mais:\n\n` +

          `https://vigiamaismt.com.br/pre-cadastro/`

        );


        return;
      }


      // =====================================
      // OPÇÃO 3
      // DESBLOQUEIO SENTRY
      // =====================================

      if (
        texto === "3"
      ) {

        aguardandoDesbloqueio
          .add(msg.from);


        await typing();


        await client.sendMessage(

          msg.from,

          `🔓 *Desbloqueio Sentry*\n\n` +

          `Poderia informar seu *nome e CPF*?`

        );


        return;
      }


      // =====================================
      // OPÇÃO 4
      // EXTRAÇÃO/RETIRADA DE IMAGENS
      // =====================================

      if (
        texto === "4"
      ) {

        await typing();


        await client.sendMessage(

          msg.from,

          `🎥 *Extração/retirada de imagens*\n\n` +

          `Para informações sobre extração/retirada de imagens, entre em contato com:`

        );


        await delay(1000);


        // DDI 55 + DDD 65 + número
        const numeroContato =
          "556581450315";


        const contato =
          await client.getContactById(

            `${numeroContato}@c.us`

          );


        // Envia cartão do contato
        await client.sendMessage(

          msg.from,

          contato

        );


        return;
      }


      // =====================================
      // OPÇÃO 5
      // ADESÃO AO VIGIA MAIS
      // =====================================

      if (
        texto === "5"
      ) {

        await typing();


        await client.sendMessage(

          msg.from,

          `📹 *Adesão ao programa Vigia Mais*\n\n` +

          `Para informações sobre adesão ao programa Vigia Mais, entre em contato com:`

        );


        await delay(1000);


        const numeroContato =
          "556581450334";


        const contato =
          await client.getContactById(

            `${numeroContato}@c.us`

          );


        // Envia cartão do contato
        await client.sendMessage(

          msg.from,

          contato

        );


        return;
      }


      // =====================================
      // OPÇÃO 6
      // REPARO/MANUTENÇÃO DE CÂMERAS
      // =====================================

      if (
        texto === "6"
      ) {

        aguardandoGarantia
          .add(msg.from);


        await typing();


        await client.sendMessage(

          msg.from,

          `🛠️ *Reparo/Manutenção de câmeras*\n\n` +

          `A câmera que necessita de reparo ainda se encontra dentro do *período de garantia*?\n\n` +

          `1️⃣ Sim, está na garantia\n` +

          `2️⃣ Não, está fora da garantia\n\n` +

          `Digite *1* ou *2*.`

        );


        return;
      }


      // =====================================
      // OPÇÃO 7
      // OUTROS ASSUNTOS
      // =====================================

      if (
        texto === "7"
      ) {

        await typing();


        await client.sendMessage(

          msg.from,

          `💬 *Outros assuntos*\n\n` +

          `Aguarde, em breve entraremos em contato.`

        );


        return;
      }


    }

    catch (error) {

      console.error(

        "❌ Erro no processamento da mensagem:",

        error

      );

    }

  }
);