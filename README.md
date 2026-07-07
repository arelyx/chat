# chat

unserious chat app. live at https://chat.arelyx.xyz

realtime chat over websockets: accounts, chats with admin/member roles,
invite codes, public chat discovery, presence, typing indicators,
image uploads (<1MB), per-chat emotes, lazy-loaded history.

## dev setup

fe
```bash
cd frontend
npm install
npm run dev
```

be
```bash
cd backend
npm install
npm run start
```

db
```bash
cd db
docker compose up -d
```

## production

```bash
cp .env.example .env   # fill in real secrets
docker compose up -d --build
```

serves everything on 127.0.0.1:8002 (frontend, /api, /api/ws, uploads);
put a TLS reverse proxy in front.
