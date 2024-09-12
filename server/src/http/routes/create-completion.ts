import { z } from 'zod'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { createGoalCompleted } from '../../functions/create-goal-completed'

export const createComplitionRoute: FastifyPluginAsyncZod = async app => {
  app.post(
    '/completedGoal',
    {
      schema: {
        body: z.object({
          goalId: z.string(),
        }),
      },
    },
    async request => {
      const { goalId } = request.body

      await createGoalCompleted({
        goalId,
      })
    }
  )
}
