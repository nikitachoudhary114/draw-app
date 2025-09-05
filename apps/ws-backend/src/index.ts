import {WebSocket, WebSocketServer } from "ws";
import jwt, { JwtPayload } from "jsonwebtoken";
import { JWT_SECRET } from "@repo/backend-common/config";

const wss = new WebSocketServer({ port: 8080 });

interface User {
  ws: WebSocket;
  room: string[];
  userId: string;
}

const users: User[] = [];

function checkUser(token: string): string | null {
  const decoded = jwt.verify(token, JWT_SECRET);

  if (typeof decoded == "string") return null;

  console.log(decoded);

  if (!decoded || !decoded.userId) {
    return null;
  }
  return decoded.userId;
}

wss.on("connection", function connection(ws, request) {
  console.log("server woking wed socket");
  const url = request.url;
  console.log(url);
  if (!url) {
    return;
  }
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
        ws
    });
  ws.on("message", function message(data) {
    ws.send("good to go");
  });
});
