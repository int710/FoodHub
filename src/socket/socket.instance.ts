import { Server } from "socket.io";

let ioInstance: Server | null = null;
export const setSocketIO = (io: Server): void => {
  ioInstance = io
}

export const getSocketIO = (): Server => {
  if (!ioInstance) {
    throw new Error('[Socket.io Error]: Socket.io has not been initialized!');
  }
  return ioInstance;
};