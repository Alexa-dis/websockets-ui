import { GAMES, ROOMS, USERS, WINNERS, WS_PLAYERS } from "../bd/index";
import {
  checkWinner,
  parseShips,
  transformToJSON,
  updateWinnersCount,
} from "../helpers";
import {
  Attack,
  Game,
  Player,
  Room,
  UserWithId,
  WebSocketPayload,
} from "../types/index";
import * as controller from "../controllers";

export let currentPlayerIndex: number = 0;

export const registerUser = async (userId: number, dataMessage: any) => {
  const { type, data, id } = dataMessage;

  const responseData = { error: false, errorText: "" };
  const isUserExists = USERS.find(
    (user: UserWithId) =>
      user.name === data.name && user.password === data.password
  );

  if (!isUserExists) {
    USERS.push({ ...data, id: userId });
  }

  return { type, data: { ...data, ...responseData }, id };
};

export const createRoom = async (userId: number, dataMessage: any) => {
  const { id } = dataMessage;

  const user = USERS.find((user: UserWithId) => user.id === userId);

  if (user) {
    const room: Room = {
      roomId: userId,
      roomUsers: [{ name: user.name, index: userId }],
    };
    ROOMS.push(room);

    const filteredRooms = ROOMS.filter((room) => room.roomUsers.length < 2);

    return { type: "update_room", data: filteredRooms, id };
  } else {
    throw new Error("User not found");
  }
};

export const updateRoom = (response: string) => {
  WS_PLAYERS.forEach((webSocket: WebSocket, userId: number) => {
    const isMatchingUser = USERS.some((user) => user.id === userId);

    if (isMatchingUser) {
      webSocket.send(response);
    }
  });
};

export const addUserToRoom = (userId: number, dataMessage: any) => {
  const newGame: Game = {
    idGame: GAMES.length,
    state: "waiting",
    players: [
      {
        idPlayer: userId,
        isWinner: false,
        ships: [],
      },
      {
        idPlayer: USERS.filter((user: UserWithId) => user.id !== userId)[0]
          ?.id!,
        isWinner: false,
        ships: [],
      },
    ],
  };

  GAMES.push(newGame);

  const roomIndex = ROOMS.findIndex(
    (room: Room) => room.roomId === dataMessage.data.indexRoom
  );

  if (roomIndex !== -1) {
    ROOMS.splice(roomIndex, 1);
  }

  return newGame.idGame;
};

export const createGame = (idGame: number) => {
  const game = GAMES.find(
    (game) => game.idGame === idGame && game.players.length === 2
  );

  if (game) {
    game.players.forEach((player: Player) => {
      const webSocket = WS_PLAYERS.get(player.idPlayer)!;

      const response = JSON.stringify({
        type: "create_game",
        data: JSON.stringify({ idGame, idPlayer: player.idPlayer }),
        id: 0,
      });

      webSocket.send(response);
    });
  }
};

export const startGame = async (idGame: number): Promise<boolean> => {
  const game = GAMES.find((game: Game) => game.idGame === idGame);

  const everyPlayerWithShip = game?.players.every(
    (player: Player) => player.ships.length > 0
  );

  if (game && everyPlayerWithShip) {
    game.state = "in-progress";

    game.players.forEach((player: Player) => {
      const webSocket = WS_PLAYERS.get(player.idPlayer)!;

      const response = JSON.stringify({
        type: "start_game",
        data: JSON.stringify({
          ships: player.ships,
          currentPlayerIndex: player.idPlayer,
        }),
        id: 0,
      });

      webSocket.send(response);
    });
    return true;
  } else {
    return false;
  }
};

export const addShips = async (userId: number, dataMessage: any) => {
  const { data } = dataMessage;

  const game = GAMES.find((game: Game) => game.idGame === data.gameId);

  if (game) {
    const player = game.players.find(
      (player: Player) => player.idPlayer === userId
    );

    if (player) {
      player.ships = parseShips(data.ships);
    }
  }

  return data.gameId;
};

