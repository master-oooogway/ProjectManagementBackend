import { Project } from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { SubTask } from "../models/subtask.models.js";
import { ProjectMember } from "../models/projectmember.models.js";

import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

import mongoose from "mongoose";

const getTasks = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const tasks = await Task.find({
        project: new mongoose.Types.ObjectId(projectId),
    })
        .populate("assignedTo", "avatar username fullName")
        .populate("assignedBy", "avatar username fullName")
        .sort({ createdAt: -1 });

    return res.status(200).json(
        new ApiResponse(200, tasks, "Tasks fetched successfully")
    );
});

const createTask = asyncHandler(async (req, res) => {
    const { title, description, assignedTo, status } = req.body;
    const { projectId } = req.params;

    if (!title?.trim()) {
        throw new ApiError(400, "Title is required");
    }

    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    if (assignedTo) {
        const member = await ProjectMember.findOne({
            project: projectId,
            user: assignedTo,
        });

        if (!member) {
            throw new ApiError(
                400,
                "Assigned user is not a member of this project"
            );
        }
    }

    const files = req.files || [];

    const attachments = files.map((file) => ({
        url: `${process.env.SERVER_URL}/images/${file.originalname}`,
        mimetype: file.mimetype,
        size: file.size,
    }));

    const task = await Task.create({
        title,
        description,
        project: new mongoose.Types.ObjectId(projectId),
        assignedTo: assignedTo
            ? new mongoose.Types.ObjectId(assignedTo)
            : undefined,
        assignedBy: new mongoose.Types.ObjectId(req.user._id),
        status,
        attachments,
    });

    return res.status(201).json(
        new ApiResponse(201, task, "Task created successfully")
    );
});

const getTaskById = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOne({
        _id: taskId,
        project: projectId,
    })
        .populate("assignedTo", "avatar username fullName")
        .populate("assignedBy", "avatar username fullName");

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const subTasks = await SubTask.find({
        task: taskId,
    }).populate("createdBy", "avatar username fullName");

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                task,
                subTasks,
            },
            "Task fetched successfully"
        )
    );
});

const updateTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const {
        title,
        description,
        assignedTo,
        status,
    } = req.body;

    const task = await Task.findOne({
        _id: taskId,
        project: projectId,
    });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    if (assignedTo) {
        const member = await ProjectMember.findOne({
            project: projectId,
            user: assignedTo,
        });

        if (!member) {
            throw new ApiError(
                400,
                "Assigned user is not a member of this project"
            );
        }
    }

    if (title !== undefined) {
        task.title = title;
    }

    if (description !== undefined) {
        task.description = description;
    }

    if (status !== undefined) {
        task.status = status;
    }

    if (assignedTo !== undefined) {
        task.assignedTo = assignedTo;
    }

    const files = req.files || [];

    if (files.length > 0) {
        const attachments = files.map((file) => ({
            url: `${process.env.SERVER_URL}/images/${file.originalname}`,
            mimetype: file.mimetype,
            size: file.size,
        }));

        task.attachments = [
            ...task.attachments,
            ...attachments,
        ];
    }

    await task.save();

    return res.status(200).json(
        new ApiResponse(200, task, "Task updated successfully")
    );
});

const deleteTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOne({
        _id: taskId,
        project: projectId,
    });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    await SubTask.deleteMany({
        task: taskId,
    });

    await Task.findByIdAndDelete(taskId);

    return res.status(200).json(
        new ApiResponse(200, {}, "Task deleted successfully")
    );
});

const createSubTask = asyncHandler(async (req, res) => {
    const { taskId, projectId } = req.params;
    const { title } = req.body;

    if (!title?.trim()) {
        throw new ApiError(400, "Title is required");
    }

    const task = await Task.findOne({
        _id: taskId,
        project: projectId,
    });

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const subTask = await SubTask.create({
        title,
        task: taskId,
        createdBy: req.user._id,
    });

    return res.status(201).json(
        new ApiResponse(
            201,
            subTask,
            "Subtask created successfully"
        )
    );
});

const updateSubTask = asyncHandler(async (req, res) => {
    const { subTaskId } = req.params;
    const { title, isCompleted } = req.body;

    const subTask = await SubTask.findById(subTaskId);

    if (!subTask) {
        throw new ApiError(404, "Subtask not found");
    }

    if (title !== undefined) {
        subTask.title = title;
    }

    if (isCompleted !== undefined) {
        subTask.isCompleted = isCompleted;
    }

    await subTask.save();

    return res.status(200).json(
        new ApiResponse(
            200,
            subTask,
            "Subtask updated successfully"
        )
    );
});

const deleteSubTask = asyncHandler(async (req, res) => {
    const { subTaskId } = req.params;

    const subTask = await SubTask.findById(subTaskId);

    if (!subTask) {
        throw new ApiError(404, "Subtask not found");
    }

    await SubTask.findByIdAndDelete(subTaskId);

    return res.status(200).json(
        new ApiResponse(
            200,
            {},
            "Subtask deleted successfully"
        )
    );
});

export {
    getTasks,
    createTask,
    getTaskById,
    updateTask,
    deleteTask,
    createSubTask,
    updateSubTask,
    deleteSubTask,
};