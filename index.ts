import startHttpServer from "./src/http_server/index";
import startWSServer from "./src/ws_server/index";

const HTTP_PORT = Number(process.env.HTTP_PORT) || 8181;
const WS_PORT = 3000;

startHttpServer(HTTP_PORT, () => {
  console.log(`Start static http server on the ${HTTP_PORT} port!`);
});

startWSServer(WS_PORT, () => {
  console.log(`Start websocket http server on the ${WS_PORT} port!`);
});
