import { mysqlTable, int, timestamp, uniqueIndex } from 'drizzle-orm/mysql-core';
import { users } from './users.js';
import { routeComments } from './route-comments.js';

/** H10-d：路线评论点赞记录 */
export const routeCommentLikes = mysqlTable(
  'route_comment_likes',
  {
    id: int('id').primaryKey().autoincrement(),
    userId: int('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    commentId: int('comment_id')
      .notNull()
      .references(() => routeComments.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    ukUserComment: uniqueIndex('uk_route_comment_likes_user_comment').on(
      table.userId,
      table.commentId,
    ),
  }),
);
