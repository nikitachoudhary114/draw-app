import { WebSocket, WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";
import { prismaClient } from "@repo/db/client";

const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket;
  room: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (typeof decoded === "string") return null;
    if (!decoded || !decoded.userId) return null;

    return decoded.userId as string;
  } catch (error) {
    return null;
  }
}

wss.on("connection", function connection(ws, request) {
  console.log("server working websocket");
  const url = request.url;
  if (!url) return;

  const queryParams = new URLSearchParams(url.split("?")[1]);
  const token = queryParams.get("token") || "";
  const userId = checkUser(token);

  if (!userId) {
    ws.close();
    return;
  }

  users.push({
    userId,
    room: [],
    ws,
  });

  ws.on("message", async function message(data) {
    try {
      const parsedData = JSON.parse(data as unknown as string);

      if (parsedData.type === "join_room") {
        const user = users.find((x) => x.ws === ws);

        const room = await prismaClient.room.findFirst({
          where: {
            id: parsedData.roomId,
          },
        });

        if (!room) {
          ws.send("Room does not exist");
          return;
        }

        user?.room.push(parsedData.roomId);
        ws.send(`Joined room ${parsedData.roomId}`);
      }

      if (parsedData.type === "leave_room") {
        const user = users.find((x) => x.ws === ws);
        if (!user) {
          return;
        }
        user.room = user.room.filter((x) => x !== parsedData.roomId);
        ws.send(`Left room ${parsedData.roomId}`);
      }

      if (parsedData.type === "chat") {
        const roomId = parsedData.roomId;
        const message = parsedData.message;

        await prismaClient.chat.create({
          data: {
            roomId,
            message,
            userId,
          },
        });

        users.forEach((user) => {
          if (user.room.includes(roomId)) {
            user.ws.send(
              JSON.stringify({
                type: "chat",
                message,
                roomId,
              })
            );
          }
        });
      }
    } catch (err) {
      console.error("Error handling message:", err);

      const reason =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Unknown error";

      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid message format",
          reason,
        })
      );
    }
  });
});
