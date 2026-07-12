import {User} from "../models/user.models.js"
import {Project} from "../models/project.models.js"
import {ProjectMember} from "../models/projectmember.models.js"

import {ApiResponse} from "../utils/api-response.js"
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";

import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { assertObjectId } from "../utils/objectid.js";



const getProjects = asyncHandler(async(req, res) => {
    //aggregation pipeline takes an array as parameter contains objs
    // Build an aggregation pipeline on the ProjectMember collection.
    // Aggregation pipelines are arrays of stages that process documents
    // sequentially. Each stage is an object beginning with a pipeline
    // operator like `$match`, `$lookup`, `$unwind`, or `$project`.
    const projects = await ProjectMember.aggregate([
            {
                // $match: filters input documents. It's like a MongoDB `find`.
                // Here we limit ProjectMember documents to those for the
                // authenticated user by comparing the `user` field.
                $match: {
                    user: new mongoose.Types.ObjectId(req.user._id)
                }
                // once we have the matching ProjectMember documents, the
                // pipeline continues to the next stage for further processing
            },
            {
                $lookup: {
                    from: "projects", 
                    // $lookup performs a left-outer join with the `projects`
                    // collection. It adds matching project documents to each
                    // ProjectMember document. `localField` is the field in the
                    // current collection (ProjectMember) and `foreignField`
                    // is the field in the `from` collection to match against.
                    localField: "project",
                    foreignField: "_id",
                    as: "project",
                    // `pipeline` allows additional aggregation stages to be
                    // executed on the joined (foreign) collection before
                    // returning results. This lets you compute derived
                    // values (like member counts) for each joined project.
                    pipeline: [
                        {
                            // Nested $lookup: find all ProjectMember docs
                            // that reference the joined project. This builds
                            // an array of members per project so we can count
                            // them.
                            $lookup:{
                                from:"projectmembers",
                                localField: "_id",
                                foreignField: "project",
                                as:"projectmembers"
                            }
                        },
                        {
                            // $addFields creates or overwrites fields on the
                            // current document. Here we add a `members` field
                            // equal to the size of the `projectmembers` array.
                            $addFields: {
                                members: {
                                    $size: "$projectmembers",
                                }
                            }
                        }
                    ]
                }
            },
            {
                // $unwind deconstructs an array field, outputting one
                // document per array element. If the lookup produced an
                // array of matched projects, $unwind will flatten that
                // array so subsequent stages see single project objects.
                $unwind: "$project"
            },
            {
                $project:{
                    project: {
                        // $project controls which fields to include or reshape
                        // in the output documents. A value of `1` includes
                        // the field. Here we keep common project fields and
                        // the computed `members` field from the lookup.
                        _id: 1,
                        name: 1,
                        description: 1,
                        members: 1,
                        createdAt: 1,
                        createdBy: 1
                    },
                    role: 1,
                    _id: 0
                }
            }
        ]
    )
    return res  
        .status(200)
        .json(
            new ApiResponse(200, projects, "Projects fetched successfully")
        )
})

const getProjectById = asyncHandler(async(req, res) => {
    const {projectId} = req.params
    const safeProjectId = assertObjectId(projectId, "projectId");
    const project = await Project.findById(safeProjectId)
    if(!project){
        throw new ApiError(404, "Project not found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200,
                project,
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

const getProjectMembers = asyncHandler(async(req, res) => {
    const {projectId}= req.params
    const safeProjectId = assertObjectId(projectId, "projectId");
    const project = await Project.findById(safeProjectId)

    if(!project){
        throw new ApiError(404, "Project not found")
    }

    const projectMembers = await ProjectMember.aggregate([
        {
            $match: {
                project: new mongoose.Types.ObjectId(projectId)
            },
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
            $addFields: {
                user: {
                    $arrayElemAt: ["$user", 0]
                }
            }
        },
        {
            $project: {
                project: 1,
                user: 1,
                role:1,
                createdAt: 1,
                updatedAt: 1,
                _id: 0
            }
        }
    ])
    return res
        .status(200)
        .json(
            new ApiResponse(200, projectMembers, "Project members fetched")
        )
})

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
