import { WS_PLAYERS } from "../bd/index";
import * as controller from "../controllers";
import { currentPlayerIndex } from "../controllers";
import { transformToJSON } from "../helpers";

const WebSocketChild = async (userId: number, dataMessage: any) => {
  const wsClient = WS_PLAYERS.get(userId);

  if (!wsClient) {
    return;
  }

  try {
    let result;
    let message = JSON.parse(dataMessage.toString());

    if (message.data) {
      const data = JSON.parse(message.data);
      message = { ...message, data };
    }

    switch (message.type) {
      case "reg":
        result = await controller.registerUser(userId, message);
        wsClient.send(transformToJSON(result));
        break;
      case "create_room":
        result = await controller.createRoom(userId, message);
        controller.updateRoom(transformToJSON(result));
        break;
      case "add_user_to_room":
        result = await controller.addUserToRoom(userId, message);
        controller.createGame(result);
        break;
      case "add_ships":
        const idGame = await controller.addShips(userId, message);

        const isStarted = await controller.startGame(idGame);

        if (isStarted) {
          const enemyIdPlayer = controller.findEnemyIdPlayer(
            idGame,
            message.data.indexPlayer
          );

          if (enemyIdPlayer) {
            await controller.notifyPlayersOfTurn(idGame, enemyIdPlayer);
          }
        }
        break;
      case 'attack':
        const { indexPlayer } = message.data;

        if (indexPlayer !== currentPlayerIndex) {
          return;
        }

        await controller.attackData(message);
        break;
      case 'randomAttack':
        const randomAttack = {
          ...message.data,
          x: Math.random() * 10,
          y: Math.random() * 10,
        };
        await controller.attackData({ ...message, data: { ...randomAttack } });
        break;
      default:
        console.log("Unknown message type");
    }
  } catch (error) {
    console.log(error);
  }
};

export default WebSocketChild;
