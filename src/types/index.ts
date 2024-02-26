export interface User {
  name: string;
  password: string;
}

export interface UserWithId extends User {
  id: number;
}

export interface RoomUser {
  name: string,
  index: number,
}

export interface Room {
  roomId: number,
  roomUsers: RoomUser[],
}

export interface ShipCell {
  positions: {
    x: number,
    y: number,
  }[],
  type: any,
}

export interface Player {
  idPlayer: number,
  isWinner: boolean,
  ships: ShipCell[],
}

export interface Game {
  idGame: number,
  state: any,
  players: Player[],
}

export interface Ship {
  position: {
    x: number,
    y: number,
  },
  direction: boolean,
  length: number,
  type: any,
}

export interface WebSocketPayload<T> {
  type: any;
  data: T;
  id: number;
}

export interface Attack {
  gameId: number,
  indexPlayer: number,
  x: number,
  y: number,
}
