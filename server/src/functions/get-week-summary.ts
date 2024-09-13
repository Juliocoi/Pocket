import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db'
import { completedGoals, goals } from '../db/schema'
import dayjs from 'dayjs'

export async function getWeekSummary() {
  const firstDayOfWeek = dayjs().startOf('week').toDate()
  const lastDayOfWeek = dayjs().endOf('week').toDate()

  //Seleciona todas as metas com data de criação menor ou igual ao último dia da semana.
  const goalsCreatedUpToWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfWeek))
  )

  // Seleciona todos os registros da tabela completedGoals que foram criadas na semana especificada, agrupa o resultado pelo id e faz as contas de quantas vezes a msm meta foi concluída dentro da dessa semana.
  const goalsCompletedInWeek = db.$with('goals_completed_in_week').as(
    db
      .select({
        id: completedGoals.id,
        title: goals.title,
        completedAt: completedGoals.createdAt,
        completedAtDate: sql`
          DATE(${completedGoals.createdAt})
        `.as('completedAtDate'),
      })
      .from(completedGoals)
      .innerJoin(goals, eq(goals.id, completedGoals.goalId))
      .where(
        and(
          gte(completedGoals.createdAt, firstDayOfWeek),
          lte(completedGoals.createdAt, lastDayOfWeek)
        )
      )
  )

  const goalsCompletedByWeekDay = db.$with('completed_goals_by_week_day').as(
    db
      .select({
        completedAtDate: goalsCompletedInWeek.completedAtDate,
        completed: sql`
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ${goalsCompletedInWeek.id},
              'title', ${goalsCompletedInWeek.title},
              'completedAt', ${goalsCompletedInWeek.completedAt}
            )
          )
        `.as('completed'),
      })
      .from(goalsCompletedInWeek)
      .groupBy(goalsCompletedInWeek.completedAtDate)
  )

  const result = await db
    .with(goalsCreatedUpToWeek, goalsCompletedInWeek, goalsCompletedByWeekDay)
    .select({
      completed: sql`
        (SELECT COUNT(*) FROM ${goalsCompletedInWeek})
      `.mapWith(Number),
      total: sql`
      (SELECT SUM(${goalsCreatedUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToWeek})
    `.mapWith(Number),
      goalsPerDay: sql`
        JSON_OBJECT_AGG(
        ${goalsCompletedByWeekDay.completedAtDate},
        ${goalsCompletedByWeekDay.completed}
        )
      `,
    })
    .from(goalsCompletedByWeekDay)

  return {
    summary: result,
  }
}
