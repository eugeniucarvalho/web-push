# Acesse https://sequencediagram.org/ para visualizar o diagrama de sequência. Copie o código abaixo e cole no editor do site.

```sequence

title Push Notification System - Fluxos Completos

actor Usuario
participant "Browser" as Browser
participant "Frontend\n(client.js)" as Frontend
participant "Service Worker" as SW
participant "Backend\n(server.js)" as Backend
database "SQLite DB" as DB

entryspacing 0.8
note over Usuario, DB: Fluxo 1: Registro do Service Worker e Inscrição

Usuario->Browser: Acessa a aplicação
Browser->Frontend: Carrega a página
Frontend->Frontend: checkNotificationSupport()
Frontend->SW: navigator.serviceWorker.register()
SW-->Frontend: swRegistration
Frontend->Backend: GET /vapidPublicKey
Backend-->Frontend: VAPID Public Key
Frontend->Frontend: initializeSubscription()
Frontend->SW: pushManager.getSubscription()
SW-->Frontend: subscription (null se não inscrito)
Frontend->Frontend: updateSubscriptionUI()

note over Usuario, DB: Fluxo 2: Usuário se inscreve para receber notificações

Usuario->Frontend: Clica "Inscrever-se para Notificações"
Frontend->Browser: Notification.requestPermission()
Browser->Usuario: Solicita permissão para notificações
Usuario->Browser: Concede permissão
Browser-->Frontend: Permissão "granted"
Frontend->Frontend: urlBase64ToUint8Array(vapidPublicKey)
Frontend->SW: pushManager.subscribe()
SW-->Frontend: subscription (objeto de inscrição)
Frontend->Backend: POST /subscribe (JSON com subscription)
Backend->DB: addSubscription(subscription)
DB-->Backend: Confirma armazenamento
Backend->Backend: Prepara notificação de boas-vindas
Backend->SW: webpush.sendNotification()
SW-->Backend: Confirmação de recebimento
SW->Browser: showNotification("Bem-vindo!")
Browser->Usuario: Exibe notificação de boas-vindas
Backend-->Frontend: Status 201 (Inscrição registrada)
Frontend->Frontend: updateSubscriptionUI()

note over Usuario, DB: Fluxo 3: Envio de notificação pela interface

Usuario->Frontend: Preenche formulário de notificação
Usuario->Frontend: Clica "Enviar Notificação"
Frontend->Backend: GET /send-notification?title=X&message=Y
Backend->DB: getAllSubscriptions()
DB-->Backend: Lista de inscrições
Backend->Backend: Prepara payload da notificação
Backend->SW: webpush.sendNotification() para cada inscrição
SW-->Backend: Confirmação ou erro (410 para inválidas)
Backend->DB: removeSubscriptions() para endpoints inválidos
DB-->Backend: Confirma remoção
Backend->DB: countSubscriptions()
DB-->Backend: Número atual de inscrições
Backend-->Frontend: Status 200 (Notificações enviadas)
Frontend->Frontend: Atualiza log de notificações
SW->Browser: showNotification(title, options)
Browser->Usuario: Exibe notificação push

note over Usuario, DB: Fluxo 4: Envio de notificação via API externa

participant "Sistema Externo" as External
External->Backend: GET /send-notification?title=X&message=Y
Backend->DB: getAllSubscriptions()
DB-->Backend: Lista de inscrições
Backend->Backend: Prepara payload da notificação
Backend->SW: webpush.sendNotification() para cada inscrição
SW-->Backend: Confirmação ou erro (410 para inválidas)
Backend->DB: removeSubscriptions() para endpoints inválidos
DB-->Backend: Confirma remoção
Backend->DB: countSubscriptions()
DB-->Backend: Número atual de inscrições
Backend-->External: Status 200 (Notificações enviadas)
SW->Browser: showNotification(title, options)
Browser->Usuario: Exibe notificação push

note over Usuario, DB: Fluxo 5: Interação do usuário com a notificação

Usuario->Browser: Clica na notificação
Browser->SW: notificationclick event
SW->SW: event.notification.close()
SW->Browser: clients.matchAll() & client.focus() ou clients.openWindow()
Browser->Usuario: Abre ou foca a aplicação

note over Usuario, DB: Fluxo 6: Cancelamento de inscrição

Usuario->Frontend: Clica "Cancelar inscrição"
Frontend->SW: getSubscription()
SW-->Frontend: subscription
Frontend->SW: subscription.unsubscribe()
SW-->Frontend: Confirmação de cancelamento
Frontend->Frontend: updateSubscriptionUI()
```
