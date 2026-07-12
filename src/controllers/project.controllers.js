import {User} from "../models/user.models.js"
import {Project} from "../models/project.models.js"
import {ProjectMember} from "../models/projectmember.models.js"

import {ApiResponse} from "../utils/api-response.js"
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";

import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { assertObjectId } from "../utils/objectid.js";



const getProjects = asyncHandler(async (req, res) => {
    const projects = await ProjectMember.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "projects",
                localField: "project",
                foreignField: "_id",
                as: "project",
                pipeline: [
                    {
                        $lookup: {
                            from: "projectmembers",
                            localField: "_id",
                            foreignField: "project",
                            as: "projectMembers"
                        }
                    },
                    {
                        $lookup: {
                            from: "users",
                            localField: "createdBy",
                            foreignField: "_id",
                            as: "creator",
                            pipeline: [
                                {
                                    $project: {
                                        _id: 1,
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            members: {
                                $size: "$projectMembers"
                            },
                            creator: {
                                $arrayElemAt: ["$creator", 0]
                            }
                        }
                    },
                    {
                        $project: {
                            projectMembers: 0
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$project"
        },
        {
            $project: {
                _id: 0,
                role: 1,
                project: {
                    _id: "$project._id",
                    name: "$project.name",
                    description: "$project.description",
                    members: "$project.members",
                    createdAt: "$project.createdAt",
                    updatedAt: "$project.updatedAt",
                    creator: "$project.creator"
                }
            }
        },
        {
            $sort: {
                "project.createdAt": -1
            }
        }
    ]);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                projects,
                "Projects fetched successfully"
            )
        );
});

const getProjectById = asyncHandler(async(req, res) => {
    const {projectId} = req.params
    const safeProjectId = assertObjectId(projectId, "projectId");
    const project = await Project.aggregate([
    {
        $match: {
            _id: safeProjectId
        }
    },
    {
        $lookup: {
            from: "projectmembers",
            localField: "_id",
            foreignField: "project",
            as: "members"
        }
    },
    {
        $lookup: {
            from: "users",
            localField: "createdBy",
            foreignField: "_id",
            as: "creator",
            pipeline: [
                {
                    $project: {
                        _id: 1,
                        fullName: 1,
                        username: 1,
                        email: 1
                    }
                }
            ]
        }
    },
    {
        $addFields: {
            memberCount: {
                $size: "$members"
            },
            creator: {
                $arrayElemAt: ["$creator", 0]
            }
        }
    },
    {
        $project: {
            members: 0
        }
    }
]);
    if(!project.length){
        throw new ApiError(404, "Project not found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200,
                project[0],
                "Project fetched successfully"
            )
        )
})

const createProject = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    const session = await mongoose.startSession();

    let createdProject;

    try {
        await session.withTransaction(async () => {

            const projects = await Project.create(
                [
                    {
                        name,
                        description,
                        createdBy: req.user._id
                    }
                ],
                { session }
            );

            createdProject = projects[0];

            await ProjectMember.create(
                [
                    {
                        user: req.user._id,
                        project: createdProject._id,
                        role: UserRolesEnum.ADMIN
                    }
                ],
                { session }
            );
        });

    } finally {
        await session.endSession();
    }

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                createdProject,
                "Project Created Successfully"
            )
        );
});

const updateProject = asyncHandler(async(req, res) => {

    //we are hoping that someone will send the name and description inside request obj
    const {name, description} = req.body

    //we are taking projectId from url(params)
    const { projectId } = req.params;

    const safeProjectId = assertObjectId(projectId, "projectId");

    const project = await Project.findByIdAndUpdate(
        safeProjectId,
        {
            name,
            description
        },
        { new: true }
    );
    if(!project){
        throw new ApiError(404, "Project not found")
    }
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                project,
                "Project updated successfully"
            )
        )
})

const deleteProject = asyncHandler(async(req, res) => {
    const { projectId } = req.params;

    const safeProjectId = assertObjectId(projectId, "projectId");

    const project = await Project.findById(safeProjectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    await ProjectMember.deleteMany({
        project: safeProjectId
    });

    await Project.findByIdAndDelete(safeProjectId);

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                project,
                "Project deleted successfully"
            )
        );
});

const addMembersToProject = asyncHandler(async(req, res) => {
    const {email, role} = req.body
    const {projectId } = req.params
    const safeProjectId = assertObjectId(projectId, "projectId");
    const user = await User.findOne({email});

    if (!user) {
        throw new ApiError(404, "No account found with this email. Ask your teammate to register first.");
    }

    const existingMember = await ProjectMember.findOne({
    user: user._id,
    project: safeProjectId
});

if (existingMember) {
    throw new ApiError(
        409,
        "User is already a member of this project"
    );
}

await ProjectMember.create({
    user: user._id,
    project: safeProjectId,
    role
});

    return res
        .status(201)
        .json(
            new ApiResponse(201, {}, "Project member added successfully")
        )
})

