// Versão do cache
const CACHE_VERSION = "v1";
const CACHE_NAME = `push-notification-app-${CACHE_VERSION}`;

// Arquivos para cache
const urlsToCache = ["/", "/index.html", "/client.js"];

// Instalar o service worker
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Instalando...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Cacheando arquivos");
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log("[Service Worker] Instalação concluída");
        return self.skipWaiting();
      })
  );
});

// Ativar o service worker
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Ativando...");

  // Limpar caches antigos
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[Service Worker] Removendo cache antigo:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Ativado e controlando a página");
        return self.clients.claim();
      })
  );
});

// Interceptar requisições de rede
self.addEventListener("fetch", (event) => {
  // Estratégia simples: tentar a rede primeiro, depois o cache
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

// Lidar com eventos de push notification
self.addEventListener("push", (event) => {
  console.log("[Service Worker] Notificação push recebida", event);

  let data = {};

  if (event.data) {
    try {
      const text = event.data.text();
      console.log("[Service Worker] Dados da notificação (texto):", text);
      try {
        data = JSON.parse(text);
        console.log("[Service Worker] Dados da notificação (objeto):", data);
      } catch (jsonError) {
        console.error("[Service Worker] Erro ao processar JSON da notificação:", jsonError);
        data = {
          title: "Nova notificação",
          body: text,
        };
      }
    } catch (e) {
      console.error("[Service Worker] Erro ao processar dados da notificação:", e);
      data = {
        title: "Nova notificação",
        body: "Detalhes não disponíveis",
      };
    }
  } else {
    console.warn("[Service Worker] Nenhum dado recebido no evento push");
  }

  const title = data.title || "Notificação Push";
  const options = {
    body: data.body || "Você recebeu uma nova notificação.",
    icon: data.icon || "/icon.svg",
    badge: "/badge.svg",
    timestamp: data.timestamp || Date.now(),
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Ver detalhes",
      },
      {
        action: "close",
        title: "Fechar",
      },
    ],
  };

  console.log("[Service Worker] Exibindo notificação:", { title, options });

  // Usar try/catch para capturar erros ao exibir a notificação
  try {
    event.waitUntil(
      self.registration
        .showNotification(title, options)
        .then(() => {
          console.log("[Service Worker] Notificação exibida com sucesso");
        })
        .catch((error) => {
          console.error("[Service Worker] Erro ao exibir notificação:", error);
        })
    );
  } catch (error) {
    console.error("[Service Worker] Erro ao chamar showNotification:", error);
  }
});

// Lidar com cliques na notificação
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Clique na notificação", event.notification.tag);

  event.notification.close();

  if (event.action === "explore") {
    console.log('[Service Worker] Usuário clicou em "Ver detalhes"');
  } else if (event.action === "close") {
    console.log('[Service Worker] Usuário clicou em "Fechar"');
    return;
  } else {
    console.log("[Service Worker] Usuário clicou na notificação");
  }

  // Abrir a janela do aplicativo se o usuário clicar na notificação
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Verificar se já existe uma janela aberta
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus();
        }
      }
      // Se não existir, abrir uma nova
      if (clients.openWindow) {
        return clients.openWindow("/");
      }
    })
  );
});

// Lidar com o fechamento da notificação
self.addEventListener("notificationclose", (event) => {
  console.log("[Service Worker] Notificação fechada", event.notification.tag);
});
