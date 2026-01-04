"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const controller_1 = require("./controller");
const router = (0, express_1.Router)();
router.post("/create-ata", controller_1.createAtaForUser);
router.get("/check-admin", controller_1.checkAdminStatus);
exports.default = router;
//# sourceMappingURL=route.js.map