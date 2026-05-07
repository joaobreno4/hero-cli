# Usamos uma imagem leve do Node
FROM node:20-alpine

# Criamos a pasta de trabalho
WORKDIR /app

# Copiamos apenas os arquivos de dependências primeiro (otimização de cache)
COPY package*.json ./

# Instalamos as dependências
RUN npm install

# Copiamos o resto dos arquivos
COPY . .

# Comando para rodar a aplicação
# Nota: usamos o -it no comando do docker run depois para manter o terminal interativo
CMD ["node", "src/index.js"]
