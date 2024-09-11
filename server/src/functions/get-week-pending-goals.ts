import dayjs from 'dayjs'
import { db } from '../db'
import { completedGoals, goals } from '../db/schema'
import { and, count, eq, gte, lte, sql } from 'drizzle-orm'

export async function getWeekPendingGoals() {
  //Retorna o último dia da semana
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
  const goalsCompletedCounts = db.$with('goals_completed_counts').as(
    db
      .select({
        goalId: completedGoals.goalId,
        completedCount: count(completedGoals.id).as('completedCount'),
      })
      .from(completedGoals)
      .where(
        and(
          gte(completedGoals.createdAt, firstDayOfWeek),
          lte(completedGoals.createdAt, lastDayOfWeek)
        )
      )
      .groupBy(completedGoals.goalId)
  )
  //o With não utiliza o $ pois não está criando uma Common Table Expressions, mas uma querie que ira usar outras já criadas.
  const pendingGoals = await db
    .with(goalsCreatedUpToWeek, goalsCompletedCounts)
    .select({
      id: goalsCreatedUpToWeek.id,
      title: goalsCreatedUpToWeek.title,
      desiredWeeklyFrequency: goalsCreatedUpToWeek.desiredWeeklyFrequency,
      completedCount: sql`
        COALESCE(${goalsCompletedCounts.completedCount}, 0)
      `.mapWith(Number),
    })
    .from(goalsCreatedUpToWeek) // o nome da tabela pode ser substituída por uma Common Table Expressions.
    .leftJoin(
      goalsCompletedCounts,
      eq(goalsCompletedCounts.goalId, goalsCreatedUpToWeek.id)
    )

  // a querie pendingGoals é a query principal, depende das querys goalsCreatedUpToWeek e goalsCompletedCounts. elas serão executadas ao mesmo tempo e a principal depende diretamente das outras. Querie do tipo "WITH(Common Table Expressions)" do postgreSQL.

  return { pendingGoals }
}