export const findEnemyIdPlayer = (
  idGame: number,
  currentPlayerIndex: number
) => {
  const game = GAMES.find((game) => game.idGame === idGame)!;

  const enemyPlayer = game.players.find(
    (player: Player) => player.idPlayer !== currentPlayerIndex
  )!;

  return enemyPlayer.idPlayer!;
};

export const notifyPlayersOfTurn = async (
  idGame: number,
  idPlayerForTurn: number
) => {
  const game = GAMES.find((game) => game.idGame === idGame);

  if (game) {
    game.players.forEach((player: Player) => {
      const webSocket = WS_PLAYERS.get(player.idPlayer)!;

      const response = JSON.stringify({
        type: "turn",
        data: JSON.stringify({ currentPlayerIndex: idPlayerForTurn }),
        id: 0,
      });

      currentPlayerIndex = idPlayerForTurn;

      webSocket.send(response);
    });
  }
};

const attackPayload = async (dataMessage: WebSocketPayload<Attack>) => {
  const {
    data: { gameId, indexPlayer, x, y },
    id,
  } = dataMessage;

  let result = "";

  const game = GAMES.find((game) => game.idGame === gameId);

  if (game) {
    const enemyShips = game.players.find(
      (player: Player) => player.idPlayer !== indexPlayer
    )!.ships;

    const hitShip = enemyShips.find(({ positions }: any) =>
      positions.some((position: any) => position.x === x && position.y === y)
    );

    if (hitShip) {
      const leftShipPositions = hitShip.positions.filter(
        (position: any) => position.x !== x || position.y !== y
      );
      hitShip.positions = leftShipPositions;
      result = leftShipPositions.length === 0 ? "kill" : "shot";
    } else {
      result = "miss";
    }

    return {
      type: 'attack',
      data: {
        position: { x, y },
        currentPlayer: indexPlayer,
        status: result,
      },
      id,
    };
  } else {
    throw new Error("Game not found");
  }
};

export const attackData = async (dataMessage: any) => {
  const { indexPlayer, gameId } = dataMessage.data;

  let result = await attackPayload(dataMessage);
  const response = transformToJSON(result);

  await attackAnswer(gameId, response);

  if (result.data.status === "kill") {
    const isWinner = checkWinner(gameId);
    if (isWinner) {
      await finishGame(gameId, indexPlayer);
      updateWinnersCount(indexPlayer);
      await winnersUpdate(gameId);
      return;
    }
  }
  const enemyId = findEnemyIdPlayer(gameId, indexPlayer);

  const nextTurnPlayerId =
    result.data.status === "miss" ? enemyId : indexPlayer;

  await notifyPlayersOfTurn(gameId, nextTurnPlayerId);
};

export const attackAnswer = async (idGame: number, response: string) => {
  const game = GAMES.find((game) => game.idGame === idGame);

  if (game) {
    game.players.forEach((player: Player) => {
      const webSocket = WS_PLAYERS.get(player.idPlayer)!;

      webSocket.send(response);
    });
  }
};

export const finishGame = async (idGame: number, winnerId: number) => {
  const game = GAMES.find((game) => game.idGame === idGame)!;

  game.players.forEach((player: Player) => {
    const webSocket = WS_PLAYERS.get(player.idPlayer)!;

    webSocket.send(
      JSON.stringify({
        type: "finished",
        data: JSON.stringify({ winPlayer: winnerId }),
      })
    );
  });
};

export const winnersUpdate = async (idGame: number) => {
  const game = GAMES.find((game) => game.idGame === idGame)!;

  game.players.forEach((player: Player) => {
    const webSocket = WS_PLAYERS.get(player.idPlayer)!;

    webSocket.send(
      JSON.stringify({
        type: "update_winners",
        data: JSON.stringify({ winnersTable: WINNERS }),
      })
    );
  });
};
