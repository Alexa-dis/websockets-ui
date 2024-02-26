import { GAMES, USERS, WINNERS } from "../bd";
import { currentPlayerIndex } from "../controllers";
import { Player, Ship, ShipCell } from "../types";

export const transformToJSON = (response: any) => {
  return JSON.stringify({ ...response, data: JSON.stringify(response.data) });
};

export const parseShips = (ships: Ship[]): ShipCell[] => {
  if (!ships.length) {
    throw new Error('No ships found');
  }

  return ships.map(({ position: { x, y }, direction, length, type }) => {
    const shipCells: { x: number, y: number }[] = [];
    shipCells.push({ x, y });

    for (let i = 0; i < length; i++) {
      shipCells.push({
        x: direction ? x : x + i,
        y: direction ? y + i : y,
      });
    }

    return ({ type, positions: shipCells });
  });
};

export const updateWinnersCount = (winnerId: number) => {
  const winnerName = USERS.find((user) => user.id === winnerId)?.name!;

  const winner = WINNERS.find((winner) => winner.name === winnerName);

  if (winner) {
    winner.win++;
  } else {
    WINNERS.push({ name: winnerName, win: 1 });
  }
};

export const checkWinner = (gameId: number) => {
  const game = GAMES.find((game) => game.idGame === gameId)!;

  const enemyShips = game.players.find((player: Player) => player.idPlayer !== currentPlayerIndex)?.ships!;

  return enemyShips!.every((shipCell: ShipCell) => shipCell.positions.length === 0);
};
