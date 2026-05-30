Render fix aplicado:
- server.js agora procura index.html em /app, /app/V1, process.cwd()/V1 e process.cwd().
- /api/health mostra root e indexExists para diagnosticar.
- Se indexExists=false, no Render configure Settings > Root Directory para a pasta que contém index.html, Dockerfile, package.json e server.js.

Deploy:
1) git add .
2) git commit -m "Fix Render root index"
3) git push
4) Render redeploy automático
5) Teste /api/health e veja indexExists=true
