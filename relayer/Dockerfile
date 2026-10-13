FROM node:22-bookworm-slim
WORKDIR /srv/famfi/relayer
COPY relayer/package.json relayer/package-lock.json ./
RUN npm ci
COPY relayer/src ./src
COPY relayer/tsconfig.json ./tsconfig.json
COPY abi /srv/famfi/abi
RUN npm run typecheck
ENV NODE_ENV=production
EXPOSE 8787
CMD ["npm", "start"]
