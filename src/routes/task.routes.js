import { Router } from "express";

import {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  createSubTask,
  updateSubTask,
  deleteSubTask,
} from "../controllers/task.controllers.js";

import {
  verifyJWT,
  validateProjectPermission,
} from "../middlewares/auth.middleware.js";

import { UserRolesEnum } from "../utils/constants.js";

const router = Router();

/**
 * GET    /:projectId
 * POST   /:projectId
 */
router
  .route("/:projectId")
  .get(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    getTasks,
  )
  .post(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    createTask,
  );

/**
 * GET    /:projectId/t/:taskId
 * PUT    /:projectId/t/:taskId
 * DELETE /:projectId/t/:taskId
 */
router
  .route("/:projectId/t/:taskId")
  .get(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    getTaskById,
  )
  .put(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    updateTask,
  )
  .delete(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    deleteTask,
  );

/**
 * POST /:projectId/t/:taskId/subtasks
 */
router
  .route("/:projectId/t/:taskId/subtasks")
  .post(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    createSubTask,
  );

/**
 * PUT    /:projectId/st/:subTaskId
 * DELETE /:projectId/st/:subTaskId
 */
router
  .route("/:projectId/st/:subTaskId")
  .put(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    updateSubTask,
  )
  .delete(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    deleteSubTask,
  );

export default router;