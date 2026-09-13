# A vitrine (Next.js) em dois estágios: um constrói, o outro só carrega. O
# código-fonte, o compilador e o node_modules de desenvolvimento ficam para
# trás — o que vai para produção é o servidor mínimo e nada mais.
#
# Gêmeo do Dockerfile do painel, com uma diferença que importa: aqui não há
# nenhuma variável NEXT_PUBLIC_*. A vitrine lê tudo o que precisa no servidor
# (API_URL), então a imagem construída serve qualquer domínio — e trocar de
# endereço não pede reconstrução.

# ---------------------------------------------------------------------------
# 1. Dependências
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps

WORKDIR /app

# Só os manifestos primeiro: enquanto eles não mudarem, o Docker reaproveita
# esta camada e o build não baixa nada de novo.
COPY package.json package-lock.json ./

# "ci" e não "install": instala exatamente o que está no package-lock, sem
# resolver versões de novo. É o que faz o build de hoje ser igual ao de ontem
# — e o que impede uma dependência nova de entrar sem ninguém pedir.
RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

# O build roda com NODE_ENV=production, mas sem API_URL — e é de propósito:
# a conferência de ambiente (ver instrumentation.ts) roda na SUBIDA do
# servidor, não na construção da imagem. Construir não pode depender de
# conhecer o endereço do backend.
RUN npm run build

# ---------------------------------------------------------------------------
# 3. Execução
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário sem privilégio. A imagem do node traz o "node" pronto para isso.
USER node

# O standalone traz o server.js e só as dependências que ele usa de fato.
# public/ e .next/static não vêm junto por padrão (ver a doc de output) — daí
# serem copiados à parte, senão a loja sobe sem CSS nem imagem.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

EXPOSE 3000

# server.js e não "next start": o standalone não traz o CLI do Next.
CMD ["node", "server.js"]
