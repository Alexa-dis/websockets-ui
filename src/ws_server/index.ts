import { WebSocketServer } from "ws";
import WebSocketChild from "./ws_child";
import { WS_PLAYERS } from "../bd/index";

let amountOfId: number = 0;

const startWSServer = (port: any, cb: any) => {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (wsClient) => {
    const idPlayer = amountOfId++;
    WS_PLAYERS.set(idPlayer, wsClient);

    wsClient.on("message", async (data: Buffer) => {
      await WebSocketChild(idPlayer, data);
    });

    wsClient.on("error", (error) => {
      console.log(error);
    });
  });

  cb();

  wss.on("close", () => {
    console.log("close");
  });
};

export default startWSServer;
