import {User} from "../models/user.models.js"
import {Project} from "../models/project.models.js"
import {ProjectMember} from "../models/projectmember.models.js"

import {ApiResponse} from "../utils/api-response.js"
import {ApiError} from "../utils/api-error.js";
import {asyncHandler} from "../utils/async-handler.js";

import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";


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
    const project = await Project.findById(projectId)
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

const createProject = asyncHandler(async(req, res) => {
    //take name and description form req.body
    const {name, description} = req.body

    const project = await Project.create({
        name,description,
        //assign who created the project
        createdBy: new mongoose.Types.ObjectId(req.user._id),
    })

    //
    await ProjectMember.create({
        user: new mongoose.Types.ObjectId(req.user._id),
        project: new mongoose.Types.ObjectId(project._id),
        //Only admin can create projects
        role: UserRolesEnum.ADMIN
    })

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                project,
                "Project Created Successfully"
            )
        )
})

const updateProject = asyncHandler(async(req, res) => {

    //we are hoping that someone will send the name and description inside request obj
    const {name, description} = req.body

    //we are taking projectId from url(params)
    const {projectId} = req.params

    const project = await Project.findByIdAndUpdate(
        //find by project id
        projectId,
        //and update
        {
            name,description
        },
        {new: true}
    )
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
    const {projectId} = req.params
    const project = await Project.findByIdAndDelete(projectId);
    if(!project){
        throw new ApiError(404, "Project not found")
    }
    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project deleted successfully"))
})

const addMembersToProject = asyncHandler(async(req, res) => {
    const {email, role} = req.body
    const {projectId } = req.params
    const user = await User.findOne({email});
    if (!user) {
        throw new ApiError(404, "No account found with this email. Ask your teammate to register first.");
    }

    await ProjectMember.findOneAndUpdate(
        {
            user: new mongoose.Types.ObjectId(user._id),
            project: new mongoose.Types.ObjectId(projectId)
        },
        {
            user: new mongoose.Types.ObjectId(user._id),
            project: new mongoose.Types.ObjectId(projectId),
            role: role
        },
        {
            new: true,
            //creates a new document if none of them exists
            upsert: true
        }
    )

    return res
        .status(201)
        .json(
            new ApiResponse(201, {}, "Project member added successfully")
        )
})

const getProjectMembers = asyncHandler(async(req, res) => {
    const {projectId}= req.params
    const project = await Project.findById(projectId)
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

    if(!AvailableUserRole.includes(newRole)){
        throw new ApiError(400, "Invalid role")
    }

    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId)
    })

    if(!projectMember){
        throw new ApiError(400, "Project member not found");
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


    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId)
    })

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
