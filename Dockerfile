# Stage 1: Build the application using Node
FROM node:20-alpine as builder

WORKDIR /app

# Copy package.json and install dependencies
COPY package.json .
COPY package-lock.json .
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application (output goes to /app/dist)
RUN npm run build

# Stage 2: Serve the application using a lightweight Nginx server
FROM nginx:alpine as production

# Copy the built files from the builder stage to Nginx's default static directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose the port Nginx runs on
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]