"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const clerkController_1 = require("./clerkController");
const router = (0, express_1.Router)();
router.post('/clerk', clerkController_1.clerkController);
exports.default = router;
//# sourceMappingURL=routes.js.map