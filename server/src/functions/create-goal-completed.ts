import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { completedGoals, goals } from '../db/schema'
import dayjs from 'dayjs'

interface CreateGoalCompletedRequest {
  goalId: string
}

export async function createGoalCompleted({
  goalId,
}: CreateGoalCompletedRequest) {
  const firstDayOfWeek = dayjs().startOf('week').toDate()
  const lastDayOfWeek = dayjs().endOf('week').toDate()

  const goalsCompletedCounts = db.$with('completed_goals_counts').as(
    db
      .select({
        goalId: completedGoals.goalId,
        completedCount: count(completedGoals.id).as('completedCount'),
      })
      .from(completedGoals)
      .where(
        and(
          gte(completedGoals.createdAt, firstDayOfWeek),
          lte(completedGoals.createdAt, lastDayOfWeek),
          eq(completedGoals.goalId, goalId)
        )
      )
      .groupBy(completedGoals.goalId)
  )

  const result = await db
    .with(goalsCompletedCounts)
    .select({
      desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
      completedCount: sql`
      COALESCE(${goalsCompletedCounts.completedCount}, 0)
      `.mapWith(Number),
    })
    .from(goals)
    .leftJoin(goalsCompletedCounts, eq(goalsCompletedCounts.goalId, goals.id))
    .where(eq(goals.id, goalId))
    .limit(1)

  const { completedCount, desiredWeeklyFrequency } = result[0]

  if (completedCount >= desiredWeeklyFrequency) {
    throw new Error('Goal alredy completed this week.')
  }

  const insertResult = await db
    .insert(completedGoals)
    .values({ goalId })
    .returning()

  const goalCompleted = insertResult[0]

  return {
    goalCompleted,
  }
}
