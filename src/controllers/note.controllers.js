import { Project } from "../models/project.models.js";
import { ProjectNote } from "../models/note.models.js";

import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

import mongoose from "mongoose";

const getNotes = asyncHandler(async (req, res) => {
  const { projectId } = req.params;

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const notes = await ProjectNote.find({
    project: new mongoose.Types.ObjectId(projectId),
  })
    .populate("createdBy", "username fullName avatar")
    .sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, notes, "Notes fetched successfully")
  );
});

const createNote = asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const project = await Project.findById(projectId);

  if (!project) {
    throw new ApiError(404, "Project not found");
  }

  const note = await ProjectNote.create({
    project: projectId,
    createdBy: req.user._id,
    content,
  });

  return res.status(201).json(
    new ApiResponse(201, note, "Note created successfully")
  );
});

const getNoteById = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;

  const note = await ProjectNote.findOne({
    _id: noteId,
    project: projectId,
  }).populate("createdBy", "username fullName avatar");

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  return res.status(200).json(
    new ApiResponse(200, note, "Note fetched successfully")
  );
});

const updateNote = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;
  const { content } = req.body;

  const note = await ProjectNote.findOne({
    _id: noteId,
    project: projectId,
  });

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  note.content = content;

  await note.save();

  return res.status(200).json(
    new ApiResponse(200, note, "Note updated successfully")
  );
});

const deleteNote = asyncHandler(async (req, res) => {
  const { projectId, noteId } = req.params;

  const note = await ProjectNote.findOne({
    _id: noteId,
    project: projectId,
  });

  if (!note) {
    throw new ApiError(404, "Note not found");
  }

  await ProjectNote.findByIdAndDelete(noteId);

  return res.status(200).json(
    new ApiResponse(200, {}, "Note deleted successfully")
  );
});

export {
  getNotes,
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
};