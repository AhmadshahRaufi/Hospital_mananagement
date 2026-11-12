import express from "express";
import asyncHandler from "express-async-handler";
import { prisma } from "../config/db.js";
import { protect, allowRoles } from "../middleware/auth.js";
import { serialize } from "../utils/serialize.js";
import { shapeSetting } from "../utils/shape.js";

const router = express.Router();
router.use(protect);

const getOrCreate = async () => {
  let settings = await prisma.setting.findFirst();
  if (!settings) settings = await prisma.setting.create({ data: {} });
  return settings;
};

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(serialize(shapeSetting(await getOrCreate())));
  })
);

router.put(
  "/",
  allowRoles("admin"),
  asyncHandler(async (req, res) => {
    const current = await getOrCreate();
    const { zoom, ...rest } = req.body;
    const data = { ...rest };
    if (zoom) {
      if (zoom.accountEmail !== undefined) data.zoomAccountEmail = zoom.accountEmail;
      if (zoom.apiKey !== undefined) data.zoomApiKey = zoom.apiKey;
      if (zoom.apiSecret !== undefined) data.zoomApiSecret = zoom.apiSecret;
      if (zoom.accessToken !== undefined) data.zoomAccessToken = zoom.accessToken;
      if (zoom.connected !== undefined) data.zoomConnected = zoom.connected;
    }
    const updated = await prisma.setting.update({ where: { id: current.id }, data });
    res.json(serialize(shapeSetting(updated)));
  })
);

export default router;
