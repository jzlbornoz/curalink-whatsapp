# 1. Plataforma AMD64 (Obligatorio para tu Mac M1/M2/M3)
FROM --platform=linux/amd64 node:20-slim

# 2. Instalar dependencias de sistema para Chrome
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

COPY package*.json ./

# --- EL FIX NUCLEAR ---
# 1. Instalamos TypeScript globalmente para que el comando 'tsc' SIEMPRE exista
RUN npm install -g typescript

# 2. Usamos 'npm install' en lugar de 'ci' para ser más permisivos con el lockfile
RUN npm install

COPY . .

# Ahora NO PUEDE fallar porque tsc está instalado globalmente
RUN npm run build

# Limpieza (opcional, puedes comentarlo si sigue molestando)
# RUN npm prune --production

EXPOSE 3000
CMD [ "node", "dist/index.js" ]