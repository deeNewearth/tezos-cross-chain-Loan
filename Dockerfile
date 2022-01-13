FROM node:12.22.7-stretch as build

COPY ./cross-chain /cross-chain

WORKDIR /cross-chain
RUN npm install 

RUN npm run build

FROM node:12.22.7-alpine
COPY ./server /server

COPY --from=build /cross-chain/build /server/public

WORKDIR /server
RUN npm install 

COPY ./cross-chain/src/components/svrProtocol /cross-chain/src/components/svrProtocol

EXPOSE 3300

ENTRYPOINT [ "npm","run", "dev" ]

