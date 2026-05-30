FROM node:20-bookworm-slim

WORKDIR /app

# Python 3 + venv for pyswisseph. The Node server calls python3 on Linux/Render.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv python3-pip ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./requirements.txt
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN python3 -m pip install --upgrade pip setuptools wheel \
    && python3 -m pip install -r requirements.txt

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]
