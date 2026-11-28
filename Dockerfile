FROM node:20
COPY . .
RUN npm install --package-lock=false
EXPOSE 3000
CMD [ "node" ,"index.js" ]
