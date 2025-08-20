# Configuración del CronJob en cPanel

## Comando para ejecutar cada 6 horas:

```bash
cd /home/USUARIO/public_html/backend && /usr/bin/node scripts/track.js
```

**Nota:** Reemplaza `USUARIO` con tu nombre de usuario de cPanel.

## Configuración en cPanel:

1. Ve a **Cron Jobs** en tu cPanel
2. Agrega un nuevo cron job con:
   - **Common Settings:** Every 6 hours
   - **Minute:** 0
   - **Hour:** */6
   - **Day:** *
   - **Month:** *
   - **Weekday:** *
   - **Command:** `cd /home/USUARIO/public_html/backend && /usr/bin/node scripts/track.js`

## Frecuencias recomendadas:

- **Cada 6 horas:** `0 */6 * * *`
- **Cada 4 horas:** `0 */4 * * *`
- **Cada 12 horas:** `0 */12 * * *`

## Verificar que funcione:

1. Ejecuta manualmente el comando desde cPanel
2. Revisa que se genere el archivo `public/historial.json`
3. Verifica los logs en cPanel > Cron Jobs > Logs

## Estructura de archivos esperada:

```
backend/
├── scripts/
│   └── track.js          # Script principal
├── public/
│   └── historial.json    # Archivo generado por el cronjob
└── src/
    └── App.jsx           # Aplicación React que lee historial.json
```

## Troubleshooting:

- Si hay errores, revisa los logs del cronjob
- Asegúrate de que las dependencias estén instaladas: `npm install`
- Verifica que el path al archivo sea correcto
- El archivo se guarda en `./public/historial.json` para que sea accesible desde la web
