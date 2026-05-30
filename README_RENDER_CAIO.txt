COMO COLOCAR ONLINE NO RENDER COM SWISS FUNCIONANDO

Este ZIP já está preparado para Render usando Docker.
Assim o site sobe com:
- Node.js
- Python 3
- pyswisseph
- server.js
- rota /api/swiss-ephemeris

PASSOS NO RENDER

1. Crie uma conta em https://render.com
2. Suba este projeto para um repositório GitHub.
3. No Render clique em New + > Web Service.
4. Selecione o repositório.
5. Render deve detectar o arquivo render.yaml/Dockerfile.
6. Confirme o serviço como Docker.
7. Clique em Deploy.

Se o Render pedir manualmente:
- Environment: Docker
- Health Check Path: /api/health

Depois de subir, teste estas URLs:

https://SEU-SITE.onrender.com/api/health
https://SEU-SITE.onrender.com/api/swiss-health

/api/swiss-health precisa mostrar success true e uma versão do Swiss.

IMPORTANTE

No Windows local o projeto usa py -3.11.
No Render/Linux o projeto usa python3.
O Dockerfile já instala pyswisseph dentro do Python usado pelo servidor.

Comando local continua:
npm install
npm start

No Render não precisa rodar pip manualmente. O Dockerfile faz isso.
