import express from "express";
import jwt from "jsonwebtoken";
import { middleware } from "./middleware";
import { JWT_SECRET } from "@repo/backend-common/config";
import {
  CreateUserSchema,
  SigninSchema,
  CreateRoomSchema,
} from "@repo/common/types";
import { prismaClient } from "@repo/db/client";
import bcrypt from "bcrypt";

const app = express();
app.use(express.json());

app.post("/signup", async (req, res) => {
  const data = CreateUserSchema.safeParse(req.body);

  if (!data.success) {
    return res.status(400).json({
      data,
      //@ts-ignore
      errors: data.error.errors,
      message: "invalid inputs",
      // full Zod error details
    });
  }

  const hashedPassword = await bcrypt.hash(data.data?.password, 10);

  try {
    const user = await prismaClient.user.create({
      data: {
        name: data.data?.name,
        email: data.data?.username,
        password: hashedPassword,
      },
    });
    res.json({
      user,
      message: "user created",
    });
  } catch (error) {
    console.error(error);
    res.status(411).json({
      message: "user already exist",
    });
  }
});

app.post("/signin", async (req, res) => {
  const data = SigninSchema.safeParse(req.body);
  if (!data.success) {
    res.json({
      data,
      //@ts-ignore
      errors: data.error.errors,
    });
    return;
  }

  const user = await prismaClient.user.findFirst({
    where: {
      email: data.data?.username,
    },
  });

  if (!user) {
    res.status(403).json({
      message: "not authorized",
    });
  }

  const isValid = await bcrypt.compare(data.data?.password, user!.password);
  if (!isValid) {
    res.status(401).json({
      message: "incorrect password",
    });
  }

  const token = jwt.sign(
    {
      userId: user?.id,
    },
    JWT_SECRET
  );
  res.json({ token });
});

app.post("/room", middleware, async (req, res) => {
  const data = CreateRoomSchema.safeParse(req.body);

  if (!data.success) {
    return res.status(400).json({
      message: "Incorrect inputs",
      //@ts-ignore
      errors: data.error.errors,
    });
  }

  //@ts-ignore
  const userId = req.userId;

  try {
    const roomDetails = await prismaClient.room.create({
      data: {
        slug: data.data.name,
        adminId: userId,
      },
    });

    res.json({
      roomId: roomDetails.id,
      message: "Room created successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(409).json({
      message: "Room already exists or DB error",
    });
  }
});

app.get("/chats/:roomId", async(req, res) => {
  const roomId = Number(req.params.roomId);
  const messages = await prismaClient.chat.findMany({
    where: {
      roomId: roomId,
    },
    take: 50,
    orderBy: {
      id: "desc"
    }
  
  });

  res.json({
    messages
  })
});

app.listen(3001, () => {
  console.log("listening working 3001");
});
