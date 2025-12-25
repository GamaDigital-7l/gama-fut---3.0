# Stage 1: Build the application using Node
FROM node:20-alpine as builder

WORKDIR /app

# Copy package.json and install dependencies
# Esta etapa é crucial para instalar as dependências
COPY package.json .
RUN npm install

# Copy the rest of the application code (incluindo src/, index.html, etc.)
COPY . .

# CRUCIAL: Limpa explicitamente qualquer build anterior para forçar o Vite a gerar conteúdo novo
RUN rm -rf dist

# Build the application (output goes to /app/dist)
RUN npm run build

# Stage 2: Serve the application using a lightweight Nginx server
FROM nginx:alpine as production

# Copia a configuração Nginx para roteamento SPA
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos de build do estágio anterior para o Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose the port Nginx runs on
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]