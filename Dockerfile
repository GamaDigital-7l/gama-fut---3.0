# Stage 1: Build the application using Node
FROM node:20-alpine as builder

WORKDIR /app

# Copia package.json e instala as dependências
COPY package.json .
RUN npm install

# Copia o restante do código da aplicação
COPY . .

# CRUCIAL: Limpa explicitamente qualquer build anterior para forçar o Vite a gerar conteúdo novo
RUN rm -rf dist

# Constrói a aplicação (o output vai para /app/dist)
RUN npm run build

# Stage 2: Serve the application using a lightweight Nginx server
FROM nginx:alpine as production

# Copia a configuração Nginx para roteamento SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos de build do estágio anterior para o Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expõe a porta 80 (porta interna do container)
EXPOSE 80

# Inicia o Nginx
CMD ["nginx", "-g", "daemon off;"]