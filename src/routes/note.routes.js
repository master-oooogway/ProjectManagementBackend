import { Router } from "express";

import {
  getNotes,
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
} from "../controllers/note.controllers.js";

import {
  verifyJWT,
  validateProjectPermission,
} from "../middlewares/auth.middleware.js";

import { UserRolesEnum } from "../utils/constants.js";

const router = Router();

router
  .route("/:projectId")
  .get(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    getNotes
  )
  .post(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    createNote
  );

router
  .route("/:projectId/:noteId")
  .get(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    getNoteById
  )
  .put(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
      UserRolesEnum.MEMBER,
    ]),
    updateNote
  )
  .delete(
    verifyJWT,
    validateProjectPermission([
      UserRolesEnum.ADMIN,
      UserRolesEnum.PROJECT_ADMIN,
    ]),
    deleteNote
  );

export default router;