const getProjectMembers = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const safeProjectId = assertObjectId(projectId, "projectId");

    const project = await Project.findById(safeProjectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const projectMembers = await ProjectMember.aggregate([
        {
            $match: {
                project: safeProjectId
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            email: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$user"
        },
        {
            $project: {
                _id: 0,
                role: 1,
                joinedAt: "$createdAt",
                user: 1
            }
        },
        {
            $sort: {
                role: 1,
                joinedAt: 1
            }
        }
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            projectMembers,
            "Project members fetched successfully"
        )
    );
});

const getAllProjectMembers = asyncHandler(async (req, res) => {
    const projectMembers = await ProjectMember.aggregate([
        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            email: 1,
                            fullName: 1,
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$user",
                preserveNullAndEmptyArrays: true,
            }
        },
        {
            $lookup: {
                from: "projects",
                localField: "project",
                foreignField: "_id",
                as: "project",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            name: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: {
                path: "$project",
                preserveNullAndEmptyArrays: true,
            }
        },
        {
            $project: {
                _id: 0,
                userId: "$user._id",
                name: { $ifNull: ["$user.fullName", "$user.username"] },
                email: "$user.email",
                projectId: "$project._id",
                projectName: "$project.name",
                role: 1,
                createdAt: 1,
                updatedAt: 1
            }
        }
    ])

    return res
        .status(200)
        .json(
            new ApiResponse(200, projectMembers, "All project members fetched")
        )
})





const updateMemberRole = asyncHandler(async(req, res) => {
    const {projectId, userId} = req.params
    const {newRole} = req.body

    const safeProjectId = assertObjectId(projectId, "projectId");
    const safeUserId = assertObjectId(userId, "userId");


    if(!AvailableUserRole.includes(newRole)){
        throw new ApiError(400, "Invalid role")
    }

    let projectMember = await ProjectMember.findOne({
        project: safeProjectId,
        user: safeUserId
    })

    if(!projectMember){
        throw new ApiError(400, "Project member not found");
    }

    if (
        projectMember.role === UserRolesEnum.ADMIN &&
        newRole !== UserRolesEnum.ADMIN
    ) {
        const adminCount = await ProjectMember.countDocuments({
            project: safeProjectId,
            role: UserRolesEnum.ADMIN
        });

        if (adminCount <= 1) {
            throw new ApiError(
                400,
                "Cannot change role of the last admin"
            );
        }
    }

    projectMember = await ProjectMember.findByIdAndUpdate(
        projectMember._id,
        {
            role: newRole
        },
        {new: true}
    )
    if(!projectMember){
        throw new ApiError(400, "Project member not found");
    }
    return res
        .status(200)
        .json(
            new ApiResponse(200, projectMember, "Project member role updated successfully")
        )
})

const deleteMember = asyncHandler(async(req, res) => {
    const {projectId, userId} = req.params

    const safeProjectId = assertObjectId(projectId, "projectId");
    const safeUserId = assertObjectId(userId, "userId");

    if (String(safeUserId) === String(req.user._id)) {
        throw new ApiError(
            400,
            "You cannot change your own role"
        );
    }
    let projectMember = await ProjectMember.findOne({
        project: safeProjectId,
        user: safeUserId
    })

    if (String(safeUserId) === String(req.user._id)) {
        throw new ApiError(
            400,
            "You cannot remove yourself from the project"
        );
    }
    if (projectMember.role === UserRolesEnum.ADMIN) {

        const adminCount = await ProjectMember.countDocuments({
            project: safeProjectId,
            role: UserRolesEnum.ADMIN
        });

        if (adminCount <= 1) {
            throw new ApiError(
                400,
                "Cannot remove the last admin from the project"
            );
        }
    }
    if(!projectMember){
        throw new ApiError(400, "Project member not found");
    }


    projectMember = await ProjectMember.findByIdAndDelete(
        projectMember._id
    )
    if(!projectMember){
        throw new ApiError(400, "Project member not found");
    }
    return res
        .status(200)
        .json(
            new ApiResponse(200, projectMember, "Project member deleted successfully")
        )
})


export {
    addMembersToProject,
    createProject,
    deleteProject,
    deleteMember,
    getProjectById,
    getProjectMembers,
    getAllProjectMembers,
    getProjects,
    updateProject,
    updateMemberRole
}
