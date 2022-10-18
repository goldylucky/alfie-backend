import {
  CompleteUserTaskInput,
  CreateUserTaskInput,
  CreateUserTasksInput,
  GetUserTasksInput,
  UpdateUserTaskInput,
  UserTask,
  UserTaskModel,
} from "../schema/task.user.schema"
import { CreateTaskInput, TaskModel, TaskType } from "../schema/task.schema"
import { ApolloError } from "apollo-server"
import config from "config"
import EmailService from "./email.service"
import { UserModel } from "../schema/user.schema"
import { addDays, isPast } from "date-fns"
import { ProviderModel } from "../schema/provider.schema"
import mongoose from "mongoose"
class TaskService extends EmailService {
  async createTask(input: CreateTaskInput) {
    const { name, type, interval } = input

    const task = await TaskModel.create({
      name,
      type,
      interval,
    })

    return task
  }

  async getTask(id: string) {
    const task = await TaskModel.findById(id)
    return task
  }

  async getUserTask(id: string, userId?: string) {
    const { notFound, notPermitted } = config.get("errors.tasks") as any
    const userTask = await UserTaskModel.findById(id)
    if (!userTask) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    if (userId && userTask.user.toString() !== userId) {
      throw new ApolloError(notPermitted.message, notPermitted.code)
    }

    return userTask
  }

  async getUserTasks(userId: string, input: GetUserTasksInput) {
    const { limit, offset, completed } = input
    const { noTasks } = config.get("errors.tasks") as any
    const where = { ...(completed !== undefined && { completed }) }

    const userTasksCount = await UserTaskModel.find({
      user: userId,
    })
      .where(where)
      .countDocuments()
    if (userTasksCount === 0) {
      throw new ApolloError(noTasks.message, noTasks.code)
    }

    const userTasks = await UserTaskModel.find({ user: userId })
      .where(where)
      .skip(offset)
      .limit(limit)
      .sort({ highPriority: -1, dueAt: -1, createdAt: 1 })
      .populate("task")
      .populate("user")
    console.log(userTasks, "userTasks")
    return {
      total: userTasksCount,
      limit,
      offset,
      userTasks: userTasks.map((userTask) => ({
        ...userTask.toObject(),
        ...(userTask.dueAt && { pastDue: isPast(userTask.dueAt) }),
      })),
    }
  }

  async completeUserTask(input: CompleteUserTaskInput) {
    const { notFound } = config.get("errors.tasks") as any
    const { _id, answers } = input
    const userTask = await UserTaskModel.findById(_id)
    if (!userTask) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    console.log(userTask, "userTask")
    userTask.completed = true
    userTask.completedAt = new Date()
    userTask.answers = answers
    await userTask.save()

    const task = await TaskModel.findById(userTask.task)
    // we can add more types here in a switch to save data to different places
    if (task.type === TaskType.DAILY_METRICS_LOG) {
      const weight = {
        date: new Date(),
        value: answers.find((a) => a.key === "weightInLbs").value,
      }

      const user = await UserModel.findById(userTask.user)
      user.weights.push(weight)
      await user.save()
    }
    if (task.type === TaskType.NEW_PATIENT_INTAKE_FORM) {
      // If the task type is NEW_PATIENT_INTAKE_FORM and hasRequiredLabs is true, we want to create a new task for the patient to schedule their first appointment
      const hasRequiredLabs = answers.find((a) => a.key === "hasRequiredLabs")
      if (hasRequiredLabs && hasRequiredLabs.value === "true") {
        const newTaskInput: CreateUserTaskInput = {
          taskType: TaskType.SCHEDULE_APPOINTMENT,
          userId: userTask.user.toString(),
        }
        await this.assignTaskToUser(newTaskInput)
      }
    }

    return {
      ...userTask.toObject(),
    }
  }

  async bulkAssignTasksToUser(input: CreateUserTasksInput) {
    const { alreadyAssigned, notFound, userNotFound } = config.get(
      "errors.tasks"
    ) as any
    const { userId, taskTypes } = input
    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApolloError(userNotFound.message, userNotFound.code)
    }

    const tasks = await TaskModel.find({ type: { $in: taskTypes } })
      .where({ completed: false })
      .lean()
    if (tasks.length !== taskTypes.length) {
      throw new ApolloError(notFound.message, notFound.code)
    }
    const taskIds = tasks.map((task) => task._id)

    const userTasks = await UserTaskModel.find({
      user: userId,
      task: { $in: taskIds },
    })

