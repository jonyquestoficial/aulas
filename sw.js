/* ================================================================
   SERVICE WORKER — faz o Controle de Aulas funcionar 100% OFFLINE.

   1. Na primeira abertura (com internet), guarda o app no iPhone.
   2. Depois disso, abre instantâneo e não depende da rede —
      você marca presença na academia mesmo sem sinal.

   PARA PUBLICAR UMA ATUALIZAÇÃO:
   troque o número da versão abaixo (aulas-v2 → aulas-v3).
   Sem isso, o iPhone continua abrindo a versão antiga.
   ================================================================ */

const VERSAO_CACHE = 'aulas-v2';

/* O index.html é ESSENCIAL (é o app inteiro num arquivo só).
   Os outros são desejáveis, mas se faltarem o app ainda funciona. */
const ESSENCIAL = './index.html';
const OPCIONAIS = ['./', './icon-180.png'];

/* INSTALAÇÃO
   Guarda arquivo por arquivo. Antes usávamos cache.addAll(), que é
   "tudo ou nada": se UM arquivo falhasse (ex.: o ícone não subiu),
   a instalação inteira era cancelada e o app ficava SEM offline,
   sem avisar ninguém. Agora uma falha secundária não derruba o resto. */
self.addEventListener('install', evento => {
  evento.waitUntil((async () => {
    const cache = await caches.open(VERSAO_CACHE);

    // o essencial precisa entrar; se falhar, a instalação falha mesmo (e o
    // navegador tentará de novo na próxima visita, em vez de fingir que deu certo)
    await cache.add(new Request(ESSENCIAL, { cache: 'reload' }));

    // os demais são "melhor esforço"
    await Promise.all(OPCIONAIS.map(url =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));

    await self.skipWaiting();
  })());
});

/* ATIVAÇÃO: apaga caches de versões antigas deste app */
self.addEventListener('activate', evento => {
  evento.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(
      nomes.filter(n => n !== VERSAO_CACHE && n.startsWith('aulas-')).map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

/* BUSCA: cache-first (instantâneo e funciona em modo avião).
   Se for uma navegação e não houver nada em cache nem rede,
   devolve o index.html guardado — o app abre mesmo offline. */
self.addEventListener('fetch', evento => {
  const req = evento.request;
  if (req.method !== 'GET') return;

  evento.respondWith((async () => {
    const cache = await caches.open(VERSAO_CACHE);

    const guardado = await caches.match(req, { ignoreSearch: true });
    if (guardado) return guardado;

    try {
      const resposta = await fetch(req);
      if (resposta.ok && new URL(req.url).origin === self.location.origin) {
        cache.put(req, resposta.clone());
      }
      return resposta;
    } catch (e) {
      // offline e sem cópia: se o usuário está abrindo o app, entrega o app
      if (req.mode === 'navigate') {
        const app = await cache.match(ESSENCIAL) || await caches.match('./index.html', { ignoreSearch: true });
        if (app) return app;
      }
      throw e;
    }
  })());
});
