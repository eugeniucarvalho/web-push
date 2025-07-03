const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const webpush = require("web-push");
const path = require("path");
const { addSubscription, getAllSubscriptions, removeSubscriptions, countSubscriptions } = require("./database");

const app = express();
const icon = "/badge.svg"; // Ícone padrão para notificações

// Configurando middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Configurando as chaves VAPID
// Em um ambiente de produção, essas chaves devem ser armazenadas em variáveis de ambiente
// Para gerar chaves VAPID, você pode usar o comando: ( npx web-push generate-vapid-keys )
const vapidKeys = {
  publicKey: "BNTQLF6rCHH8htKDfLB5LP-hYowE3RQkaq9SNlZKtejCtjQWpV2S8_rUHaFeACKbLFa6uM_U_ygp6tj7wBaP-KU",
  privateKey: "y1qPkNqJkTPal5jKEY457t1KcAjn_mN-T2zKB0VUGDw",
};

// Substituir pelo e-mail de contato real
webpush.setVapidDetails("mailto:contato@exemplo.com", vapidKeys.publicKey, vapidKeys.privateKey);

// Rota para servir a chave pública VAPID
app.get("/vapidPublicKey", (req, res) => {
  res.send(vapidKeys.publicKey);
});

// Endpoint para registrar as inscrições
app.post("/subscribe", async (req, res) => {
  const subscription = req.body;

  console.log("Nova inscrição recebida:", subscription);

  try {
    // Armazenar a inscrição no banco de dados
    await addSubscription(subscription);

    // Enviar resposta de confirmação
    res.status(201).json({ message: "Inscrição registrada com sucesso!" });

    // Enviar uma notificação de confirmação
    const payload = JSON.stringify({
      title: "Bem-vindo!",
      body: "Você se inscreveu com sucesso para receber notificações push.",
      icon,
    });

    webpush
      .sendNotification(subscription, payload)
      .catch((error) => console.error("Erro ao enviar notificação:", error));
  } catch (error) {
    console.error("Erro ao salvar inscrição no banco de dados:", error);
    res.status(500).json({ error: "Erro ao registrar inscrição" });
  }
});

// Endpoint para enviar notificações
app.get("/send-notification", async (req, res) => {
  const message = req.query.message || "Nova notificação!";
  const title = req.query.title || "Notificação Push";

  try {
    // Buscar todas as inscrições do banco de dados
    const subscriptions = await getAllSubscriptions();

    if (subscriptions.length === 0) {
      return res.status(404).json({ message: "Nenhuma inscrição encontrada" });
    }

    const payload = JSON.stringify({
      title: title,
      body: message,
      icon,
      timestamp: new Date().getTime(),
    });

    console.log("Payload da notificação:", payload);
    console.log("Enviando para", subscriptions.length, "inscritos");

    // Enviar notificação para todos os inscritos
    const sendPromises = subscriptions.map((subscription) => {
      console.log("Enviando notificação para:", subscription.endpoint);
      return webpush
        .sendNotification(subscription, payload)
        .then(() => {
          console.log("Notificação enviada com sucesso para:", subscription.endpoint);
        })
        .catch((error) => {
          console.error("Erro ao enviar notificação:", error);
          // Se recebermos um erro 410, a inscrição não é mais válida e deve ser removida
          if (error.statusCode === 410) {
            // Array de endpoints inválidos para remover do banco de dados
            return subscription.endpoint; // Retorna o endpoint para ser removido
          }
          return null;
        });
    });

    // Processar os resultados e remover inscrições inválidas
    Promise.all(sendPromises)
      .then(async (results) => {
        // Filtra os endpoints inválidos (410 Gone)
        const invalidEndpoints = results.filter((endpoint) => endpoint !== null);

        // Remove inscrições inválidas do banco de dados
        if (invalidEndpoints.length > 0) {
          try {
            await removeSubscriptions(invalidEndpoints);
            console.log(`${invalidEndpoints.length} inscrições inválidas removidas do banco de dados`);
          } catch (error) {
            console.error("Erro ao remover inscrições inválidas:", error);
          }
        }

        // Contar inscrições atualizadas
        const count = await countSubscriptions();

        res.status(200).json({
          message: "Notificações enviadas com sucesso!",
          subscribers: count,
        });
      })
      .catch((error) => {
        res.status(500).json({ error: "Erro ao enviar notificações" });
      });
  } catch (error) {
    console.error("Erro ao buscar inscrições do banco de dados:", error);
    res.status(500).json({ error: "Erro ao buscar inscrições" });
  }
});

// Endpoint para listar todas as inscrições (útil para administração)
app.get("/subscriptions", async (req, res) => {
  try {
    const count = await countSubscriptions();
    res.status(200).json({ count });
  } catch (error) {
    console.error("Erro ao contar inscrições:", error);
    res.status(500).json({ error: "Erro ao contar inscrições" });
  }
});

// Iniciar o servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} para testar as notificações push`);
});