    const newTasks: Omit<UserTask, "_id" | "completed">[] = tasks.reduce(
      (filtered: Omit<UserTask, "_id" | "completed">[], task) => {
        const existingTask = userTasks.find(
          (userTask) => userTask.task.toString() === task._id.toString()
        )

        if (!existingTask || (existingTask && task.canHaveMultiple)) {
          filtered.push({
            user: userId,
            task: task._id,
            ...(task.daysTillDue && {
              dueAt: addDays(new Date(), task.daysTillDue),
            }),
            highPriority: task.highPriority,
            lastNotifiedUserAt: task.notifyWhenAssigned
              ? new Date()
              : undefined,
            archived: false,
          })
        }

        return filtered
      },
      []
    )
    if (!newTasks.length) {
      throw new ApolloError(alreadyAssigned.message, alreadyAssigned.code)
    }

    const newUserTasks = await UserTaskModel.create(newTasks)

    return newUserTasks.map((userTask) => ({
      ...userTask.toObject(),
      ...(userTask.dueAt && { pastDue: false }),
    }))
  }

  async assignTaskToUser(input: CreateUserTaskInput) {
    const { alreadyAssigned, notFound, userNotFound } = config.get(
      "errors.tasks"
    ) as any
    const { userId, taskType } = input
    console.log({ userId, taskType })
    const task = await TaskModel.find().findByType(taskType).lean()
    if (!task) {
      throw new ApolloError(notFound.message, notFound.code)
    }

    const existingUserTask = await UserTaskModel.find().findUserTask(
      userId,
      task._id
    )
    if (
      existingUserTask &&
      !task.canHaveMultiple &&
      !existingUserTask.completed
    ) {
      throw new ApolloError(alreadyAssigned.message, alreadyAssigned.code)
    }

    const user = await UserModel.findById(userId)
    if (!user) {
      throw new ApolloError(userNotFound.message, userNotFound.code)
    }

    const newTask = await UserTaskModel.create({
      user: userId,
      task: task._id,
      dueAt: task.daysTillDue
        ? addDays(new Date(), task.daysTillDue)
        : undefined,
      highPriority: task.highPriority,
      lastNotifiedUserAt: task.notifyWhenAssigned ? new Date() : undefined,
    })

    await newTask.populate("user")
    await newTask.populate("task")

    if (task.notifyWhenAssigned) {
      await this.sendTaskAssignedEmail({
        email: user.email,
        taskName: task.name,
        taskId: newTask._id,
        taskType: task.type,
        dueAt: newTask.dueAt,
      })
    }

    return {
      ...newTask.toObject(),
      ...(newTask.dueAt && { pastDue: false }),
    }
  }
  async getAllTasks() {
    try {
      const tasks = await TaskModel.find()
      console.log(tasks)
      return tasks
    } catch (error) {
      console.log(error)
    }
  }
  async getAllUserTasks() {
    try {
      const userTasks = await UserTaskModel.find()
      return userTasks
    } catch (error) {
      console.log(error)
    }
  }
  async getAllUserTasksByUserId(userId: string) {
    try {
      const userTasks: any = await UserTaskModel.find({ user: userId })
        .populate("task")
        .populate("user")
      // console.log(userTasks)
      const providerId = userTasks[0].user.provider.toHexString()
      const lookUpProviderEmail = await ProviderModel.findOne({
        _id: providerId,
      })
      const arrayOfUserTasksWithProviderEmail = userTasks.map((task: any) => {
        return {
          ...task.toObject(),
          providerEmail: lookUpProviderEmail.email,
        }
      })
      console.log(
        arrayOfUserTasksWithProviderEmail,
        "arrayOfUserTasksWithProviderEmail"
      )
      return arrayOfUserTasksWithProviderEmail
    } catch (error) {
      console.log(error)
    }
  }
  async archiveTask(taskId: string) {
    try {
      const task = await UserTaskModel.findById(taskId)
      if (!task) {
        throw new ApolloError("Task not found", "404")
      }
      task.archived = true
      await task.save()
      return task
    } catch (error) {
      console.log(error)
    }
  }
  async updateTask(taskId: string, input: UpdateUserTaskInput) {
    try {
      const task = await UserTaskModel.findById(taskId)
      if (!task) {
        throw new ApolloError("Task not found", "404")
      }
      const { lastNotifiedUserAt } = input
      task.lastNotifiedUserAt = lastNotifiedUserAt
      await task.save()
      return task
    } catch (error) {
      console.log(error)
    }
  }
}

export default TaskService
