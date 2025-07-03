// Elementos da interface
const statusElement = document.getElementById("status");
const subscribeButton = document.getElementById("subscribe");
const sendButton = document.getElementById("sendButton");
const notificationForm = document.getElementById("notificationForm");
const notificationLog = document.getElementById("notificationLog");

// Variáveis globais
let swRegistration = null;
let isSubscribed = false;
let vapidPublicKey = null;

// Função para adicionar mensagens ao log
function addToLog(message, isError = false) {
  const logEntry = document.createElement("div");
  logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  if (isError) {
    logEntry.style.color = "red";
  }
  notificationLog.prepend(logEntry);
}

// Verificar se o navegador suporta notificações push
function checkNotificationSupport() {
  if (!("serviceWorker" in navigator)) {
    updateStatus("Este navegador não suporta Service Workers.", "error");
    return false;
  }

  if (!("PushManager" in window)) {
    updateStatus("Este navegador não suporta Notificações Push.", "error");
    return false;
  }

  if (Notification.permission === "denied") {
    updateStatus("Você bloqueou as notificações para este site.", "error");
    return false;
  }

  return true;
}

// Atualizar o status na interface
function updateStatus(message, type) {
  statusElement.textContent = message;
  statusElement.className = "status-box";

  switch (type) {
    case "success":
      statusElement.classList.add("status-success");
      break;
    case "error":
      statusElement.classList.add("status-error");
      break;
    default:
      statusElement.classList.add("status-waiting");
  }

  addToLog(message, type === "error");
}

// Registrar o Service Worker
async function registerServiceWorker() {
  try {
    swRegistration = await navigator.serviceWorker.register("service-worker.js");
    addToLog("Service Worker registrado com sucesso.");

    // Esperar até que o service worker esteja ativo
    if (swRegistration.installing) {
      addToLog("Service Worker está sendo instalado...");
      const worker = swRegistration.installing;

      worker.addEventListener("statechange", () => {
        if (worker.state === "activated") {
          initializeSubscription();
        }
      });
    } else {
      initializeSubscription();
    }

    return true;
  } catch (error) {
    updateStatus(`Falha ao registrar o Service Worker: ${error}`, "error");
    console.error("Erro ao registrar o Service Worker:", error);
    return false;
  }
}

// Inicializar a verificação de inscrição
async function initializeSubscription() {
  try {
    // Obter a chave pública VAPID do servidor
    const response = await fetch("/vapidPublicKey");
    vapidPublicKey = await response.text();

    // Verificar se o usuário já está inscrito
    const subscription = await swRegistration.pushManager.getSubscription();
    isSubscribed = subscription !== null;

    updateSubscriptionUI();
  } catch (error) {
    updateStatus("Erro ao inicializar a inscrição", "error");
    console.error("Erro ao inicializar a inscrição:", error);
  }
}

// Atualizar a interface com base no status da inscrição
function updateSubscriptionUI() {
  if (isSubscribed) {
    updateStatus("Você está inscrito para receber notificações push!", "success");
    subscribeButton.textContent = "Cancelar inscrição";
    sendButton.disabled = false;
  } else {
    updateStatus("Você não está inscrito para receber notificações push.", "waiting");
    subscribeButton.textContent = "Inscrever-se para Notificações";
    sendButton.disabled = true;
  }

  subscribeButton.disabled = false;
}

// Converter a chave pública Base64 para um Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Inscrever o usuário para notificações push
async function subscribeUser() {
  try {
    // Solicitar permissão explicitamente para notificações
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      throw new Error("Permissão para notificações não concedida.");
    }

    console.log("Permissão concedida para notificações:", permission);

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
    console.log("Chave VAPID processada:", applicationServerKey);

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });

    console.log("Inscrição criada:", subscription);
    addToLog("Inscrição bem-sucedida!");

    // Enviar a inscrição para o servidor
    const response = await fetch("/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscription),
    });

    if (!response.ok) {
      throw new Error("Erro ao enviar inscrição para o servidor");
    }

    isSubscribed = true;
    updateSubscriptionUI();
  } catch (error) {
    updateStatus(`Falha ao se inscrever: ${error}`, "error");
    console.error("Erro ao se inscrever:", error);
  }
}

// Cancelar a inscrição do usuário
async function unsubscribeUser() {
  try {
    const subscription = await swRegistration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      addToLog("Inscrição cancelada com sucesso.");
    }

    isSubscribed = false;
    updateSubscriptionUI();
  } catch (error) {
    updateStatus(`Erro ao cancelar inscrição: ${error}`, "error");
    console.error("Erro ao cancelar inscrição:", error);
  }
}

// Enviar uma notificação de teste
async function sendNotification(title, message) {
  try {
    const response = await fetch(
      `/send-notification?title=${encodeURIComponent(title)}&message=${encodeURIComponent(message)}`
    );

    if (!response.ok) {
      throw new Error("Erro ao enviar a notificação");
    }

    const result = await response.json();
    addToLog(`Notificação enviada para ${result.subscribers} inscritos.`);
  } catch (error) {
    updateStatus(`Erro ao enviar notificação: ${error}`, "error");
    console.error("Erro ao enviar notificação:", error);
  }
}

// Event listeners
window.addEventListener("load", async () => {
  if (checkNotificationSupport()) {
    const success = await registerServiceWorker();
    if (success) {
      subscribeButton.addEventListener("click", () => {
        if (isSubscribed) {
          unsubscribeUser();
        } else {
          subscribeUser();
        }
      });

      notificationForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const title = document.getElementById("title").value;
        const message = document.getElementById("message").value;
        sendNotification(title, message);
      });
    }
  }
});
